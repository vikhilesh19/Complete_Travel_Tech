import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import express from "express";
import nodemailer from "nodemailer";
import pg from "pg";

const { Pool } = pg;
const app = express();
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : undefined,
);
const port = Number(process.env.API_PORT || 3001);
const allowedFrontendOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
);
const sessionLifetimeSeconds = 8 * 60 * 60;
const sessionCookieName = "wayfinder_officer";
const translationCache = new Map();
const translationRequests = new Map();
const helpActionRequests = new Map();
const smsCodeRequests = new Map();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "4kb" }));
app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (!origin) return next();
  let localDevelopmentOrigin = false;
  if (process.env.NODE_ENV !== "production") {
    try {
      const parsedOrigin = new URL(origin);
      localDevelopmentOrigin =
        parsedOrigin.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsedOrigin.hostname);
    } catch {
      localDevelopmentOrigin = false;
    }
  }
  if (!allowedFrontendOrigins.has(origin) && !localDevelopmentOrigin)
    return res.status(403).json({ error: "Frontend origin is not allowed." });

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,X-Requested-With,X-Wayfinder-Refresh",
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "X-Wayfinder-Cached-At,X-Wayfinder-Offline",
  );
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    req.path !== "/api/sms/twilio/inbound" &&
    req.get("X-Requested-With") !== "WayfinderWeb"
  ) {
    return res.status(403).json({ error: "Request origin validation failed." });
  }
  return next();
});

app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS server_time, current_database() AS database_name",
    );
    return res.json({
      success: true,
      message: "Database connected",
      database: result.rows[0].database_name,
      time: result.rows[0].server_time,
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    return res.status(503).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

function smsProviderConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
    fromNumber: process.env.TWILIO_SMS_FROM_NUMBER,
  };
}

function smsAlertsConfigured() {
  const config = smsProviderConfig();
  const webhookUrl = process.env.TWILIO_INBOUND_WEBHOOK_URL || "";
  try {
    return (
      Object.values(config).every(Boolean) &&
      new URL(webhookUrl).protocol === "https:" &&
      !webhookUrl.includes("example.com")
    );
  } catch {
    return false;
  }
}

function consumeRateLimit(map, key, limit, windowMs) {
  const now = Date.now();
  const recent = (map.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    map.set(key, recent);
    return false;
  }
  recent.push(now);
  map.set(key, recent);
  return true;
}

async function twilioPost(url, values) {
  const { accountSid, authToken } = smsProviderConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(values),
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Twilio returned ${response.status}.`);
  return result;
}

async function translateSmsText(text, language) {
  if (language === "en") return text;
  try {
    const query = new URLSearchParams({
      client: "gtx",
      sl: "auto",
      tl: language,
      dt: "t",
      q: text.slice(0, 1200),
    });
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?${query}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) throw new Error("Translation unavailable.");
    const result = await response.json();
    const translated = Array.isArray(result[0])
      ? result[0].map((part) => part[0] || "").join("")
      : "";
    return translated || text;
  } catch {
    return text;
  }
}

async function sendHazardSms(hazard, areaId) {
  if (!smsAlertsConfigured()) return { configured: false, sent: 0, failed: 0 };
  const result = await pool.query(
    `SELECT phone_e164, language FROM tourist_sms_subscriptions
     WHERE area_id = $1 AND verified_at IS NOT NULL`,
    [areaId],
  );
  const subscribers = result.rows;
  const translatedDescriptions = new Map();
  let sent = 0;
  let failed = 0;

  for (let offset = 0; offset < subscribers.length; offset += 10) {
    const batch = subscribers.slice(offset, offset + 10);
    const outcomes = await Promise.allSettled(batch.map(async (subscriber) => {
      let descriptionPromise = translatedDescriptions.get(subscriber.language);
      if (!descriptionPromise) {
        descriptionPromise = translateSmsText(
          hazard.alert_text || hazard.description,
          subscriber.language,
        );
        translatedDescriptions.set(subscriber.language, descriptionPromise);
      }
      const description = await descriptionPromise;
      const label = hazard.is_demo
        ? "DEMO ALERT (not official)"
        : "OFFICER REPORT (not independently verified)";
      const message = [
        `${label}: ${hazard.hazard} · ${hazard.affected_zone || hazard.location}`,
        `${hazard.severity}. ${description.slice(0, 900)}`,
        `Expires: ${new Date(hazard.expires_at).toISOString()}`,
        `Source: ${hazard.source}. Details: ${hazard.source_url}`,
        "Reply STOP to opt out. Follow local authority instructions.",
      ].join("\n");
      await twilioPost(
        `https://api.twilio.com/2010-04-01/Accounts/${smsProviderConfig().accountSid}/Messages.json`,
        {
          To: subscriber.phone_e164,
          From: smsProviderConfig().fromNumber,
          Body: message,
        },
      );
    }));
    sent += outcomes.filter((outcome) => outcome.status === "fulfilled").length;
    failed += outcomes.filter((outcome) => outcome.status === "rejected").length;
  }

  return { configured: true, sent, failed };
}

