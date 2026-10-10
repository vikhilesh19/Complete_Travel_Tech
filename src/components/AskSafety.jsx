import { useState } from "react";
import { ArrowUpRight, Info, MessageCircleQuestion } from "lucide-react";
import "./AskSafety.css";

function AskSafety({ placeName, t }) {
  const text = t || {
    eyebrow: "ASK ABOUT YOUR AREA",
    heading: "Is this safe?",
    prompt: "Ask about conditions near {place}. Answers use official alert data only.",
    ariaLabel: "Ask a safety question",
    placeholder: "e.g. Is it safe to travel to the coast?",
    submitTitle: "Submit question",
    noInfo: "No official information yet for this area. Follow local authority instructions.",
    subInfo: "No official alert service is connected in this demo. Demo scenarios are not used to answer safety questions.",
  };

  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    setSubmittedQuestion(trimmedQuestion);
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
            <strong>{text.noInfo}</strong>
            <small>{text.subInfo}</small>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AskSafety;
