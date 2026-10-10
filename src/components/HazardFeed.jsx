import { useEffect, useState } from "react";
import { AlertTriangle, Clock3, MapPin } from "lucide-react";
import { translateAlert } from "../translateAlert.js";
import "./HazardFeed.css";

const localeByLanguage = { en: "en-IN", hi: "hi-IN", ml: "ml-IN", nl: "nl-NL" };

function HazardReportCard({ report, lang, text }) {
  const [translationResults, setTranslationResults] = useState({});
  const translationKey = `${lang}:${report.id}`;
  const translationResult = translationResults[translationKey];

  useEffect(() => {
    if (lang === "en" || !report.alert_text) {
      return undefined;
    }
    if (translationResults[translationKey]) return undefined;

    let active = true;
    translateAlert(report.alert_text, lang)
      .then((translatedText) => {
        if (active) {
          setTranslationResults((current) => ({
            ...current,
            [translationKey]: { text: translatedText },
          }));
        }
      })
      .catch(() => {
        if (active) {
          setTranslationResults((current) => ({
            ...current,
            [translationKey]: { error: true },
          }));
        }
      });
    return () => {
      active = false;
    };
  }, [lang, report.alert_text, translationKey, translationResults]);

  const severityKey = report.severity.toLowerCase().split(" ")[0];
  const severityLabel = text.severities[severityKey] || report.severity;
  const hazardLabel = text.hazards[report.hazard] || report.hazard;
  const reportDateLocale = localeByLanguage[lang] || "en-IN";
  const bulletinText =
    lang === "en"
      ? report.alert_text || report.description
      : translationResult?.text;
  const translationState =
    lang === "en"
      ? "ready"
      : translationResult?.error
        ? "unavailable"
        : translationResult?.text
          ? "ready"
          : "loading";

  return (
    <article className="hazard-report">
      <div className="hazard-report-title">
        <span className={`hazard-severity hazard-severity-${severityKey}`}>
          <AlertTriangle size={14} /> {severityLabel}
        </span>
        <span
          className={`hazard-report-source ${report.is_demo ? "is-demo" : "is-official"}`}
        >
          {report.is_demo ? text.demo : text.official}
        </span>
      </div>
      <h3>{hazardLabel}</h3>
      <p className="hazard-report-location">
        <MapPin size={13} /> {report.affected_zone || report.location}
      </p>
      <p className="hazard-report-description">
        {translationState === "loading"
          ? text.translating
          : bulletinText || report.alert_text || report.description}
      </p>
      {lang !== "en" &&
        translationState === "ready" &&
        translationResult?.text && (
          <p className="hazard-translation-note">
            {text.machineTranslationNote}
          </p>
        )}
      {lang !== "en" && translationState === "unavailable" && (
        <p className="hazard-translation-note">{text.translationUnavailable}</p>
      )}
      {lang !== "en" && report.alert_text && (
        <details className="hazard-original-text">
          <summary>{text.originalText}</summary>
          <p>{report.alert_text}</p>
        </details>
      )}
      <div className="hazard-report-dates">
        <span>
          <strong>{text.expectedOnset}</strong>
          {report.onset_at
            ? new Date(report.onset_at).toLocaleString(reportDateLocale)
            : text.notSpecified}
        </span>
        <span>
          <strong>{text.expires}</strong>
          {report.expires_at
            ? new Date(report.expires_at).toLocaleString(reportDateLocale)
            : text.notSpecified}
        </span>
      </div>
      <div className="hazard-report-attribution">
        <span>
          <strong>{text.source}</strong>
          {report.source || "Officer report"}
        </span>
        {report.source_url && (
          <a href={report.source_url} target="_blank" rel="noreferrer">
            {text.viewSource}
          </a>
        )}
      </div>
      <div className="hazard-report-time">
        <Clock3 size={12} /> {text.published}{" "}
        {new Date(report.created_at).toLocaleString(reportDateLocale)}
      </div>
    </article>
  );
}

function HazardFeed({ hazards, loading, error, lang = "en", text }) {
  return (
    <section
      className="hazard-feed"
      aria-label="Officer-submitted hazard reports"
    >
      <div className="hazard-feed-heading">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2>{text.heading}</h2>
        </div>
        <span className="hazard-feed-count">
          {hazards.length} {text.reportCount}
        </span>
      </div>
      {loading ? (
        <p className="hazard-feed-empty">{text.loading}</p>
      ) : error ? (
        <p className="hazard-feed-empty" role="status">
          {text.unavailable}
        </p>
      ) : hazards.length === 0 ? (
        <p className="hazard-feed-empty">{text.empty}</p>
      ) : (
        <div className="hazard-feed-list">
          {hazards.map((report) => (
            <HazardReportCard
              key={report.id}
              report={report}
              lang={lang}
              text={text}
            />
          ))}
        </div>
      )}
      <p className="hazard-feed-disclaimer">{text.disclaimer}</p>
    </section>
  );
}

export default HazardFeed;
