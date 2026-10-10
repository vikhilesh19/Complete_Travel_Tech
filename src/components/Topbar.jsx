import { Bell, ChevronDown, MapPin } from "lucide-react";
import "./Topbar.css";

function Topbar({ place, activePlace, onPlaceChange }) {
  return (
    <header className="topbar">
      <div className="topbar-location">
        <span className="location-icon">
          <MapPin size={15} />
        </span>
        <span className="location-label">Your area</span>
        <label className="select-wrap">
          <select
            value={activePlace}
            onChange={(event) => onPlaceChange(event.target.value)}
            aria-label="Choose travel area"
          >
            <option value="kerala">Kerala coast</option>
            <option value="wayanad">Wayanad hills</option>
          </select>
          <ChevronDown size={13} />
        </label>
      </div>
      <div className="topbar-right">
        <span className="topbar-live">
          <span /> Open-Meteo weather source
        </span>
        <button
          className="icon-button"
          aria-label="Notifications"
          title="No official alert feed connected"
        >
          <Bell size={17} />
        </button>
        <div className="user-avatar" aria-label="Traveler profile">
          T
        </div>
      </div>
      <span className="sr-only">Current location: {place.shortName}</span>
    </header>
  );
}

export default Topbar;
