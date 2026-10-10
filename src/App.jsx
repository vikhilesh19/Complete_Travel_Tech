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

const places = {
  kerala: {
    name: "Kerala coast",
    shortName: "Kochi, Kerala",
    coords: [9.9312, 76.2673],
    zoom: 9,
    alert: {
      hazard: "Coastal flooding",
      severity: "High",
      zone: "Fort Kochi · Ernakulam coast",
      time: "Demo scenario · 10:30 AM",
      action: "Move inland from the shoreline and avoid low-lying roads.",
    },
    mapLabel: "Fort Kochi",
    road: "Coastal road · illustrative status",
  },
  wayanad: {
    name: "Wayanad hills",
    shortName: "Meppadi, Wayanad",
    coords: [11.5544, 76.132],
    zoom: 10,
    alert: {
      hazard: "Landslide risk",
      severity: "High",
      zone: "Meppadi · Wayanad district",
      time: "Demo scenario · 11:05 AM",
      action: "Keep clear of steep slopes and use only confirmed open routes.",
    },
    mapLabel: "Meppadi",
    road: "Meppadi–Chooralmala · illustrative status",
  },
};

function App() {
  const [activeView, setActiveView] = useState("overview");
  const [activePlace, setActivePlace] = useState("kerala");
  const [, setHelpRequests] = useState([]);
  const [notice, setNotice] = useState("");
  const [hazards, setHazards] = useState([]);
  const [hazardsLoading, setHazardsLoading] = useState(true);
  const [hazardsError, setHazardsError] = useState("");
  const place = places[activePlace];

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
    setNotice(
      type === "safe"
        ? "You’re marked safe on this device."
        : "Help request saved on this device only.",
    );
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
      <Sidebar activeView={activeView} onChange={setActiveView} />
      <div className="app-main">
        <Topbar
          place={place}
          activePlace={activePlace}
          onPlaceChange={setActivePlace}
        />
        {activeView === "authority" ? (
          <OfficerDashboard
            place={place}
            hazards={hazards}
            onHazardAdded={addHazard}
            onNotice={setNotice}
          />
        ) : (
          <main className="page-content">
            <section className="welcome-row">
              <div>
                <p className="eyebrow">
                  TRAVELER SAFETY · {place.name.toUpperCase()}
                </p>
                <h1>
                  Know what’s happening.
                  <br />
                  <span>Choose your next step.</span>
                </h1>
                <p className="welcome-copy">
                  Local conditions and official guidance, in one place.
                </p>
              </div>
              <div className="trust-chip">
                <span className="trust-dot" /> Source-aware updates
              </div>
            </section>
            <HazardFeed
              hazards={hazards}
              loading={hazardsLoading}
              error={hazardsError}
            />
            <section
              className="alert-weather-grid"
              aria-label="Current conditions"
            >
              <AlertCard alert={place.alert} />
              <WeatherCard coords={place.coords} placeName={place.shortName} />
            </section>
            <section className="map-help-grid">
              <MapView place={place} hazards={hazards} />
              <HelpPanel onSend={sendHelp} />
            </section>
            <AskSafety placeName={place.name} />
            <section className="bottom-grid">
              <div className="info-panel road-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">ROUTE NOTE</p>
                    <h2>Road status</h2>
                  </div>
                  <span className="demo-tag">DEMO DATA</span>
                </div>
                <div className="road-row">
                  <span className="road-icon">
                    <span />
                  </span>
                  <div>
                    <strong>{place.road}</strong>
                    <p>Illustrative only · confirm locally before travel</p>
                  </div>
                  <span className="road-state">Unverified</span>
                </div>
              </div>
              <div className="info-panel source-panel" id="source-note">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">TRUST & SOURCES</p>
                    <h2>What’s verified</h2>
                  </div>
                </div>
                <p>
                  <span className="source-check">✓</span> Weather from
                  Open-Meteo · live API
                </p>
                <p>
                  <span className="source-pending">i</span> Hazard alert · demo
                  scenario, not an official feed
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
