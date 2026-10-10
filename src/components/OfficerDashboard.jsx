import { useEffect, useState } from "react";
import {
  AlertTriangle,
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
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

function OfficerDashboard({ place, hazards, onHazardAdded, onNotice }) {
  const [officer, setOfficer] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
    email: "",
  });
  const [report, setReport] = useState({
    hazard: "Flooding",
    location: place.shortName,
    description: "",
    severity: "Moderate",
    latitude: place.coords[0],
    longitude: place.coords[1],
  });

  useEffect(() => {
    let mounted = true;
    fetch("/api/officer/session")
      .then((response) => response.json())
      .then((data) => {
        if (mounted && data.authenticated) setOfficer(data.username);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setCheckingSession(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function authenticate(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const isRegistration = authMode === "register";
      if (isRegistration && !otpSent) {
        const response = await fetch("/api/officer/register/send-otp", {
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
      const response = await fetch(
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
    await fetch("/api/officer/logout", { method: "POST" });
    setOfficer(null);
  }

  async function submitHazard(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/hazards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      const data = await readApiResponse(response);
      if (!response.ok)
        throw new Error(data.error || "Hazard report could not be saved.");
      onHazardAdded(data);
      setReport((current) => ({ ...current, description: "" }));
      onNotice("Hazard report saved and shared with travelers.");
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
              <label htmlFor="report-hazard">Hazard type</label>
              <input
                id="report-hazard"
                maxLength="80"
                required
                value={report.hazard}
                onChange={(event) =>
                  setReport({ ...report, hazard: event.target.value })
                }
              />
              <label htmlFor="report-location">Place or area</label>
              <input
                id="report-location"
                maxLength="120"
                required
                value={report.location}
                onChange={(event) =>
                  setReport({ ...report, location: event.target.value })
                }
              />
              <label htmlFor="report-description">Short description</label>
              <textarea
                id="report-description"
                maxLength="500"
                minLength="3"
                required
                rows="3"
                value={report.description}
                onChange={(event) =>
                  setReport({ ...report, description: event.target.value })
                }
                placeholder="What is happening, and what should travelers know?"
              />
              <label htmlFor="report-severity">Severity</label>
              <select
                id="report-severity"
                value={report.severity}
                onChange={(event) =>
                  setReport({ ...report, severity: event.target.value })
                }
              >
                <option>Low</option>
                <option>Moderate</option>
                <option>High</option>
                <option>Severe</option>
              </select>
              <span className="coordinate-label">
                <MapPin size={14} /> Map coordinates
              </span>
              <div className="coordinate-inputs">
                <label htmlFor="report-latitude">Latitude</label>
                <input
                  id="report-latitude"
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  required
                  value={report.latitude}
                  onChange={(event) =>
                    setReport({ ...report, latitude: event.target.value })
                  }
                />
                <label htmlFor="report-longitude">Longitude</label>
                <input
                  id="report-longitude"
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  required
                  value={report.longitude}
                  onChange={(event) =>
                    setReport({ ...report, longitude: event.target.value })
                  }
                />
              </div>
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
                  <div>
                    <strong>
                      {hazard.hazard} · {hazard.location}
                    </strong>
                    <p>{hazard.description}</p>
                  </div>
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
