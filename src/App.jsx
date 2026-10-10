import { useEffect, useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import AlertCard from "./components/AlertCard.jsx";
import WeatherCard from "./components/WeatherCard.jsx";
import MapView from "./components/MapView.jsx";
import HelpPanel from "./components/HelpPanel.jsx";
import AskSafety from "./components/AskSafety.jsx";
import OfficerDashboard from "./components/OfficerDashboard.jsx";
import HazardFeed from "./components/HazardFeed.jsx";
import { translations } from "./translations.js";

const placeConfig = {
  kerala: {
    coords: [9.9312, 76.2673],
    zoom: 9,
  },
  wayanad: {
    coords: [11.5544, 76.132],
    zoom: 10,
  },
};

function App() {
  const [activeView, setActiveView] = useState("overview");
  const [activePlace, setActivePlace] = useState("kerala");
  const [lang, setLang] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wayfinder_lang") || "en";
    }
    return "en";
  });
  const [, setHelpRequests] = useState([]);
  const [notice, setNotice] = useState("");
  const [hazards, setHazards] = useState([]);
  const [hazardsLoading, setHazardsLoading] = useState(true);
  const [hazardsError, setHazardsError] = useState("");
  const [expiryCheckTime, setExpiryCheckTime] = useState(0);
  const activeHazards = hazards.filter(
    (hazard) => Date.parse(hazard.expires_at) > expiryCheckTime,
  );

  const t = translations[lang] || translations.en;
  const currentPlaceData = t.places[activePlace] || t.places.kerala;

  const place = {
    ...placeConfig[activePlace],
    ...currentPlaceData,
    alert: {
      hazard: currentPlaceData.hazard,
      severity: currentPlaceData.severity,
      zone: currentPlaceData.zone,
      time: currentPlaceData.time,
      action: currentPlaceData.action,
    },
    keralaName: t.places.kerala.name,
    wayanadName: t.places.wayanad.name,
  };

  function handleLanguageChange(newLang) {
    setLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("wayfinder_lang", newLang);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function loadHazards() {
      try {
        const response = await fetch("/api/hazards");
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Shared reports are unavailable.");
        if (mounted) {
          setHazards(data);
          setHazardsError("");
        }
      } catch {
        if (mounted)
          setHazardsError(
            "Shared reports are unavailable. Check the API and PostgreSQL connection.",
          );
      } finally {
        if (mounted) setHazardsLoading(false);
      }
    }
    loadHazards();
    const refresh = window.setInterval(loadHazards, 30000);
    return () => {
      mounted = false;
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(
      () => setExpiryCheckTime(Date.now()),
      0,
    );
    const timer = window.setInterval(
      () => setExpiryCheckTime(Date.now()),
      5000,
    );
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function sendHelp(type) {
    const request = {
      id: `local-${Date.now()}`,
      type,
      place: place.name,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "Open · local demo only",
    };
    setHelpRequests((current) => [request, ...current]);
    setNotice(type === "safe" ? t.toasts.safeNotice : t.toasts.helpNotice);
  }

  function addHazard(hazard) {
    setHazards((current) => [
      hazard,
      ...current.filter((item) => item.id !== hazard.id),
    ]);
    setHazardsError("");
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onChange={setActiveView} t={t.sidebar} />
      <div className="app-main">
        <Topbar
          place={place}
          activePlace={activePlace}
          onPlaceChange={setActivePlace}
          lang={lang}
          onLanguageChange={handleLanguageChange}
          t={t.topbar}
        />
        {activeView === "authority" ? (
          <OfficerDashboard
            place={place}
            hazards={activeHazards}
            onHazardAdded={addHazard}
            onNotice={setNotice}
          />
        ) : (
          <main className="page-content">
            <section className="welcome-row">
              <div>
                <p className="eyebrow">
                  {t.welcome.eyebrow} · {place.name.toUpperCase()}
                </p>
                <h1>
                  {t.welcome.titleLine1}
                  <br />
                  <span>{t.welcome.titleLine2}</span>
                </h1>
                <p className="welcome-copy">{t.welcome.subtitle}</p>
              </div>
              <div className="trust-chip">
                <span className="trust-dot" /> {t.welcome.trustChip}
              </div>
            </section>
            <HazardFeed
              hazards={activeHazards}
              loading={hazardsLoading}
              error={hazardsError}
            />
            <section
              className="alert-weather-grid"
              aria-label="Current conditions"
            >
              <AlertCard alert={place.alert} t={t.alertCard} />
              <WeatherCard
                coords={place.coords}
                placeName={place.shortName}
                t={t.weather}
              />
            </section>
            <section className="map-help-grid">
              <MapView place={place} hazards={activeHazards} t={t.map} />
              <HelpPanel onSend={sendHelp} t={t.help} />
            </section>
            <AskSafety placeName={place.name} t={t.askSafety} />
            <section className="bottom-grid">
              <div className="info-panel road-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{t.routeNote.eyebrow}</p>
                    <h2>{t.routeNote.heading}</h2>
                  </div>
                  <span className="demo-tag">{t.routeNote.demoData}</span>
                </div>
                <div className="road-row">
                  <span className="road-icon">
                    <span />
                  </span>
                  <div>
                    <strong>{place.road}</strong>
                    <p>{t.routeNote.caution}</p>
                  </div>
                  <span className="road-state">{t.routeNote.unverified}</span>
                </div>
              </div>
              <div className="info-panel source-panel" id="source-note">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">{t.trustSources.eyebrow}</p>
                    <h2>{t.trustSources.heading}</h2>
                  </div>
                </div>
                <p>
                  <span className="source-check">✓</span>{" "}
                  {t.trustSources.weatherSource}
                </p>
                <p>
                  <span className="source-pending">i</span>{" "}
                  {t.trustSources.hazardSource}
                </p>
              </div>
            </section>
            {notice && (
              <div className="toast-notice" role="status">
                {notice}
              </div>
            )}
          </main>
        )}
        {activeView === "authority" && notice && (
          <div className="toast-notice" role="status">
            {notice}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