app.post("/api/translate-alert", async (req, res) => {
  const { text, language } = req.body || {};
  const targetLanguages = new Set(["hi", "ml", "nl"]);
  if (
    typeof text !== "string" ||
    text.trim().length === 0 ||
    text.length > 5000 ||
    !targetLanguages.has(language)
  ) {
    return res
      .status(400)
      .json({ error: "Unsupported language or alert text." });
  }

  const now = Date.now();
  const requester = req.ip || "unknown";
  const recent = (translationRequests.get(requester) || []).filter(
    (time) => now - time < 60_000,
  );
  if (recent.length >= 10) {
    return res
      .status(429)
      .json({ error: "Translation limit reached. Try again shortly." });
  }
  recent.push(now);
  translationRequests.set(requester, recent);

  const cacheKey = crypto
    .createHash("sha256")
    .update(`${language}:${text}`)
    .digest("hex");
  const cached = translationCache.get(cacheKey);
  if (cached && cached.expiresAt > now)
    return res.json({ translatedText: cached.text });

  try {
    const chunks = text.match(/[\s\S]{1,450}(?:\s|$)|[\s\S]{1,450}/g) || [text];
    const translatedChunks = [];
    for (const chunk of chunks) {
      const query = new URLSearchParams({
        client: "gtx",
        sl: "auto",
        tl: language,
        dt: "t",
        q: chunk,
      });
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?${query}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok)
        throw new Error(`Translation service returned ${response.status}.`);
      const result = await response.json();
      const translated = Array.isArray(result[0])
        ? result[0].map((part) => part[0] || "").join("")
        : "";
      if (!translated) {
        throw new Error("Translation service did not return translated text.");
      }
      translatedChunks.push(translated);
    }
    const translatedText = translatedChunks.join("");
    translationCache.set(cacheKey, {
      text: translatedText,
      expiresAt: now + 86_400_000,
    });
    return res.json({ translatedText });
  } catch (error) {
    console.error("Alert translation unavailable:", error.message);
    return res.status(503).json({
      error:
        "Translation is temporarily unavailable; the original alert text is unchanged.",
    });
  }
});

