import { Compass, LifeBuoy, MapPinned, ShieldCheck } from "lucide-react";
import "./Sidebar.css";

function Sidebar({ activeView, onChange, t }) {
  const text = t || {
    brandSub: "TRAVEL SAFETY",
    workspace: "WORKSPACE",
    overview: "Traveler view",
    authority: "Officer login",
    officialSourcesFirst: "Official sources first",
    distinguishVerified: "We distinguish verified updates from demo information.",
    emergencyInIndia: "Emergency in India",
    emergencyNumber: "112",
    footer: "WAYFINDER · HACKATHON DEMO",
  };

  const navItems = [
    { id: "overview", label: text.overview, icon: Compass },
    { id: "authority", label: text.authority, icon: ShieldCheck },
  ];

  return (
    <aside className="sidebar">
      <a
        className="brand-lockup"
        href="#home"
        aria-label="Wayfinder home"
        onClick={() => onChange("overview")}
      >
        <span className="brand-mark">
          <MapPinned size={19} strokeWidth={2.2} />
        </span>
        <span>
          <strong>wayfinder</strong>
          <small>{text.brandSub}</small>
        </span>
      </a>
      <div className="sidebar-section-label">{text.workspace}</div>
      <nav className="side-nav" aria-label="Main navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`side-nav-item ${activeView === id ? "is-active" : ""}`}
            onClick={() => onChange(id)}
          >
            <Icon size={17} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-safety-card">
          <span className="safety-card-icon">
            <ShieldCheck size={17} />
          </span>
          <strong>{text.officialSourcesFirst}</strong>
          <p>{text.distinguishVerified}</p>
        </div>
        <div className="sidebar-help-link">
          <LifeBuoy size={15} />
          <span>{text.emergencyInIndia}</span>
          <strong>{text.emergencyNumber}</strong>
        </div>
        <div className="sidebar-footer">
          {text.footer}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
