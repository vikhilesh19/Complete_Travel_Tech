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
const sessionLifetimeSeconds = 8 * 60 * 60;
const sessionCookieName = "wayfinder_officer";

app.use(express.json({ limit: "16kb" }));

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

function setSessionCookie(res, username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expiresAt: Date.now() + sessionLifetimeSeconds * 1000,
    }),
  ).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
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
    return res
      .status(503)
      .json({
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
      return res
        .status(429)
        .json({
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
      return res
        .status(503)
        .json({
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
      return res
        .status(400)
        .json({
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
      return res
        .status(400)
        .json({
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

app.get("/api/hazards", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, hazard, location, description, severity, latitude, longitude, created_at
       FROM hazards ORDER BY created_at DESC`,
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
  const { hazard, location, description, severity, latitude, longitude } =
    req.body || {};
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    typeof hazard !== "string" ||
    hazard.trim().length < 2 ||
    hazard.length > 80 ||
    typeof location !== "string" ||
    location.trim().length < 2 ||
    location.length > 120 ||
    typeof description !== "string" ||
    description.trim().length < 3 ||
    description.length > 500 ||
    !["Low", "Moderate", "High", "Severe"].includes(severity) ||
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
      `INSERT INTO hazards (hazard, location, description, severity, latitude, longitude, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, hazard, location, description, severity, latitude, longitude, created_at`,
      [
        hazard.trim(),
        location.trim(),
        description.trim(),
        severity,
        lat,
        lon,
        req.officer,
      ],
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Unable to save hazard:", error.message);
    return res.status(503).json({
      error: "Hazard report could not be saved. Check the database connection.",
    });
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
        severity VARCHAR(16) NOT NULL CHECK (severity IN ('Low', 'Moderate', 'High', 'Severe')),
        latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
        longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
        created_by VARCHAR(120) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
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
    console.log("PostgreSQL hazard table is ready.");
  } catch (error) {
    console.error("PostgreSQL is not available yet:", error.message);
  }
  app.listen(port, () =>
    console.log(`Wayfinder API listening on port ${port}.`),
  );
}

start();