app.post("/api/help-queue", async (req, res) => {
  const { id, action, areaId, createdAt } = req.body || {};
  const created = new Date(createdAt);
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !["safe", "help", "callback"].includes(action) ||
    !["kerala", "wayanad"].includes(areaId) ||
    !Number.isFinite(created.getTime()) ||
    created.getTime() > Date.now() + 5 * 60_000
  ) {
    return res.status(400).json({ error: "Invalid help action." });
  }

  const now = Date.now();
  const requester = req.ip || "unknown";
  const recent = (helpActionRequests.get(requester) || []).filter(
    (time) => now - time < 60_000,
  );
  if (recent.length >= 30) {
    return res
      .status(429)
      .json({ error: "Too many help actions. Try again shortly." });
  }
  recent.push(now);
  helpActionRequests.set(requester, recent);

  try {
    await pool.query(
      `INSERT INTO tourist_help_actions (id, action, area_id, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [id, action, areaId, created.toISOString()],
    );
    return res.status(202).json({ accepted: true, id });
  } catch (error) {
    console.error("Unable to store tourist help action:", error.message);
    return res
      .status(503)
      .json({ error: "Help action could not be delivered yet." });
  }
});

app.get("/api/public-config", (_req, res) => {
  const configuredNumber = (process.env.SMS_HELP_NUMBER || "").trim();
  const smsHelpNumber = /^\+?[1-9]\d{6,14}$/.test(configuredNumber)
    ? configuredNumber
    : "";
  return res.json({ smsHelpNumber, smsAlertsEnabled: smsAlertsConfigured() });
});

function readSmsSubscription(body) {
  const phone =
    typeof body?.phone === "string"
      ? body.phone.replace(/[\s().-]/g, "")
      : "";
  const { areaId, language, consent } = body || {};
  if (
    !/^\+[1-9]\d{7,14}$/.test(phone) ||
    !["kerala", "wayanad"].includes(areaId) ||
    !["en", "hi", "ml", "nl"].includes(language) ||
    consent !== true
  ) {
    return null;
  }
  return { phone, areaId, language };
}

app.post("/api/sms/subscriptions/request-code", async (req, res) => {
  const subscription = readSmsSubscription(req.body);
  if (!subscription)
    return res.status(400).json({ error: "Enter a valid international phone number and accept SMS consent." });
  if (!smsAlertsConfigured())
    return res.status(503).json({ error: "SMS alerts are not configured on this server." });

  const requester = req.ip || "unknown";
  if (
    !consumeRateLimit(smsCodeRequests, `ip:${requester}`, 5, 60 * 60_000) ||
    !consumeRateLimit(
      smsCodeRequests,
      `phone:${subscription.phone}`,
      3,
      15 * 60_000,
    )
  ) {
    return res.status(429).json({ error: "Too many verification requests. Try again later." });
  }

  try {
    await twilioPost(
      `https://verify.twilio.com/v2/Services/${smsProviderConfig().verifyServiceSid}/Verifications`,
      { To: subscription.phone, Channel: "sms" },
    );
    return res.status(202).json({ verificationRequired: true });
  } catch (error) {
    console.error("Unable to request SMS verification:", error.message);
    return res.status(502).json({ error: "Could not send a verification code. Check the number and try again." });
  }
});

app.post("/api/sms/subscriptions/verify", async (req, res) => {
  const subscription = readSmsSubscription(req.body);
  const code = req.body?.code;
  if (!subscription || typeof code !== "string" || !/^\d{4,10}$/.test(code))
    return res.status(400).json({ error: "Enter the phone, consent, and verification code." });
  if (!smsAlertsConfigured())
    return res.status(503).json({ error: "SMS alerts are not configured on this server." });
  if (
    !consumeRateLimit(
      smsCodeRequests,
      `verify:${req.ip || "unknown"}`,
      10,
      15 * 60_000,
    )
  ) {
    return res.status(429).json({ error: "Too many code attempts. Request a new code later." });
  }

  try {
    const verification = await twilioPost(
      `https://verify.twilio.com/v2/Services/${smsProviderConfig().verifyServiceSid}/VerificationCheck`,
      { To: subscription.phone, Code: code },
    );
    if (verification.status !== "approved")
      return res.status(400).json({ error: "That verification code is not valid." });

    await pool.query(
      `INSERT INTO tourist_sms_subscriptions
        (phone_e164, area_id, language, consented_at, verified_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (phone_e164, area_id) DO UPDATE SET
         language = EXCLUDED.language,
         consented_at = NOW(),
         verified_at = NOW()`,
      [subscription.phone, subscription.areaId, subscription.language],
    );
    return res.status(201).json({ subscribed: true, areaId: subscription.areaId });
  } catch (error) {
    console.error("Unable to verify SMS subscription:", error.message);
    return res.status(503).json({ error: "Could not verify the subscription right now." });
  }
});

