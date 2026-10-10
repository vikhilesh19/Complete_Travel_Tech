import { ArrowUpRight, Clock3, Waves } from "lucide-react";
import "./AlertCard.css";

function AlertCard({ alert }) {
  return (
    <article className="alert-card">
      <div className="alert-card-top">
        <span className="alert-type">
          <Waves size={15} /> ACTIVE SCENARIO
        </span>
        <span className="demo-tag alert-demo-tag">DEMO ALERT</span>
      </div>
      <div className="alert-card-content">
        <div className="alert-severity">
          {alert.severity} <span>· illustrative hazard</span>
        </div>
        <h2>{alert.hazard}</h2>
        <p className="alert-zone">{alert.zone}</p>
        <p className="alert-action">{alert.action}</p>
      </div>
      <div className="alert-card-footer">
        <span>
          <Clock3 size={13} /> {alert.time}
        </span>
        <a href="#source-note" title="DEMO ALERT · Not an official warning">
          Source details <ArrowUpRight size={13} />
        </a>
      </div>
    </article>
  );
}

export default AlertCard;
