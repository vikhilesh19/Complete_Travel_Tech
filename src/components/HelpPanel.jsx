import { Check, LifeBuoy, Phone, Radio, ShieldCheck } from "lucide-react";
import "./HelpPanel.css";

function HelpPanel({ onSend, t }) {
  const text = t || {
    eyebrow: "QUICK RESPONSE",
    heading: "Let someone know",
    intro: "These actions stay on this device in the demo. No location is shared.",
    imSafe: "I’m safe",
    imSafeSub: "Mark yourself as safe",
    needHelp: "I need help",
    needHelpSub: "Send a help request",
    callback: "Request a callback",
    callbackSub: "Ask an operator to contact you",
    callEmergency: "Call India emergency services",
    emergencyNumber: "112",
    caveat: "For immediate danger, call 112 directly. Demo requests are not sent to responders.",
  };

  return (
    <section className="help-panel">
      <div className="help-panel-heading">
        <span className="help-mark">
          <LifeBuoy size={18} />
        </span>
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2>{text.heading}</h2>
        </div>
      </div>
      <p className="help-intro">{text.intro}</p>
      <div className="help-actions">
        <button
          className="help-action safe-action"
          onClick={() => onSend("safe")}
        >
          <span>
            <ShieldCheck size={16} />
          </span>
          <span>
            <strong>{text.imSafe}</strong>
            <small>{text.imSafeSub}</small>
          </span>
          <Check className="action-arrow" size={15} />
        </button>
        <button
          className="help-action need-help-action"
          onClick={() => onSend("help")}
        >
          <span>
            <Radio size={16} />
          </span>
          <span>
            <strong>{text.needHelp}</strong>
            <small>{text.needHelpSub}</small>
          </span>
          <span className="action-arrow">›</span>
        </button>
        <button
          className="help-action callback-action"
          onClick={() => onSend("callback")}
        >
          <span>
            <Phone size={15} />
          </span>
          <span>
            <strong>{text.callback}</strong>
            <small>{text.callbackSub}</small>
          </span>
          <span className="action-arrow">›</span>
        </button>
      </div>
      <a className="emergency-call" href="tel:112">
        <Phone size={15} />
        <span>{text.callEmergency}</span>
        <strong>{text.emergencyNumber}</strong>
      </a>
      <p className="help-caveat">{text.caveat}</p>
    </section>
  );
}

export default HelpPanel;