app.post("/api/sms/twilio/inbound", async (req, res) => {
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const webhookUrl = process.env.TWILIO_INBOUND_WEBHOOK_URL || "";
  const signature = req.get("x-twilio-signature") || "";
  let requestUrl = "";
  try {
    requestUrl = new URL(req.originalUrl, webhookUrl).toString();
  } catch {
    return res.status(403).end();
  }
  let signaturePayload = requestUrl;
  for (const key of Object.keys(req.body || {}).sort()) {
    const values = Array.isArray(req.body[key]) ? req.body[key].sort() : [req.body[key]];
    for (const value of values) signaturePayload += key + value;
  }
  const expectedSignature = crypto
    .createHmac("sha1", authToken)
    .update(signaturePayload)
    .digest("base64");
  if (
    !authToken ||
    requestUrl !== webhookUrl ||
    !signature ||
    !safeEqual(signature, expectedSignature)
  ) {
    return res.status(403).end();
  }

  const phone =
    typeof req.body?.From === "string"
      ? req.body.From.replace(/[\s().-]/g, "")
      : "";
  const incomingText =
    typeof req.body?.Body === "string" ? req.body.Body.trim().toUpperCase() : "";
  const isOptOut =
    /^\+[1-9]\d{7,14}$/.test(phone) &&
    ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(
      incomingText,
    );
  if (isOptOut) {
    try {
      await pool.query(
        "DELETE FROM tourist_sms_subscriptions WHERE phone_e164 = $1",
        [phone],
      );
    } catch (error) {
      console.error("Unable to remove SMS opt-out:", error.message);
      return res.status(503).end();
    }
  }
  return res.type("text/xml").send(
    isOptOut
      ? "<Response><Message>You have been unsubscribed from hazard alerts.</Message></Response>"
      : "<Response></Response>",
  );
});

function safeEqual(first, second) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return (
    firstBuffer.length === secondBuffer.length &&
    crypto.timingSafeEqual(firstBuffer, secondBuffer)
  );
}

function sign(payload) {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "")
    .update(payload)
    .digest("base64url");
}

function getSession(req) {
  const cookies = req.headers.cookie || "";
  const token = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${sessionCookieName}=`))
    ?.slice(sessionCookieName.length + 1);
  if (!token || !process.env.SESSION_SECRET) return null;

  const [payload, signature] = decodeURIComponent(token).split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature))
    return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function requireOfficer(req, res, next) {
  const session = getSession(req);
  if (!session)
    return res.status(401).json({ error: "Officer sign-in required." });
  req.officer = session.username;
  return next();
}

app.get("/api/officer/help-queue", requireOfficer, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, action, area_id, created_at, received_at
       FROM tourist_help_actions
       ORDER BY received_at DESC
       LIMIT 100`,
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Unable to load officer help queue:", error.message);
    return res
      .status(503)
      .json({ error: "Help queue is temporarily unavailable." });
  }
});

app.delete("/api/officer/help-queue/:id", requireOfficer, async (req, res) => {
  const { id } = req.params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    return res.status(400).json({ error: "Invalid help request ID." });
  }

  try {
    const result = await pool.query(
      "DELETE FROM tourist_help_actions WHERE id = $1 RETURNING id",
      [id],
    );
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Help request was already cleared." });
    }
    return res.status(204).end();
  } catch (error) {
    console.error("Unable to clear officer help request:", error.message);
    return res
      .status(503)
      .json({ error: "Help request could not be cleared." });
  }
});

function setSessionCookie(res, username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expiresAt: Date.now() + sessionLifetimeSeconds * 1000,
    }),
  ).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const sameSite = process.env.COOKIE_SAME_SITE || "strict";
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    maxAge: sessionLifetimeSeconds * 1000,
    path: "/",
  });
}

app.post("/api/officer/login", (req, res) => {
  return loginOfficer(req, res);
});

