import { useEffect, useRef, useState } from "react";
import { apiFetch } from "./api.js";
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
import SmsSubscription from "./components/SmsSubscription.jsx";
import {
  hazardReportTranslations,
  smsSubscriptionTranslations,
  translations,
} from "./translations.js";
import {
  getAreaSnapshot,
  getQueuedHelpActions,
  queueHelpAction,
  removeQueuedHelpAction,
  saveAreaSnapshot,
} from "./offlineStore.js";
import "./OfflineStatusBanner.css";

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
  const deletedHazardIds = useRef(new Set());
  const hazardChannel = useRef(null);
  const [activeView, setActiveView] = useState("overview");
  const [activePlace, setActivePlace] = useState(() => {
    if (typeof window === "undefined") return "kerala";
    const requestedArea = new URLSearchParams(window.location.search).get(
      "area",
    );
    return Object.hasOwn(placeConfig, requestedArea) ? requestedArea : "kerala";
  });
  const [lang, setLang] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("wayfinder_lang") || "en";
    }
    return "en";
  });
  const [notice, setNotice] = useState("");
  const [hazards, setHazards] = useState([]);
  const [hazardsLoading, setHazardsLoading] = useState(true);
  const [hazardsError, setHazardsError] = useState("");
  const [hazardsOffline, setHazardsOffline] = useState(false);
  const [hazardsSavedAt, setHazardsSavedAt] = useState(null);
  const [weatherByArea, setWeatherByArea] = useState({});
  const [pendingHelpActions, setPendingHelpActions] = useState([]);
  const [smsHelpNumber, setSmsHelpNumber] = useState("");
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState("checking");
  const [databaseName, setDatabaseName] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [savingOffline, setSavingOffline] = useState(false);
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [expiryCheckTime, setExpiryCheckTime] = useState(0);
  const activeHazards = hazards.filter(
    (hazard) => Date.parse(hazard.expires_at) > expiryCheckTime,
  );
  const lastSavedAt = savedSnapshot?.savedAt || hazardsSavedAt;
  const offlineDataShown = !isOnline || hazardsOffline;
  const savedTimeLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const savedDataIsOld =
    lastSavedAt &&
    expiryCheckTime - Date.parse(lastSavedAt) > 6 * 60 * 60 * 1000;

  useEffect(() => {
    let active = true;
    async function checkDatabase() {
      try {
        const response = await fetch("http://localhost:5000/api/health", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || data.success !== true)
          throw new Error("Database is unavailable.");
        if (active) {
          setDatabaseStatus("connected");
          setDatabaseName(data.database || "neondb");
        }
      } catch {
        if (active) {
          setDatabaseStatus("unavailable");
          setDatabaseName("");
        }
      }
    }

    checkDatabase();
    const refresh = window.setInterval(checkDatabase, 30_000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  function excludeDeletedHazards(items) {
    return items.filter(
      (hazard) => !deletedHazardIds.current.has(String(hazard.id)),
    );
  }

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

  function handlePlaceChange(newPlace) {
    if (!Object.hasOwn(placeConfig, newPlace)) return;
    setActivePlace(newPlace);
    const url = new URL(window.location.href);
    url.searchParams.set("area", newPlace);
    window.history.replaceState({}, "", url);
  }

  useEffect(() => {
    let mounted = true;
    async function loadHazards() {
      try {
        const response = await apiFetch("/api/hazards", {
          headers: { "X-Wayfinder-Refresh": "1" },
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Shared reports are unavailable.");
        if (mounted) {
          setHazards(excludeDeletedHazards(data));
          const cachedAt = response.headers.get("X-Wayfinder-Cached-At");
          setHazardsOffline(
            response.headers.get("X-Wayfinder-Offline") === "1",
          );
          setHazardsSavedAt(cachedAt || null);
          setHazardsError("");
        }
      } catch {
        try {
          const snapshot = await getAreaSnapshot(activePlace);
          if (mounted && snapshot) {
            setHazards(
              excludeDeletedHazards(snapshot.hazards?.data || []),
            );
            setHazardsOffline(true);
            setHazardsSavedAt(snapshot.hazards?.savedAt || snapshot.savedAt);
            setHazardsError("");
          } else if (mounted) {
            setHazards([]);
            setHazardsOffline(true);
            setHazardsSavedAt(null);
            setHazardsError("No saved hazard reports for this area.");
          }
        } catch {
          if (mounted) {
            setHazards([]);
            setHazardsOffline(true);
            setHazardsSavedAt(null);
            setHazardsError("No saved hazard reports for this area.");
          }
        }
      } finally {
        if (mounted) setHazardsLoading(false);
      }
    }
    loadHazards();
    const refresh = window.setInterval(loadHazards, 30000);
    window.addEventListener("focus", loadHazards);
    return () => {
      mounted = false;
      window.clearInterval(refresh);
      window.removeEventListener("focus", loadHazards);
    };
  }, [activePlace]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return undefined;
    const channel = new BroadcastChannel("wayfinder-hazards");
    hazardChannel.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === "deleted" && event.data.id) {
        removeHazard(event.data.id, false);
      }
    };
    return () => {
      channel.close();
      hazardChannel.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getAreaSnapshot(activePlace)
      .then((snapshot) => {
        if (active && snapshot?.hazards?.data) {
          const filteredSnapshot = {
            ...snapshot,
            hazards: {
              ...snapshot.hazards,
              data: excludeDeletedHazards(snapshot.hazards.data),
            },
          };
          setSavedSnapshot(filteredSnapshot);
          if (filteredSnapshot.hazards.data.length !== snapshot.hazards.data.length) {
            saveAreaSnapshot(filteredSnapshot).catch(() => {});
          }
        } else if (active) {
          setSavedSnapshot(snapshot || null);
        }
      })
      .catch(() => {
        if (active) setSavedSnapshot(null);
      });
    return () => {
      active = false;
    };
  }, [activePlace]);

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
    let active = true;
    apiFetch("/api/public-config")
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => {
        if (active && typeof config?.smsHelpNumber === "string") {
          setSmsHelpNumber(config.smsHelpNumber);
        }
        if (active) setSmsAlertsEnabled(config?.smsAlertsEnabled === true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function syncHelpQueue() {
      let queued;
      try {
        queued = await getQueuedHelpActions();
        if (active) setPendingHelpActions(queued);
      } catch {
        return;
      }
      if (!navigator.onLine || queued.length === 0) return;

      for (const action of queued) {
        try {
          const response = await apiFetch("/api/help-queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action),
          });
          if (response.ok) await removeQueuedHelpAction(action.id);
        } catch {
          break;
        }
      }
      try {
        const remaining = await getQueuedHelpActions();
        if (active) setPendingHelpActions(remaining);
      } catch {
        // Keep the current pending state until storage can be read again.
      }
    }

    syncHelpQueue();
    window.addEventListener("online", syncHelpQueue);
    return () => {
      active = false;
      window.removeEventListener("online", syncHelpQueue);
    };
  }, []);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function sendHelp(type) {
    const action = {
      id: crypto.randomUUID(),
      action: type,
      areaId: activePlace,
      createdAt: new Date().toISOString(),
    };
    try {
      await queueHelpAction(action);
      setPendingHelpActions((current) => [...current, action]);
      setNotice("Waiting to send. This action is stored on this device.");
      if (navigator.onLine) {
        const response = await apiFetch("/api/help-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        if (response.ok) {
          await removeQueuedHelpAction(action.id);
          setPendingHelpActions((current) =>
            current.filter((item) => item.id !== action.id),
          );
          setNotice("Help action sent.");
        }
      }
    } catch {
      setNotice("Waiting to send. This action is stored on this device.");
    }
  }

  function addHazard(hazard) {
    setHazards((current) => [
      hazard,
      ...current.filter((item) => item.id !== hazard.id),
    ]);
    setHazardsError("");
  }

  function removeHazard(hazardId, broadcast = true) {
    const id = String(hazardId);
    deletedHazardIds.current.add(id);
    setHazards((current) =>
      current.filter((hazard) => String(hazard.id) !== id),
    );
    setSavedSnapshot((current) => {
      if (!current?.hazards?.data) return current;
      const updatedSnapshot = {
        ...current,
        hazards: {
          ...current.hazards,
          data: current.hazards.data.filter(
            (hazard) => String(hazard.id) !== id,
          ),
        },
      };
      saveAreaSnapshot(updatedSnapshot).catch(() => {});
      return updatedSnapshot;
    });
    if (broadcast) {
      hazardChannel.current?.postMessage({ type: "deleted", id });
      navigator.serviceWorker?.controller?.postMessage({
        type: "WAYFINDER_HAZARD_DELETED",
        id,
      });
      for (const areaId of ["kerala", "wayanad"]) {
        getAreaSnapshot(areaId)
          .then((snapshot) => {
            if (!snapshot?.hazards?.data) return;
            return saveAreaSnapshot({
              ...snapshot,
              hazards: {
                ...snapshot.hazards,
                data: snapshot.hazards.data.filter(
                  (hazard) => String(hazard.id) !== id,
                ),
              },
            });
          })
          .catch(() => {});
      }
    }
  }

  async function saveCurrentAreaOffline() {
    if (!navigator.onLine || offlineDataShown) {
      setNotice("Connect to the internet to refresh saved area information.");
      return;
    }
    setSavingOffline(true);
    const savedAt = new Date().toISOString();
    const bounds =
      activePlace === "kerala"
        ? { south: 8, west: 74, north: 13.2, east: 77.8 }
        : { south: 11, west: 75.4, north: 12.6, east: 76.7 };
    const areaHazards = activeHazards.filter(
      (hazard) =>
        Number(hazard.latitude) >= bounds.south &&
        Number(hazard.latitude) <= bounds.north &&
        Number(hazard.longitude) >= bounds.west &&
        Number(hazard.longitude) <= bounds.east,
    );
    const snapshot = {
      areaId: activePlace,
      savedAt,
      hazards: { data: areaHazards, savedAt },
      shelters: { data: [], available: false, savedAt },
      roads: {
        data: [{ name: place.road, status: "Unverified", isDemo: true }],
        savedAt,
      },
      weather: {
        data: weatherByArea[activePlace] || null,
        savedAt,
      },
      emergencyNumbers: {
        data: [{ label: t.help.callEmergency, number: "112" }],
        savedAt,
      },
      safetyInstructions: {
        data: [
          { text: place.alert.action, isDemo: true, source: "Demo scenario" },
        ],
        savedAt,
      },
    };

    try {
      await saveAreaSnapshot(snapshot);
      setSavedSnapshot(snapshot);
      setNotice("This area is saved for offline use on this device.");
    } catch (error) {
      setNotice(error.message || "Could not save this area for offline use.");
    } finally {
      setSavingOffline(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onChange={setActiveView} t={t.sidebar} />
      <div className="app-main">
        <Topbar
          place={place}
          activePlace={activePlace}
          onPlaceChange={handlePlaceChange}
          lang={lang}
          onLanguageChange={handleLanguageChange}
          onSaveOffline={saveCurrentAreaOffline}
          savedOfflineAt={savedSnapshot?.savedAt}
          savingOffline={savingOffline}
          offlineSaveDisabled={!isOnline || offlineDataShown}
          databaseStatus={databaseStatus}
          databaseName={databaseName}
          t={t.topbar}
        />
        {offlineDataShown && (
          <div className="offline-status-banner" role="status">
            <strong>
              {lastSavedAt
                ? `You're offline. Showing information saved at ${savedTimeLabel}.`
                : "You're offline. No information has been saved for this area."}
            </strong>
            {savedDataIsOld && (
              <span>
                Saved information is more than 6 hours old. Confirm current
                conditions with local authorities.
              </span>
            )}
          </div>
        )}
        {activeView === "authority" ? (
          <OfficerDashboard
            place={place}
            hazards={activeHazards}
            onHazardAdded={addHazard}
            onHazardDeleted={removeHazard}
            onNotice={setNotice}
          />
        ) : (
          <main className="page-content">
            <section className="traveler-map-hazards">
              <MapView
                place={place}
                hazards={activeHazards}
                t={t.map}
                hazardText={
                  hazardReportTranslations[lang] || hazardReportTranslations.en
                }
                lang={lang}
                offline={offlineDataShown}
                offlineSnapshot={savedSnapshot}
              />
              <div className="traveler-hazard-column">
                <HazardFeed
                  hazards={activeHazards}
                  loading={hazardsLoading}
                  error={hazardsError}
                  lang={lang}
                  text={
                    hazardReportTranslations[lang] ||
                    hazardReportTranslations.en
                  }
                />
                <SmsSubscription
                  areaId={activePlace}
                  areaName={place.shortName}
                  language={lang}
                  enabled={smsAlertsEnabled}
                  text={smsSubscriptionTranslations[lang] || smsSubscriptionTranslations.en}
                />
                <AlertCard alert={place.alert} t={t.alertCard} />
              </div>
            </section>
            <section className="traveler-weather-help" aria-label="Weather and assistance">
              <WeatherCard
                coords={place.coords}
                placeName={place.shortName}
                t={t.weather}
                areaId={activePlace}
                onWeatherLoaded={setWeatherByArea}
                savedWeather={savedSnapshot?.weather}
                offline={offlineDataShown}
              />
              <HelpPanel
                onSend={sendHelp}
                pendingActions={pendingHelpActions}
                areaName={place.shortName}
                smsHelpNumber={smsHelpNumber}
                t={t.help}
              />
            </section>
            <AskSafety
              placeName={place.name}
              t={t.askSafety}
              offline={offlineDataShown}
              snapshot={savedSnapshot}
            />
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
