import { Compass, LifeBuoy, MapPinned, ShieldCheck } from "lucide-react";
import "./Sidebar.css";

const navItems = [
  { id: "overview", label: "Traveler view", icon: Compass },
  { id: "authority", label: "Officer login", icon: ShieldCheck },
];

function Sidebar({ activeView, onChange }) {
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
          <small>TRAVEL SAFETY</small>
        </span>
      </a>
      <div className="sidebar-section-label">WORKSPACE</div>
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
          <strong>Official sources first</strong>
          <p>We distinguish verified updates from demo information.</p>
        </div>
        <div className="sidebar-help-link">
          <LifeBuoy size={15} />
          <span>Emergency in India</span>
          <strong>112</strong>
        </div>
        <div className="sidebar-footer">
          WAYFINDER <span>·</span> HACKATHON DEMO
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
