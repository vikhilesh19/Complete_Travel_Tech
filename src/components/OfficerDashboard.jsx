import { useEffect, useState } from "react";
import { apiFetch } from "../api.js";
import {
  AlertTriangle,
  Check,
  LogIn,
  LogOut,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import "./OfficerDashboard.css";

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    if (
      body.trimStart().startsWith("<!doctype html") ||
      body.trimStart().startsWith("<html")
    ) {
      throw new Error(
        "The API server did not answer this request. Restart the app with npm run dev.",
      );
    }
    throw new Error(
      "The server returned an unexpected response. Check that the API is running.",
    );
  }
  return response.json();
}

function OfficerDashboard({
  place,
  hazards,
  onHazardAdded,
  onHazardDeleted,
  onNotice,
}) {
  const [officer, setOfficer] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [helpQueue, setHelpQueue] = useState([]);
  const [helpQueueError, setHelpQueueError] = useState("");
  const [sortingRequestId, setSortingRequestId] = useState(null);
  const [ownedHazardIds, setOwnedHazardIds] = useState(() => new Set());
  const [deletingHazardId, setDeletingHazardId] = useState(null);
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    email: "",
  });
  const [report, setReport] = useState({
    hazard: "Cyclone",
    severity: "Danger (red)",
    affectedZone: "",
    alertText: "",
    onsetAt: "",
    expiresAt: "",
    source: "Kerala State Disaster Management Authority",
    sourceUrl: "https://sdma.kerala.gov.in",
    isDemo: true,
    latitude: place.coords[0],
    longitude: place.coords[1],
  });

  const zoneOptions = [
    {
      name: `${place.keralaName || "Kerala coast"} · Kochi`,
      coords: [9.9312, 76.2673],
      areaId: "kerala",
    },
    {
      name: `${place.keralaName || "Kerala coast"} · Alappuzha`,
      coords: [9.4981, 76.3388],
      areaId: "kerala",
    },
    {
      name: `${place.wayanadName || "Wayanad hills"} · Meppadi`,
      coords: [11.5544, 76.132],
      areaId: "wayanad",
    },
    {
      name: `${place.wayanadName || "Wayanad hills"} · Mananthavady`,
      coords: [11.8009, 75.9996],
      areaId: "wayanad",
    },
  ];

  async function fetchOwnedHazardIds() {
    const response = await apiFetch("/api/officer/hazards");
    const data = await readApiResponse(response);
    if (!response.ok)
      throw new Error(data.error || "Could not load your hazard reports.");
    return new Set(data.map(String));
  }

  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      try {
        const response = await apiFetch("/api/officer/session");
        const data = await readApiResponse(response);
        if (!mounted || !data.authenticated) return;
        setOfficer(data.username);
        try {
          const hazardIds = await fetchOwnedHazardIds();
          if (mounted) setOwnedHazardIds(hazardIds);
        } catch {
          if (mounted) setError("Could not load your hazard ownership. Refresh to retry.");
        }
      } catch {
        return;
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }
    checkSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!officer) return undefined;

    let active = true;
    async function loadHelpQueue() {
      try {
        const response = await apiFetch("/api/officer/help-queue");
        const data = await readApiResponse(response);
        if (!response.ok)
          throw new Error(data.error || "Could not load help queue.");
        if (active) {
          setHelpQueue(data);
          setHelpQueueError("");
        }
      } catch (queueError) {
        if (active)
          setHelpQueueError(queueError.message || "Could not load help queue.");
      }
    }

    loadHelpQueue();
    const refresh = window.setInterval(loadHelpQueue, 10000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, [officer]);

  async function authenticate(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const isRegistration = authMode === "register";
      if (isRegistration && !otpSent) {
        const response = await apiFetch("/api/officer/register/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });
        const data = await readApiResponse(response);
        if (!response.ok)
          throw new Error(data.error || "Could not send verification code.");
        setOtpSent(true);
        onNotice("Verification code sent. Check your email.");
        return;
      }
      const response = await apiFetch(
        isRegistration ? "/api/officer/register" : "/api/officer/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isRegistration ? { email: credentials.email, otp } : credentials,
          ),
        },
      );
      const data = await readApiResponse(response);
      if (!response.ok)
        throw new Error(
          data.error ||
            (isRegistration ? "Registration failed." : "Sign-in failed."),
        );
      setOfficer(data.username);
      try {
        setOwnedHazardIds(await fetchOwnedHazardIds());
      } catch {
        setOwnedHazardIds(new Set());
      }
      setCredentials({ username: "", password: "", email: "" });
      setOtp("");
      setOtpSent(false);
      onNotice(
        isRegistration
          ? "Officer account created and signed in."
          : "Officer signed in.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Cannot reach the API. Make sure npm run dev is still running, then try again."
          : requestError.message || "Could not connect to the officer service.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await apiFetch("/api/officer/logout", { method: "POST" });
    setOfficer(null);
    setOwnedHazardIds(new Set());
  }

  async function deleteHazard(hazard) {
    const hazardId = String(hazard.id);
    if (!ownedHazardIds.has(hazardId) || !window.confirm(
      `Delete your ${hazard.hazard} report for ${hazard.location}? This cannot be undone.`,
    )) return;

    setDeletingHazardId(hazardId);
    setError("");
    try {
      const response = await apiFetch(`/api/hazards/${encodeURIComponent(hazardId)}`, {
        method: "DELETE",
      });
      const data = await readApiResponse(response);
      if (!response.ok)
        throw new Error(data.error || "Could not delete this hazard report.");
      setOwnedHazardIds((current) => {
        const next = new Set(current);
        next.delete(hazardId);
        return next;
      });
      onHazardDeleted(data.id);
      onNotice("Your hazard report was deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete this hazard report.");
    } finally {
      setDeletingHazardId(null);
    }
  }

  async function markRequestSorted(requestId) {
    setSortingRequestId(requestId);
    setHelpQueueError("");
    try {
      const response = await apiFetch(`/api/officer/help-queue/${requestId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await readApiResponse(response);
        throw new Error(data.error || "Could not clear this request.");
      }
      setHelpQueue((current) =>
        current.filter((request) => request.id !== requestId),
      );
    } catch (queueError) {
      setHelpQueueError(queueError.message || "Could not clear this request.");
    } finally {
      setSortingRequestId(null);
    }
  }

  async function submitHazard(event) {
    event.preventDefault();
    if (new Date(report.onsetAt) >= new Date(report.expiresAt)) {
      setError("Expiry date and time must be later than the expected onset.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/hazards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...report,
          areaId: zoneOptions.find(
            (zone) => zone.name === report.affectedZone,
          )?.areaId,
          onsetAt: new Date(report.onsetAt).toISOString(),
          expiresAt: new Date(report.expiresAt).toISOString(),
        }),
      });
      const data = await readApiResponse(response);
      if (!response.ok)
        throw new Error(data.error || "Hazard report could not be saved.");
      onHazardAdded(data);
      setOwnedHazardIds((current) => new Set([...current, String(data.id)]));
      setReport((current) => ({ ...current, description: "" }));
      const smsNotice = !data.sms?.configured
        ? "SMS notifications are not configured."
        : data.sms.sent === 0 && data.sms.failed === 0
          ? "No verified SMS subscribers are in this region."
          : `${data.sms.sent} SMS accepted by the provider; ${data.sms.failed} failed.`;
      onNotice(`Hazard report saved. ${smsNotice}`);
    } catch (requestError) {
      setError(
        requestError.message || "Could not connect to the hazard service.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="officer-page">
      <section className="officer-heading">
        <div>
          <p className="eyebrow">WAYFINDER · FIELD REPORTS</p>
          <h1>Officer access</h1>
          <p>Publish a location-based hazard report for all travelers.</p>
        </div>
        {officer && (
          <button className="officer-logout" onClick={signOut}>
            <LogOut size={15} /> Sign out
          </button>
        )}
      </section>

      {checkingSession ? (
        <section className="officer-panel officer-loading">
          Checking officer session…
        </section>
      ) : !officer ? (
        <section className="officer-panel officer-login-panel">
          <span className="officer-shield">
            <ShieldCheck size={21} />
          </span>
          <p className="eyebrow">AUTHORIZED PERSONNEL</p>
          <h2>
            {authMode === "login" ? "Officer sign in" : "Officer registration"}
          </h2>
          <p className="officer-description">
            {authMode === "login"
              ? "Sign in with an existing officer account."
              : "Verify your email address to create a new officer account."}
          </p>
          <div
            className="officer-auth-tabs"
            role="tablist"
            aria-label="Officer account access"
          >
            <button
              className={authMode === "login" ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={authMode === "login"}
              onClick={() => {
                setAuthMode("login");
                setError("");
                setOtpSent(false);
                setOtp("");
              }}
            >
              Sign in
            </button>
            <button
              className={authMode === "register" ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={authMode === "register"}
              onClick={() => {
                setAuthMode("register");
                setError("");
                setOtpSent(false);
                setOtp("");
              }}
            >
              Register
            </button>
          </div>
          <form className="officer-form" onSubmit={authenticate}>
            {authMode === "register" && (
              <>
                <label htmlFor="officer-email">Email address</label>
                <input
                  id="officer-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  disabled={otpSent}
                  value={credentials.email}
                  onChange={(event) =>
                    setCredentials({
                      ...credentials,
                      email: event.target.value,
                    })
                  }
                />
              </>
            )}
            <label htmlFor="officer-username">Username</label>
            <input
              id="officer-username"
              autoComplete="username"
              minLength={authMode === "register" ? 3 : undefined}
              maxLength={32}
              required
              disabled={otpSent}
              value={credentials.username}
              onChange={(event) =>
                setCredentials({ ...credentials, username: event.target.value })
              }
            />
            <label htmlFor="officer-password">Password</label>
            <input
              id="officer-password"
              type="password"
              autoComplete={
                authMode === "register" ? "new-password" : "current-password"
              }
              minLength={authMode === "register" ? 12 : undefined}
              maxLength={128}
              required
              disabled={otpSent}
              value={credentials.password}
              onChange={(event) =>
                setCredentials({ ...credentials, password: event.target.value })
              }
            />
            {authMode === "register" && otpSent && (
              <>
                <label htmlFor="officer-otp">
                  6-digit email verification code
                </label>
                <input
                  id="officer-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="off"
                  required
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
                <p className="officer-otp-note">
                  Code sent to {credentials.email}. It expires in 10 minutes.
                </p>
              </>
            )}
            {error && (
              <p className="officer-error" role="alert">
                {error}
              </p>
            )}
            <button className="officer-submit" type="submit" disabled={busy}>
              <LogIn size={16} />{" "}
              {busy
                ? authMode === "register"
                  ? "Creating account…"
                  : "Signing in…"
                : authMode === "register"
                  ? otpSent
                    ? "Verify code and register"
                    : "Send OTP"
                  : "Sign in as officer"}
            </button>
          </form>
        </section>
      ) : (
        <div className="officer-workspace">
          <div className="officer-session-note">
            <ShieldCheck size={17} /> Signed in as <strong>{officer}</strong>
            <span>
              Reports are saved to PostgreSQL and visible to every visitor.
            </span>
          </div>
          <section className="officer-panel officer-help-queue">
            <div className="officer-panel-heading">
              <div>
                <p className="eyebrow">TOURIST ASSISTANCE</p>
                <h2>Help requests</h2>
              </div>
              <span className="queue-count">{helpQueue.length}</span>
            </div>
            {helpQueueError ? (
              <p className="officer-error" role="status">
                {helpQueueError}
              </p>
            ) : helpQueue.length === 0 ? (
              <p className="officer-description">
                No tourist help actions have been received.
              </p>
            ) : (
              <div className="officer-help-list">
                {helpQueue.map((request) => (
                  <article className="officer-help-row" key={request.id}>
                    <div>
                      <strong>
                        {request.action === "help"
                          ? "NEEDS HELP"
                          : request.action === "callback"
                            ? "CALLBACK REQUEST"
                            : "MARKED SAFE"}
                      </strong>
                      <span>
                        {request.area_id === "wayanad"
                          ? "Wayanad hills"
                          : "Kerala coast"}
                      </span>
                    </div>
                    <time dateTime={request.created_at}>
                      {new Date(request.created_at).toLocaleString()}
                    </time>
                    <button
                      className="officer-help-sorted"
                      type="button"
                      disabled={sortingRequestId === request.id}
                      onClick={() => markRequestSorted(request.id)}
                      aria-label={`Mark ${request.action} request sorted`}
                    >
                      <Check size={14} />
                      {sortingRequestId === request.id
                        ? "Saving…"
                        : "Mark sorted"}
                    </button>
                  </article>
                ))}
              </div>
            )}
            <p className="officer-help-note">
              Actions are shared without names or precise location. This queue
              refreshes automatically.
            </p>
          </section>
          <section className="officer-panel report-panel">
            <div className="officer-panel-heading">
              <span className="report-icon">
                <AlertTriangle size={18} />
              </span>
              <div>
                <p className="eyebrow">NEW PUBLIC REPORT</p>
                <h2>Report a hazard</h2>
              </div>
            </div>
            <form className="officer-form report-form" onSubmit={submitHazard}>
              <div className="report-field">
                <label htmlFor="report-hazard">Hazard</label>
                <select
                  id="report-hazard"
                  value={report.hazard}
                  onChange={(event) =>
                    setReport({ ...report, hazard: event.target.value })
                  }
                >
                  <option>Cyclone</option>
                  <option>Flood</option>
                  <option>Landslide</option>
                  <option>Storm surge</option>
                  <option>Heat wave</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="report-field">
                <label htmlFor="report-severity">Severity</label>
                <select
                  id="report-severity"
                  value={report.severity}
                  onChange={(event) =>
                    setReport({ ...report, severity: event.target.value })
                  }
                >
                  <option>Danger (red)</option>
                  <option>Warning (orange)</option>
                  <option>Advisory (yellow)</option>
                  <option>Information (blue)</option>
                </select>
              </div>
              <div className="report-field report-full-width">
                <label htmlFor="report-zone">Affected zone</label>
                <select
                  id="report-zone"
                  required
                  value={report.affectedZone}
                  onChange={(event) => {
                    const selected = zoneOptions.find(
                      (zone) => zone.name === event.target.value,
                    );
                    setReport({
                      ...report,
                      affectedZone: event.target.value,
                      latitude: selected?.coords[0] ?? place.coords[0],
                      longitude: selected?.coords[1] ?? place.coords[1],
                    });
                  }}
                >
                  <option value="">Select a zone</option>
                  {zoneOptions.map((zone) => (
                    <option key={zone.name}>{zone.name}</option>
                  ))}
                </select>
              </div>
              <div className="report-field report-full-width">
                <label htmlFor="report-alert-text">Official alert text</label>
                <textarea
                  id="report-alert-text"
                  maxLength={5000}
                  minLength={10}
                  required
                  rows={4}
                  value={report.alertText}
                  onChange={(event) =>
                    setReport({ ...report, alertText: event.target.value })
                  }
                  placeholder="Paste the official bulletin text exactly as issued."
                />
              </div>
              <div className="report-field">
                <label htmlFor="report-onset">Expected onset</label>
                <input
                  id="report-onset"
                  type="datetime-local"
                  required
                  value={report.onsetAt}
                  onChange={(event) =>
                    setReport({ ...report, onsetAt: event.target.value })
                  }
                />
              </div>
              <div className="report-field">
                <label htmlFor="report-expires">Expires</label>
                <input
                  id="report-expires"
                  type="datetime-local"
                  required
                  value={report.expiresAt}
                  onChange={(event) =>
                    setReport({ ...report, expiresAt: event.target.value })
                  }
                />
              </div>
              <div className="report-field">
                <label htmlFor="report-source">Source</label>
                <input
                  id="report-source"
                  maxLength={160}
                  required
                  value={report.source}
                  onChange={(event) =>
                    setReport({ ...report, source: event.target.value })
                  }
                />
              </div>
              <div className="report-field">
                <label htmlFor="report-source-url">Source URL</label>
                <input
                  id="report-source-url"
                  type="url"
                  maxLength={500}
                  required
                  value={report.sourceUrl}
                  onChange={(event) =>
                    setReport({ ...report, sourceUrl: event.target.value })
                  }
                />
              </div>
              <label className="report-demo-toggle report-full-width">
                <input
                  type="checkbox"
                  checked={report.isDemo}
                  onChange={(event) =>
                    setReport({ ...report, isDemo: event.target.checked })
                  }
                />
                <span>
                  <strong>Demo alert</strong>
                  <small>
                    Shown to travelers with a “DEMO ALERT” label. Uncheck only
                    for real official alerts.
                  </small>
                </span>
              </label>
              <input type="hidden" value={report.latitude} readOnly />
              <input type="hidden" value={report.longitude} readOnly />
              {error && (
                <p className="officer-error" role="alert">
                  {error}
                </p>
              )}
              <p className="officer-disclaimer">
                Traveler reports are officer-submitted information, not an
                automated official alert.
              </p>
              <button className="officer-submit" type="submit" disabled={busy}>
                <AlertTriangle size={16} />{" "}
                {busy ? "Saving report…" : "Publish hazard report"}
              </button>
            </form>
          </section>
          <section className="officer-panel officer-recent">
            <p className="eyebrow">DATABASE FEED</p>
            <h2>
              Recent shared reports <span>{hazards.length}</span>
            </h2>
            {hazards.length === 0 ? (
              <p className="officer-description">
                No hazard reports have been published.
              </p>
            ) : (
              hazards.slice(0, 5).map((hazard) => (
                <article className="officer-recent-row" key={hazard.id}>
                  <span
                    className={`severity-dot severity-${hazard.severity.toLowerCase()}`}
                  />
                  <div className="officer-recent-copy">
                    <strong>
                      {hazard.hazard} · {hazard.location}
                    </strong>
                    <p>{hazard.description}</p>
                  </div>
                  {ownedHazardIds.has(String(hazard.id)) && (
                    <button
                      className="officer-hazard-delete"
                      type="button"
                      disabled={deletingHazardId === String(hazard.id)}
                      onClick={() => deleteHazard(hazard)}
                      aria-label={`Delete your ${hazard.hazard} report for ${hazard.location}`}
                    >
                      <Trash2 size={14} />
                      {deletingHazardId === String(hazard.id)
                        ? "Deleting…"
                        : "Delete"}
                    </button>
                  )}
                </article>
              ))
            )}
          </section>
        </div>
      )}
      <p className="officer-footnote">
        Use reports to inform travelers. Verify conditions with local emergency
        authorities before acting.
      </p>
    </main>
  );
}

export default OfficerDashboard;
