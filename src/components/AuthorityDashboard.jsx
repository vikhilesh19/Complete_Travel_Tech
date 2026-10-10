import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock3,
  Plus,
  Road,
  ShieldAlert,
  Users,
} from "lucide-react";
import "./AuthorityDashboard.css";

function AuthorityDashboard({ place, helpRequests, onNotice }) {
  const [hazard, setHazard] = useState("Flood");
  const [roadReviewed, setRoadReviewed] = useState(false);
  const [resolved, setResolved] = useState([]);
  const [createdAlerts, setCreatedAlerts] = useState([]);

  function createDemoAlert(event) {
    event.preventDefault();
    const alert = {
      id: Date.now(),
      hazard,
      place: place.name,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setCreatedAlerts((current) => [alert, ...current]);
    onNotice("DEMO ALERT created in this browser session only.");
  }

  function markAnswered(id) {
    setResolved((current) => [...current, id]);
    onNotice("Request marked answered in this browser session only.");
  }

  const openRequests = helpRequests.filter(
    (request) => !resolved.includes(request.id),
  );
  return (
    <main className="authority-page">
      <section className="authority-heading">
        <div>
          <p className="eyebrow">OPERATIONS · {place.name.toUpperCase()}</p>
          <h1>Authority console</h1>
          <p>Local controls for the hackathon scenario.</p>
        </div>
        <span className="console-status">
          <span /> DEMO MODE
        </span>
      </section>
      <div className="authority-warning">
        <ShieldAlert size={17} />
        <div>
          <strong>Not connected to an authority account or backend.</strong>
          <span>
            {" "}
            Nothing here is broadcast, persisted, or verified. Use only for the
            demo.
          </span>
        </div>
      </div>
      <section className="authority-metrics">
        <div className="metric-box">
          <span className="metric-icon metric-alert">
            <AlertTriangle size={16} />
          </span>
          <div>
            <strong>{createdAlerts.length + 1}</strong>
            <small>Scenario alerts</small>
          </div>
          <span className="metric-foot">DEMO</span>
        </div>
        <div className="metric-box">
          <span className="metric-icon metric-help">
            <Users size={16} />
          </span>
          <div>
            <strong>{openRequests.length}</strong>
            <small>Local help requests</small>
          </div>
        </div>
        <div className="metric-box">
          <span className="metric-icon metric-road">
            <Road size={16} />
          </span>
          <div>
            <strong>{roadReviewed ? "Reviewed*" : "Unverified"}</strong>
            <small>Illustrative road report</small>
          </div>
        </div>
      </section>
      <section className="authority-grid">
        <div className="authority-column">
          <section className="authority-panel create-panel">
            <div className="authority-panel-title">
              <div>
                <p className="eyebrow">BROADCAST TOOL</p>
                <h2>Create a scenario alert</h2>
              </div>
              <span className="demo-tag">DEMO ONLY</span>
            </div>
            <p className="authority-copy">
              Creates a local example for walkthroughs. No tourists are
              notified.
            </p>
            <form className="demo-alert-form" onSubmit={createDemoAlert}>
              <label htmlFor="scenario-hazard">Hazard type</label>
              <select
                id="scenario-hazard"
                value={hazard}
                onChange={(event) => setHazard(event.target.value)}
              >
                <option>Flood</option>
                <option>Cyclone</option>
                <option>Landslide</option>
                <option>Other</option>
              </select>
              <button type="submit">
                <Plus size={15} /> Create DEMO ALERT
              </button>
            </form>
          </section>
          <section className="authority-panel road-editor">
            <div className="authority-panel-title">
              <div>
                <p className="eyebrow">ROAD STATUS</p>
                <h2>Reported route</h2>
              </div>
              <Road size={18} />
            </div>
            <div className="road-report">
              <div>
                <strong>{place.road}</strong>
                <p>
                  <Clock3 size={12} /> Illustrative report · no source
                  verification
                </p>
              </div>
              <span
                className={`review-state ${roadReviewed ? "reviewed" : ""}`}
              >
                {roadReviewed ? "DEMO: REVIEWED" : "UNVERIFIED"}
              </span>
            </div>
            <button
              className="review-road-button"
              onClick={() => {
                setRoadReviewed((current) => !current);
                onNotice("Road review state changed in demo only.");
              }}
            >
              {roadReviewed ? (
                <>
                  <Check size={14} /> Undo demo review
                </>
              ) : (
                <>
                  <Check size={14} /> Mark reviewed (demo)
                </>
              )}
            </button>
            <p className="inline-disclaimer">
              This control does not confirm actual road conditions.
            </p>
          </section>
          {createdAlerts.length > 0 && (
            <section className="authority-panel created-list">
              <div className="authority-panel-title">
                <div>
                  <p className="eyebrow">THIS SESSION</p>
                  <h2>Created demo alerts</h2>
                </div>
              </div>
              {createdAlerts.map((alert) => (
                <div className="created-alert" key={alert.id}>
                  <span className="demo-tag">DEMO ALERT</span>
                  <strong>
                    {alert.hazard} · {alert.place}
                  </strong>
                  <small>{alert.time} · local only</small>
                </div>
              ))}
            </section>
          )}
        </div>
        <section className="authority-panel queue-panel">
          <div className="authority-panel-title">
            <div>
              <p className="eyebrow">TOURIST ASSISTANCE</p>
              <h2>Help request queue</h2>
            </div>
            <span className="queue-count">{openRequests.length}</span>
          </div>
          {openRequests.length === 0 ? (
            <div className="empty-queue">
              <span>
                <Users size={19} />
              </span>
              <strong>No local requests yet</strong>
              <p>Tourist demo actions appear here in this browser session.</p>
            </div>
          ) : (
            <div className="request-list">
              {openRequests.map((request) => (
                <article className="request-row" key={request.id}>
                  <div className="request-row-top">
                    <span className="request-type">
                      {request.type === "safe"
                        ? "MARKED SAFE"
                        : request.type === "callback"
                          ? "CALLBACK"
                          : "NEEDS HELP"}
                    </span>
                    <span className="request-time">{request.createdAt}</span>
                  </div>
                  <strong>{request.place}</strong>
                  <p>{request.status}</p>
                  <button onClick={() => markAnswered(request.id)}>
                    <Check size={13} /> Mark answered locally
                  </button>
                </article>
              ))}
            </div>
          )}
          <div className="queue-footnote">
            <ArrowUpRight size={13} /> No names, phone numbers, or precise
            locations are collected.
          </div>
        </section>
      </section>
      <div className="authority-footer-note">
        <span>DEMO CONSOLE</span> A real deployment needs server-side official
        authentication, Supabase persistence, authorization checks, and an audit
        log.
      </div>
    </main>
  );
}

export default AuthorityDashboard;
