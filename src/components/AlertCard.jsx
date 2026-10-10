import { ArrowUpRight, Clock3, Waves } from "lucide-react";
import "./AlertCard.css";

function AlertCard({ alert, t }) {
  const text = t || {
    activeScenario: "ACTIVE SCENARIO",
    demoAlert: "DEMO ALERT",
    hazardSuffix: "illustrative hazard",
    sourceDetails: "Source details",
    tooltip: "DEMO ALERT · Not an official warning",
  };

  return (
    <article className="alert-card">
      <div className="alert-card-top">
        <span className="alert-type">
          <Waves size={15} /> {text.activeScenario}
        </span>
        <span className="demo-tag alert-demo-tag">{text.demoAlert}</span>
      </div>
      <div className="alert-card-content">
        <div className="alert-severity">
          {alert.severity} <span>· {text.hazardSuffix}</span>
        </div>
        <h2>{alert.hazard}</h2>
        <p className="alert-zone">{alert.zone}</p>
        <p className="alert-action">{alert.action}</p>
      </div>
      <div className="alert-card-footer">
        <span>
          <Clock3 size={13} /> {alert.time}
        </span>
        <a href="#source-note" title={text.tooltip}>
          {text.sourceDetails} <ArrowUpRight size={13} />
        </a>
      </div>
    </article>
  );
}

export default AlertCard;
