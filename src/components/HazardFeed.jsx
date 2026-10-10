import { AlertTriangle, Clock3, MapPin } from "lucide-react";
import "./HazardFeed.css";

function HazardFeed({ hazards, loading, error }) {
  return (
    <section
      className="hazard-feed"
      aria-label="Officer-submitted hazard reports"
    >
      <div className="hazard-feed-heading">
        <div>
          <p className="eyebrow">SHARED FIELD REPORTS</p>
          <h2>Hazards reported by officers</h2>
        </div>
        <span className="hazard-feed-count">{hazards.length} reports</span>
      </div>
      {loading ? (
        <p className="hazard-feed-empty">Loading shared reports…</p>
      ) : error ? (
        <p className="hazard-feed-empty" role="status">
          {error}
        </p>
      ) : hazards.length === 0 ? (
        <p className="hazard-feed-empty">
          No officer hazard reports have been published.
        </p>
      ) : (
        <div className="hazard-feed-list">
          {hazards.map((report) => (
            <article className="hazard-report" key={report.id}>
              <div className="hazard-report-title">
                <span
                  className={`hazard-severity hazard-severity-${report.severity.toLowerCase()}`}
                >
                  <AlertTriangle size={14} /> {report.severity}
                </span>
                <span className="hazard-report-source">OFFICER REPORT</span>
              </div>
              <h3>{report.hazard}</h3>
              <p className="hazard-report-location">
                <MapPin size={13} /> {report.location}
              </p>
              <p className="hazard-report-description">{report.description}</p>
              <div className="hazard-report-time">
                <Clock3 size={12} />{" "}
                {new Date(report.created_at).toLocaleString()}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="hazard-feed-disclaimer">
        Officer-submitted reports are shared information, not independently
        verified emergency alerts.
      </p>
    </section>
  );
}

export default HazardFeed;