async function loginOfficer(req, res) {
  const { username, password } = req.body || {};
  if (!process.env.SESSION_SECRET) {
    return res
      .status(503)
      .json({ error: "Officer sign-in is not configured." });
  }
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(401).json({ error: "Invalid officer credentials." });
  }

  let valid = Boolean(
    process.env.OFFICER_USERNAME &&
    process.env.OFFICER_PASSWORD &&
    safeEqual(username, process.env.OFFICER_USERNAME) &&
    safeEqual(password, process.env.OFFICER_PASSWORD),
  );
  let accountUsername = username;
  if (!valid) {
    try {
      const result = await pool.query(
        "SELECT username, password_hash FROM officer_accounts WHERE username = $1",
        [username.trim().toLowerCase()],
      );
      if (result.rows[0]) {
        valid = await bcrypt.compare(password, result.rows[0].password_hash);
        accountUsername = result.rows[0].username;
      }
    } catch (error) {
      console.error("Unable to verify officer account:", error.message);
      return res
        .status(503)
        .json({ error: "Officer accounts are temporarily unavailable." });
    }
  }
  if (!valid)
    return res.status(401).json({ error: "Invalid officer credentials." });

  if (
    !process.env.OFFICER_USERNAME ||
    !safeEqual(username, process.env.OFFICER_USERNAME)
  ) {
    accountUsername = accountUsername.trim().toLowerCase();
  }
  setSessionCookie(res, accountUsername);
  return res.json({ username: accountUsername });
}

function otpDigest(email, code) {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "")
    .update(`${email}:${code}`)
    .digest("hex");
}

function mailTransport() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE !== "false",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

app.post("/api/officer/register/send-otp", async (req, res) => {
  const { email, username, password } = req.body || {};
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedUsername =
    typeof username === "string" ? username.trim().toLowerCase() : "";
  if (
    !/^\S+@\S+\.\S+$/.test(normalizedEmail) ||
    normalizedEmail.length > 254 ||
    !/^[a-zA-Z0-9._-]{3,32}$/.test(normalizedUsername) ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  ) {
    return res.status(400).json({
      error:
        "Enter a valid email, a 3–32 character username, and a password of at least 12 characters.",
    });
  }
  if (!process.env.SESSION_SECRET || !mailTransport()) {
    return res.status(503).json({
      error:
        "Email verification is not configured. Set SMTP account credentials and SESSION_SECRET.",
    });
  }

  try {
    const existing = await pool.query(
      "SELECT 1 FROM officer_accounts WHERE username = $1 OR email = $2 LIMIT 1",
      [normalizedUsername, normalizedEmail],
    );
    if (existing.rowCount) {
      return res
        .status(409)
        .json({ error: "That username or email is already registered." });
    }

    const pending = await pool.query(
      "SELECT last_sent_at FROM officer_registration_otps WHERE email = $1",
      [normalizedEmail],
    );
    if (
      pending.rows[0] &&
      Date.now() - new Date(pending.rows[0].last_sent_at).getTime() < 60_000
    ) {
      return res.status(429).json({
        error: "Please wait 60 seconds before requesting another code.",
      });
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO officer_registration_otps
         (email, username, password_hash, otp_hash, expires_at, attempts, last_sent_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes', 0, NOW())
       ON CONFLICT (email) DO UPDATE SET
         username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         otp_hash = EXCLUDED.otp_hash,
         expires_at = EXCLUDED.expires_at,
         attempts = 0,
         last_sent_at = NOW()`,
      [
        normalizedEmail,
        normalizedUsername,
        passwordHash,
        otpDigest(normalizedEmail, code),
      ],
    );

    const transporter = mailTransport();
    const fromAddress = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    try {
      await transporter.sendMail({
        from: {
          name: process.env.SMTP_FROM_NAME || "Travel_tech",
          address: fromAddress,
        },
        replyTo: process.env.SMTP_REPLY_TO || fromAddress,
        to: normalizedEmail,
        subject: "Your Travel_tech officer verification code",
        text: `Your Travel_tech officer registration code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;color:#26332b;max-width:520px"><p style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#397052">TRAVEL_TECH · OFFICER REGISTRATION</p><h1 style="font-size:22px">Verify your email</h1><p>Enter this one-time code to finish creating your officer account:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:14px 0">${code}</p><p style="font-size:13px;color:#69766d">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
      });
    } catch (error) {
      await pool.query(
        "DELETE FROM officer_registration_otps WHERE email = $1",
        [normalizedEmail],
      );
      console.error(
        "Unable to send officer verification email:",
        error.message,
      );
      return res.status(503).json({
        error:
          "Could not send the verification email. Check the SMTP settings and try again.",
      });
    }
    return res.json({
      message: "Verification code sent. Check your email inbox.",
    });
  } catch (error) {
    console.error("Unable to start officer registration:", error.message);
    return res
      .status(503)
      .json({ error: "Officer registration is temporarily unavailable." });
  }
});

