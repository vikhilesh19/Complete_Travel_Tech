import { Check, LifeBuoy, Phone, Radio, ShieldCheck } from "lucide-react";
import "./HelpPanel.css";

function HelpPanel({ onSend }) {
  return (
    <section className="help-panel">
      <div className="help-panel-heading">
        <span className="help-mark">
          <LifeBuoy size={18} />
        </span>
        <div>
          <p className="eyebrow">QUICK RESPONSE</p>
          <h2>Let someone know</h2>
        </div>
      </div>
      <p className="help-intro">
        These actions stay on this device in the demo. No location is shared.
      </p>
      <div className="help-actions">
        <button
          className="help-action safe-action"
          onClick={() => onSend("safe")}
        >
          <span>
            <ShieldCheck size={16} />
          </span>
          <span>
            <strong>I’m safe</strong>
            <small>Mark yourself as safe</small>
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
            <strong>I need help</strong>
            <small>Send a help request</small>
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
            <strong>Request a callback</strong>
            <small>Ask an operator to contact you</small>
          </span>
          <span className="action-arrow">›</span>
        </button>
      </div>
      <a className="emergency-call" href="tel:112">
        <Phone size={15} />
        <span>Call India emergency services</span>
        <strong>112</strong>
      </a>
      <p className="help-caveat">
        For immediate danger, call 112 directly. Demo requests are not sent to
        responders.
      </p>
    </section>
  );
}

export default HelpPanel;
