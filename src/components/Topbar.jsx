import { Bell, ChevronDown, Globe, MapPin } from "lucide-react";
import { LANGUAGES } from "../translations.js";
import "./Topbar.css";

function Topbar({
  place,
  activePlace,
  onPlaceChange,
  lang = "en",
  onLanguageChange,
  t,
}) {
  const topbarText = t || {
    yourArea: "Your area",
    chooseArea: "Choose travel area",
    language: "Language",
    chooseLanguage: "Choose language",
    weatherSource: "Open-Meteo weather source",
    notifications: "Notifications",
    profile: "Traveler profile",
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-location">
          <span className="location-icon">
            <MapPin size={15} />
          </span>
          <span className="location-label">{topbarText.yourArea}</span>
          <label className="select-wrap">
            <select
              value={activePlace}
              onChange={(event) => onPlaceChange(event.target.value)}
              aria-label={topbarText.chooseArea}
            >
              <option value="kerala">{place.keralaName || "Kerala coast"}</option>
              <option value="wayanad">{place.wayanadName || "Wayanad hills"}</option>
            </select>
            <ChevronDown size={13} />
          </label>
        </div>

        <div className="topbar-divider" />

        {/* Language Selection Dropdown Menu */}
        <div className="topbar-language">
          <span className="language-icon" title={topbarText.language}>
            <Globe size={15} />
          </span>
          <span className="language-label">{topbarText.language}</span>
          <label className="select-wrap">
            <select
              value={lang}
              onChange={(event) => onLanguageChange(event.target.value)}
              aria-label={topbarText.chooseLanguage}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.native}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </label>
        </div>
      </div>

      <div className="topbar-right">
        <span className="topbar-live">
          <span /> {topbarText.weatherSource}
        </span>
        <button
          className="icon-button"
          aria-label={topbarText.notifications}
          title="No official alert feed connected"
        >
          <Bell size={17} />
        </button>
        <div className="user-avatar" aria-label={topbarText.profile}>
          T
        </div>
      </div>
      <span className="sr-only">Current location: {place.shortName}</span>
    </header>
  );
}

export default Topbar;