app.post("/api/officer/register", async (req, res) => {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const code = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) {
    return res
      .status(400)
      .json({ error: "Enter the email and 6-digit verification code." });
  }

  const client = await pool.connect().catch((error) => {
    console.error("Unable to connect for officer verification:", error.message);
    return null;
  });
  if (!client)
    return res
      .status(503)
      .json({ error: "Officer registration is temporarily unavailable." });

  try {
    await client.query("BEGIN");
    const pending = await client.query(
      `SELECT username, password_hash, otp_hash, expires_at, attempts
       FROM officer_registration_otps WHERE email = $1 FOR UPDATE`,
      [email],
    );
    const record = pending.rows[0];
    if (
      !record ||
      new Date(record.expires_at).getTime() <= Date.now() ||
      record.attempts >= 5
    ) {
      await client.query(
        "DELETE FROM officer_registration_otps WHERE email = $1",
        [email],
      );
      await client.query("COMMIT");
      return res.status(400).json({
        error: "That code expired or is no longer valid. Request a new code.",
      });
    }
    if (!safeEqual(otpDigest(email, code), record.otp_hash)) {
      const attempts = record.attempts + 1;
      if (attempts >= 5) {
        await client.query(
          "DELETE FROM officer_registration_otps WHERE email = $1",
          [email],
        );
      } else {
        await client.query(
          "UPDATE officer_registration_otps SET attempts = $2 WHERE email = $1",
          [email, attempts],
        );
      }
      await client.query("COMMIT");
      return res.status(400).json({
        error:
          attempts >= 5
            ? "Too many incorrect codes. Request a new code."
            : `Incorrect code. ${5 - attempts} attempts remaining.`,
      });
    }

    const registered = await client.query(
      `INSERT INTO officer_accounts (username, email, password_hash)
       VALUES ($1, $2, $3) RETURNING username`,
      [record.username, email, record.password_hash],
    );
    await client.query(
      "DELETE FROM officer_registration_otps WHERE email = $1",
      [email],
    );
    await client.query("COMMIT");
    setSessionCookie(res, registered.rows[0].username);
    return res.status(201).json({ username: registered.rows[0].username });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505")
      return res
        .status(409)
        .json({ error: "That username or email is already registered." });
    console.error("Unable to complete officer registration:", error.message);
    return res
      .status(503)
      .json({ error: "Officer registration is temporarily unavailable." });
  } finally {
    client.release();
  }
});

app.get("/api/officer/session", (req, res) => {
  const session = getSession(req);
  return res.json({
    authenticated: Boolean(session),
    username: session?.username,
  });
});

app.post("/api/officer/logout", (_req, res) => {
  res.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  });
  return res.status(204).end();
});

app.get("/api/officer/hazards", requireOfficer, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id FROM hazards WHERE created_by = $1",
      [req.officer],
    );
    return res.json(result.rows.map((row) => String(row.id)));
  } catch (error) {
    console.error("Unable to load officer-owned hazards:", error.message);
    return res
      .status(503)
      .json({ error: "Could not load your hazard reports." });
  }
});

