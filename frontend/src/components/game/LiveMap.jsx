import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Home, Navigation } from "lucide-react";
import { CATEGORY_COLORS, TYPE_ICONS, missionPosition } from "../../lib/game";

const makeDivIcon = (html, size, className = "") =>
  L.divIcon({ html, className: `lus-marker ${className}`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

const oppIcon = (opp, selected) => {
  const Icon = TYPE_ICONS[opp.type_key] || TYPE_ICONS.assalto;
  const color = CATEGORY_COLORS[opp.category] || "#fff";
  const html = `
    <div class="opp-pin ${selected ? "opp-pin-selected" : ""}" style="--mk:${color}">
      <span class="opp-pulse"></span>
      ${renderToStaticMarkup(<Icon size={15} strokeWidth={2.5} />)}
    </div>`;
  return makeDivIcon(html, 34);
};

const hqIcon = () => {
  const html = `
    <div class="hq-pin">
      ${renderToStaticMarkup(<Home size={16} strokeWidth={2.5} />)}
    </div>`;
  return makeDivIcon(html, 36);
};

const unitIcon = (phase) => {
  const color = phase === "operating" ? "#EF4444" : "#22D3EE";
  const html = `
    <div class="unit-pin ${phase === "operating" ? "unit-operating" : ""}" style="--mk:${color}">
      ${renderToStaticMarkup(<Navigation size={13} strokeWidth={2.5} />)}
    </div>`;
  return makeDivIcon(html, 26);
};

const PanTo = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.panTo([target.lat, target.lng], { animate: true, duration: 0.6 });
  }, [target, map]);
  return null;
};

const MissionUnit = ({ mission, serverNow }) => {
  const [pos, setPos] = useState(() => missionPosition(mission, serverNow()));
  useEffect(() => {
    const id = setInterval(() => setPos(missionPosition(mission, serverNow())), 350);
    return () => clearInterval(id);
  }, [mission, serverNow]);
  const icon = useMemo(() => unitIcon(pos.phase), [pos.phase]);
  if (pos.phase === "done") return null;
  return <Marker position={[pos.lat, pos.lng]} icon={icon} zIndexOffset={500} />;
};

export default function LiveMap({ state, serverNow, selectedOppId, onSelectOpp }) {
  const hq = state.player.hq;
  const hqMarkerIcon = useMemo(() => hqIcon(), []);

  return (
    <MapContainer
      center={[38.7223, -9.1393]}
      zoom={13}
      zoomControl={false}
      className="absolute inset-0 z-0 h-full w-full"
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      <Marker position={[hq.lat, hq.lng]} icon={hqMarkerIcon} zIndexOffset={400} />
      {state.opportunities.map((opp) => (
        <Marker
          key={opp.id}
          position={[opp.lat, opp.lng]}
          icon={oppIcon(opp, opp.id === selectedOppId)}
          eventHandlers={{ click: () => onSelectOpp(opp) }}
        />
      ))}
      {state.missions.map((m) => (
        <MissionUnit key={m.id} mission={m} serverNow={serverNow} />
      ))}
      <PanTo target={state.opportunities.find((o) => o.id === selectedOppId)} />
    </MapContainer>
  );
}
