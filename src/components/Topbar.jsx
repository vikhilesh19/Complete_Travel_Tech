import { useId, useRef } from "react";
import { Bell, ChevronDown, Globe, MapPin } from "lucide-react";
import OfflineSavePanel from "./OfflineSavePanel.jsx";
import { LANGUAGES } from "../translations.js";
import "./Topbar.css";

function Topbar({
  place,
  activePlace,
  onPlaceChange,
  lang = "en",
  onLanguageChange,
  onSaveOffline,
  savedOfflineAt,
  savingOffline,
  offlineSaveDisabled,
  databaseStatus = "checking",
  databaseName = "",
  t,
}) {
  const languageSelectId = useId();

  // Refs for both dropdowns
  const areaSelectRef = useRef(null);
  const languageSelectRef = useRef(null);

  const openSelect = (ref) => {
    const select = ref.current;
    if (!select) return;

    if (typeof select.showPicker === "function") {
      select.showPicker();
    } else {
      select.focus();
      select.click();
    }
  };

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

          <span className="location-label">
            {topbarText.yourArea}
          </span>

          <label className="select-wrap">
            <select
              ref={areaSelectRef}
              value={activePlace}
              onChange={(event) =>
                onPlaceChange(event.target.value)
              }
              aria-label={topbarText.chooseArea}
            >
              <option value="kerala">
                {place.keralaName || "Kerala coast"}
              </option>
              <option value="wayanad">
                {place.wayanadName || "Wayanad hills"}
              </option>
            </select>

            <ChevronDown
              size={13}
              className="select-chevron"
              onClick={() => openSelect(areaSelectRef)}
            />
          </label>
        </div>

        <div className="topbar-divider" />

        <div className="topbar-language">
          <button
            type="button"
            className="language-icon"
            aria-label={topbarText.chooseLanguage}
            title={topbarText.language}
            onClick={() => openSelect(languageSelectRef)}
          >
            <Globe size={15} />
          </button>

          <span className="language-label">
            {topbarText.language}
          </span>

          <label className="select-wrap">
            <select
              id={languageSelectId}
              ref={languageSelectRef}
              value={lang}
              onChange={(event) =>
                onLanguageChange(event.target.value)
              }
              aria-label={topbarText.chooseLanguage}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.native}
                </option>
              ))}
            </select>

            <ChevronDown
              size={13}
              className="select-chevron"
              onClick={() => openSelect(languageSelectRef)}
            />
          </label>
        </div>

        <OfflineSavePanel
          onSave={onSaveOffline}
          savedAt={savedOfflineAt}
          saving={savingOffline}
          disabled={offlineSaveDisabled}
          label={topbarText.saveOffline || "Save for offline"}
        />
      </div>

      <div className="topbar-right">
        <span
          className={`database-status is-${databaseStatus}`}
          role="status"
          title={topbarText.databaseStatusLabel || "Database connection status"}
        >
          <i />
          <span>
            {databaseStatus === "connected"
              ? (databaseName ? `Neon (${databaseName}) connected` : "Neon database connected")
              : databaseStatus === "unavailable"
                ? topbarText.databaseUnavailable || "Database unavailable"
                : topbarText.databaseChecking || "Checking database"}
          </span>
        </span>
        <span className="topbar-live">
          <span />
          {topbarText.weatherSource}
        </span>

        <button
          type="button"
          className="icon-button"
          aria-label={topbarText.notifications}
          title="No official alert feed connected"
        >
          <Bell size={17} />
        </button>

        <div
          className="user-avatar"
          aria-label={topbarText.profile}
        >
          T
        </div>
      </div>

      <span className="sr-only">
        Current location: {place.shortName}
      </span>
    </header>
  );
}

export default Topbar;
