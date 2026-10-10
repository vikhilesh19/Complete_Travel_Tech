import { useState } from "react";
import { ArrowUpRight, Info, MessageCircleQuestion } from "lucide-react";
import "./AskSafety.css";

const noOfficialInformation =
  "No official information yet for this area. Follow local authority instructions.";

function AskSafety({ placeName }) {
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    setSubmittedQuestion(trimmedQuestion);
    setQuestion("");
  }

  return (
    <section className="ask-safety-panel">
      <div className="ask-safety-heading">
        <span className="ask-icon">
          <MessageCircleQuestion size={18} />
        </span>
        <div>
          <p className="eyebrow">ASK ABOUT YOUR AREA</p>
          <h2>Is this safe?</h2>
        </div>
      </div>
      <div className="ask-safety-content">
        <p>
          Ask about conditions near {placeName}. Answers use official alert data
          only.
        </p>
        <form className="ask-safety-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="safety-question">
            Ask a safety question
          </label>
          <input
            id="safety-question"
            maxLength={240}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="e.g. Is it safe to travel to the coast?"
          />
          <button
            type="submit"
            aria-label="Submit safety question"
            title="Submit question"
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
            <strong>{noOfficialInformation}</strong>
            <small>
              No official alert service is connected in this demo. Demo
              scenarios are not used to answer safety questions.
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AskSafety;
