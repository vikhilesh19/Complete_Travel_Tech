import { CloudSun, Droplets, RefreshCw, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import "./WeatherCard.css";

const weatherCodes = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

function WeatherCard({ coords, placeName, t }) {
  const text = t || {
    eyebrow: "LIVE WEATHER · OPEN-METEO",
    humidity: "humidity",
    wind: "wind",
    observed: "Observed",
    feelsLike: "Feels like",
    sourceNote: "Live API · not a hazard warning",
    fetching: "Fetching current conditions…",
    unavailable: "Weather unavailable. Check your connection.",
  };

  const [result, setResult] = useState(null);
  const placeKey = `${coords[0]},${coords[1]}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords[0]}&longitude=${coords[1]}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&timezone=auto`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) throw new Error("Weather service unavailable");
        return response.json();
      })
      .then((data) =>
        setResult({ placeKey, weather: data.current, error: false }),
      )
      .catch((error) => {
        if (error.name !== "AbortError") {
          setResult({ placeKey, weather: null, error: true });
        }
      });
    return () => controller.abort();
  }, [coords, placeKey]);

  const currentResult = result?.placeKey === placeKey ? result : null;
  const weather = currentResult?.weather;
  const state = currentResult
    ? currentResult.error
      ? "error"
      : "ready"
    : "loading";
  const description =
    weatherCodes[weather?.weather_code] || "Conditions unavailable";
  const observedAt = weather?.time
    ? new Date(weather.time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <article className="weather-card">
      <div className="weather-card-head">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2>{placeName}</h2>
        </div>
        <span className="weather-icon">
          <CloudSun size={20} strokeWidth={1.6} />
        </span>
      </div>
      {state === "ready" ? (
        <>
          <div className="weather-main">
            <strong>{Math.round(weather.temperature_2m)}°</strong>
            <span>{description}</span>
          </div>
          <div className="weather-details">
            <span>
              <Droplets size={13} />
              {weather.relative_humidity_2m}% {text.humidity}
            </span>
            <span>
              <Wind size={13} />
              {Math.round(weather.wind_speed_10m)} km/h {text.wind}
            </span>
          </div>
          <div className="weather-observed">
            {text.observed} {observedAt} · {text.feelsLike}{" "}
            {Math.round(weather.apparent_temperature)}°
          </div>
        </>
      ) : (
        <div className={`weather-state ${state}`} aria-live="polite">
          {state === "loading" ? (
            <>
              <RefreshCw size={13} className="spin" /> {text.fetching}
            </>
          ) : (
            text.unavailable
          )}
        </div>
      )}
      <div className="weather-source">{text.sourceNote}</div>
    </article>
  );
}

export default WeatherCard;