app.get("/api/hazards", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, hazard, location, description, severity, latitude, longitude,
              area_id, affected_zone, alert_text, onset_at, expires_at, source, source_url,
              is_demo, created_at
      FROM hazards
      WHERE expires_at IS NOT NULL AND expires_at > NOW()
      ORDER BY created_at DESC`,
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Unable to load hazards:", error.message);
    return res
      .status(503)
      .json({ error: "Hazard reports are temporarily unavailable." });
  }
});

app.post("/api/hazards", requireOfficer, async (req, res) => {
  const {
    hazard,
    affectedZone,
    alertText,
    severity,
    onsetAt,
    expiresAt,
    source,
    sourceUrl,
    isDemo,
    areaId,
    latitude,
    longitude,
  } = req.body || {};
  const location = affectedZone;
  const description = alertText;
  const lat = Number(latitude);
  const lon = Number(longitude);
  const onset = new Date(onsetAt);
  const expiry = new Date(expiresAt);
  if (
    typeof hazard !== "string" ||
    ![
      "Cyclone",
      "Flood",
      "Landslide",
      "Storm surge",
      "Heat wave",
      "Other",
    ].includes(hazard) ||
    hazard.length > 80 ||
    typeof location !== "string" ||
    location.trim().length < 2 ||
    location.length > 120 ||
    typeof description !== "string" ||
    description.trim().length < 10 ||
    description.length > 5000 ||
    ![
      "Danger (red)",
      "Warning (orange)",
      "Advisory (yellow)",
      "Information (blue)",
    ].includes(severity) ||
    !Number.isFinite(onset.getTime()) ||
    !Number.isFinite(expiry.getTime()) ||
    onset >= expiry ||
    expiry <= new Date() ||
    typeof source !== "string" ||
    source.trim().length < 2 ||
    source.length > 160 ||
    typeof sourceUrl !== "string" ||
    sourceUrl.length > 500 ||
    !/^https?:\/\//i.test(sourceUrl) ||
    typeof isDemo !== "boolean" ||
    !["kerala", "wayanad"].includes(areaId) ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lon) ||
    lon < -180 ||
    lon > 180
  ) {
    return res.status(400).json({
      error:
        "Enter a hazard, place, short description, severity, and valid coordinates.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO hazards
        (hazard, location, description, severity, latitude, longitude, created_by, area_id,
         affected_zone, alert_text, onset_at, expires_at, source, source_url, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, hazard, location, description, severity, latitude, longitude,
                 area_id, affected_zone, alert_text, onset_at, expires_at, source, source_url,
                 is_demo, created_at`,
      [
        hazard.trim(),
        location.trim(),
        description.trim(),
        severity,
        lat,
        lon,
        req.officer,
        areaId,
        location.trim(),
        description.trim(),
        onset.toISOString(),
        expiry.toISOString(),
        source.trim(),
        sourceUrl.trim(),
        isDemo,
      ],
    );
    let sms = { configured: smsAlertsConfigured(), sent: 0, failed: 0 };
    try {
      sms = await sendHazardSms(result.rows[0], areaId);
    } catch (error) {
      console.error("Hazard was saved but SMS delivery failed:", error.message);
      sms = { configured: smsAlertsConfigured(), sent: 0, failed: 1 };
    }
    return res.status(201).json({ ...result.rows[0], sms });
  } catch (error) {
    console.error("Unable to save hazard:", error.message);
    return res.status(503).json({
      error: "Hazard report could not be saved. Check the database connection.",
    });
  }
});

app.delete("/api/hazards/:id", requireOfficer, async (req, res) => {
  const hazardId = req.params.id;
  if (!/^\d{1,18}$/.test(hazardId))
    return res.status(400).json({ error: "Invalid hazard ID." });

  try {
    const result = await pool.query(
      "DELETE FROM hazards WHERE id = $1 AND created_by = $2 RETURNING id",
      [hazardId, req.officer],
    );
    if (result.rowCount === 0)
      return res
        .status(404)
        .json({ error: "Hazard not found or you do not own it." });
    return res.json({ deleted: true, id: String(result.rows[0].id) });
  } catch (error) {
    console.error("Unable to delete officer hazard:", error.message);
    return res
      .status(503)
      .json({ error: "Could not delete this hazard report." });
  }
});

