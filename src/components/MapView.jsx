import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layers2, LocateFixed } from "lucide-react";
import "./MapView.css";

function MapView({ place, hazards, t }) {
  const text = t || {
    eyebrow: "AREA OVERVIEW",
    demoLabel: "DEMO + OFFICER REPORTS",
    recenter: "Recenter map",
    layerLabel: "OpenStreetMap",
    legendZone: "Illustrative hazard zone",
    legendPlace: "Demo location marker",
    legendOfficer: "Officer reports",
    disclaimer: "Reports are not verified alert boundaries",
    demoZonePopup: "Illustrative demo zone",
    demoZoneSub: "not an official alert boundary",
    demoAlertPopup: "DEMO ALERT",
    notOfficialWarning: "not an official warning",
    demoMarkerPopup: "Demo map marker · not a verified shelter",
    officerReport: "Officer report",
    severity: "Severity",
  };

  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const hazardLayer = useRef(null);

  useEffect(() => {
    if (!mapElement.current) return undefined;
    const map = L.map(mapElement.current, {
      zoomControl: false,
      scrollWheelZoom: false,
    }).setView(place.coords, place.zoom);
    mapInstance.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const alertMarker = L.divIcon({
      className: "wayfinder-alert-marker",
      html: "<span><i></i></span>",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const demoMarker = L.divIcon({
      className: "wayfinder-demo-marker",
      html: "<span>+</span>",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.circle(place.coords, {
      radius: place.zoom === 9 ? 5500 : 3800,
      color: "#ba7740",
      weight: 1.5,
      fillColor: "#d3985d",
      fillOpacity: 0.13,
      dashArray: "5 6",
    })
      .addTo(map)
      .bindPopup(
        `<strong>${text.demoZonePopup}</strong><br>${place.mapLabel} · ${text.demoZoneSub}`,
      );
    L.marker(place.coords, { icon: alertMarker })
      .addTo(map)
      .bindPopup(
        `<strong>${text.demoAlertPopup}</strong><br>${place.alert.hazard} · ${text.notOfficialWarning}`,
      );
    const demoOffset = place.zoom === 9 ? [0.038, 0.052] : [0.028, 0.045];
    L.marker(
      [place.coords[0] + demoOffset[0], place.coords[1] + demoOffset[1]],
      { icon: demoMarker },
    )
      .addTo(map)
      .bindPopup(text.demoMarkerPopup);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [place, text]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return undefined;
    hazardLayer.current?.remove();
    const layer = L.layerGroup().addTo(map);
    hazards.forEach((hazard) => {
      const severityClass = ["low", "moderate", "high", "severe"].includes(
        hazard.severity?.toLowerCase(),
      )
        ? hazard.severity.toLowerCase()
        : "moderate";
      const marker = L.marker(
        [Number(hazard.latitude), Number(hazard.longitude)],
        {
          icon: L.divIcon({
            className: `wayfinder-officer-marker severity-${severityClass}`,
            html: "<span></span>",
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        },
      );
      const popup = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `${hazard.hazard} · ${text.officerReport}`;
      const location = document.createElement("p");
      location.textContent = hazard.location;
      const description = document.createElement("p");
      description.textContent = hazard.description;
      const severity = document.createElement("small");
      severity.textContent = `${text.severity}: ${hazard.severity}`;
      popup.append(title, location, description, severity);
      marker.addTo(layer).bindPopup(popup);
    });
    hazardLayer.current = layer;
    return () => {
      layer.remove();
      hazardLayer.current = null;
    };
  }, [hazards, place, text]);

  function recenter() {
    mapInstance.current?.setView(place.coords, place.zoom, { animate: true });
  }

  return (
    <section className="map-panel" aria-label={`Map of ${place.name}`}>
      <div className="map-panel-heading">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h2>{place.name}</h2>
        </div>
        <span className="map-demo-label">
          <span /> {text.demoLabel}
        </span>
      </div>
      <div className="map-frame">
        <div className="leaflet-map" ref={mapElement} />
        <button
          className="map-recenter"
          onClick={recenter}
          aria-label={text.recenter}
          title={text.recenter}
        >
          <LocateFixed size={16} />
        </button>
        <div className="map-layer-label">
          <Layers2 size={13} /> {text.layerLabel}
        </div>
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-zone" />
          {text.legendZone}
        </span>
        <span>
          <i className="legend-place" />
          {text.legendPlace}
        </span>
        {hazards.length > 0 && (
          <span>
            <i className="legend-officer" /> {text.legendOfficer}
          </span>
        )}
        <span className="map-disclaimer">
          {text.disclaimer}
        </span>
      </div>
    </section>
  );
}

export default MapView;
