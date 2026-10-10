import { useState } from "react";
import { ArrowUpRight, Info, MessageCircleQuestion } from "lucide-react";
import "./AskSafety.css";

function AskSafety({ placeName, t, offline = false, snapshot = null }) {
  const text = t || {
    eyebrow: "ASK ABOUT YOUR AREA",
    heading: "Is this safe?",
    prompt:
      "Ask about conditions near {place}. Answers use official alert data only.",
    ariaLabel: "Ask a safety question",
    placeholder: "e.g. Is it safe to travel to the coast?",
    submitTitle: "Submit question",
    noInfo:
      "No official information yet for this area. Follow local authority instructions.",
    subInfo:
      "No official alert service is connected in this demo. Demo scenarios are not used to answer safety questions.",
  };

  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [offlineAnswer, setOfflineAnswer] = useState(null);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    setSubmittedQuestion(trimmedQuestion);
    if (!offline) {
      setOfflineAnswer(null);
      setQuestion("");
      return;
    }

    const savedAt = snapshot?.hazards?.savedAt || snapshot?.savedAt;
    const officialHazards = (snapshot?.hazards?.data || []).filter(
      (hazard) =>
        hazard.is_demo === false &&
        Number.isFinite(Date.parse(hazard.expires_at)) &&
        Date.parse(hazard.expires_at) > Date.now(),
    );
    if (!savedAt || officialHazards.length === 0) {
      setOfflineAnswer({
        message:
          "No official information yet for this area. Follow local authority instructions.",
      });
    } else {
      setOfflineAnswer({ savedAt, hazards: officialHazards });
    }
    setQuestion("");
  }

  const promptText = text.prompt.replace("{place}", placeName);

  return (
    <section className="ask-safety-panel">
      <div className="ask-safety-heading">
        <span className="ask-icon">
          <MessageCircleQuestion size={18} />
        </span>
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2>{text.heading}</h2>
        </div>
      </div>
      <div className="ask-safety-content">
        <p>{promptText}</p>
        <form className="ask-safety-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="safety-question">
            {text.ariaLabel}
          </label>
          <input
            id="safety-question"
            maxLength={240}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={text.placeholder}
          />
          <button
            type="submit"
            aria-label={text.ariaLabel}
            title={text.submitTitle}
          >
            <ArrowUpRight size={17} />
          </button>
        </form>
        <div className="ask-safety-answer" aria-live="polite">
          <span className="answer-info">
            <Info size={14} />
          </span>
          <div>
            {submittedQuestion && (
              <p className="asked-question">“{submittedQuestion}”</p>
            )}
            {offline && offlineAnswer?.hazards ? (
              <div className="offline-safety-results">
                <strong>
                  Saved official hazard information found. Offline data cannot
                  confirm current conditions or that travel is safe.
                </strong>
                {offlineAnswer.hazards.map((hazard) => (
                  <article key={hazard.id}>
                    <b>
                      {hazard.hazard} · {hazard.severity}
                    </b>
                    <p>{hazard.alert_text || hazard.description}</p>
                    <small>
                      {hazard.affected_zone || hazard.location} · Source:{" "}
                      {hazard.source || "Not specified"}
                    </small>
                    {hazard.source_url && (
                      <a
                        href={hazard.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {hazard.source_url}
                      </a>
                    )}
                  </article>
                ))}
                <small>
                  Saved at {new Date(offlineAnswer.savedAt).toLocaleString()}.
                </small>
              </div>
            ) : (
              <>
                <strong>
                  {offline && offlineAnswer?.message
                    ? offlineAnswer.message
                    : text.noInfo}
                </strong>
                <small>
                  {offline
                    ? "No saved, unexpired official hazard reports are available for rule-based checking."
                    : text.subInfo}
                </small>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default AskSafety;