async function start() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hazards (
        id BIGSERIAL PRIMARY KEY,
        hazard VARCHAR(80) NOT NULL,
        location VARCHAR(120) NOT NULL,
        description VARCHAR(500) NOT NULL,
        severity VARCHAR(32) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
        longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
        created_by VARCHAR(120) NOT NULL,
        area_id VARCHAR(16) NOT NULL DEFAULT 'kerala'
          CHECK (area_id IN ('kerala', 'wayanad')),
        affected_zone VARCHAR(120),
        alert_text TEXT,
        onset_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        source VARCHAR(160),
        source_url VARCHAR(500),
        is_demo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      ALTER TABLE hazards
        ADD COLUMN IF NOT EXISTS area_id VARCHAR(16) NOT NULL DEFAULT 'kerala',
        ADD COLUMN IF NOT EXISTS affected_zone VARCHAR(120),
        ADD COLUMN IF NOT EXISTS alert_text TEXT,
        ADD COLUMN IF NOT EXISTS onset_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS source VARCHAR(160),
        ADD COLUMN IF NOT EXISTS source_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT TRUE
    `);
    await pool.query(
      "ALTER TABLE hazards ALTER COLUMN severity TYPE VARCHAR(32), ALTER COLUMN description TYPE TEXT",
    );
    await pool.query(
      "ALTER TABLE hazards DROP CONSTRAINT IF EXISTS hazards_severity_check",
    );
    await pool.query(`
      UPDATE hazards SET severity = CASE severity
        WHEN 'Low' THEN 'Information (blue)'
        WHEN 'Moderate' THEN 'Advisory (yellow)'
        WHEN 'High' THEN 'Warning (orange)'
        WHEN 'Severe' THEN 'Danger (red)'
        ELSE severity
      END
      WHERE severity IN ('Low', 'Moderate', 'High', 'Severe')
    `);
    await pool.query(`
      ALTER TABLE hazards ADD CONSTRAINT hazards_severity_check
      CHECK (severity IN ('Danger (red)', 'Warning (orange)', 'Advisory (yellow)', 'Information (blue)'))
    `);
    await pool.query(`
      UPDATE hazards SET affected_zone = COALESCE(affected_zone, location),
                          alert_text = COALESCE(alert_text, description)
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS officer_accounts (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(32) NOT NULL UNIQUE,
        password_hash VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(
      "ALTER TABLE officer_accounts ADD COLUMN IF NOT EXISTS email VARCHAR(254)",
    );
    await pool.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS officer_accounts_email_unique ON officer_accounts (email) WHERE email IS NOT NULL",
    );
    await pool.query(`
      CREATE TABLE IF NOT EXISTS officer_registration_otps (
        email VARCHAR(254) PRIMARY KEY,
        username VARCHAR(32) NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        otp_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_sent_at TIMESTAMPTZ NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tourist_help_actions (
        id UUID PRIMARY KEY,
        action VARCHAR(16) NOT NULL CHECK (action IN ('safe', 'help', 'callback')),
        area_id VARCHAR(16) NOT NULL CHECK (area_id IN ('kerala', 'wayanad')),
        created_at TIMESTAMPTZ NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tourist_sms_subscriptions (
        phone_e164 VARCHAR(16) NOT NULL,
        area_id VARCHAR(16) NOT NULL CHECK (area_id IN ('kerala', 'wayanad')),
        language VARCHAR(2) NOT NULL CHECK (language IN ('en', 'hi', 'ml', 'nl')),
        consented_at TIMESTAMPTZ NOT NULL,
        verified_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (phone_e164, area_id)
      )
    `);
    await pool.query(
      "CREATE INDEX IF NOT EXISTS tourist_sms_subscriptions_area_idx ON tourist_sms_subscriptions (area_id)",
    );
    await pool.query(
      "ALTER TABLE tourist_help_actions ALTER COLUMN action TYPE VARCHAR(16)",
    );
    await pool.query(
      "ALTER TABLE tourist_help_actions DROP CONSTRAINT IF EXISTS tourist_help_actions_action_check",
    );
    await pool.query(
      "ALTER TABLE tourist_help_actions ADD CONSTRAINT tourist_help_actions_action_check CHECK (action IN ('safe', 'help', 'callback'))",
    );
    console.log("PostgreSQL hazard table is ready.");
  } catch (error) {
    console.error("PostgreSQL is not available yet:", error.message);
  }
  app.listen(port, () =>
    console.log(`Wayfinder API listening on port ${port}.`),
  );
}

start();
