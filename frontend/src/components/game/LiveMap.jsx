import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip as LTooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Home, Navigation, Shield, Warehouse, FlaskConical, Landmark, Anchor, Wrench, Boxes, Map as MapIcon, X } from "lucide-react";
import { useGame } from "../../context/GameContext";
import { CATEGORY_COLORS, TYPE_ICONS, SPEC_LABELS, missionPosition, fmtMoney, fmtDuration, propertyBenefit, STATUS_LABELS, STATUS_COLORS } from "../../lib/game";

const PROP_ICONS = {
  esconderijo: Shield,
  garagem: Warehouse,
  armazem: Boxes,
  laboratorio: FlaskConical,
  empresa_legal: Landmark,
  oficina: Wrench,
  porto_clandestino: Anchor,
};

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

const propIcon = (typeKey) => {
  const Icon = PROP_ICONS[typeKey] || Warehouse;
  const html = `
    <div class="prop-pin">
      ${renderToStaticMarkup(<Icon size={13} strokeWidth={2.5} />)}
    </div>`;
  return makeDivIcon(html, 28);
};

const PanTo = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.panTo([target.lat, target.lng], { animate: true, duration: 0.6 });
  }, [target, map]);
  return null;
};

const TipRow = ({ label, value, color = "#E4E4E7" }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</span>
    <span className="font-mono text-[10px] font-bold" style={{ color }}>{value}</span>
  </div>
);

const MissionUnit = ({ mission, serverNow }) => {
  const [pos, setPos] = useState(() => missionPosition(mission, serverNow()));
  useEffect(() => {
    const id = setInterval(() => setPos(missionPosition(mission, serverNow())), 350);
    return () => clearInterval(id);
  }, [mission, serverNow]);
  const icon = useMemo(() => unitIcon(pos.phase), [pos.phase]);
  if (pos.phase === "done") return null;
  const nowMs = serverNow();
  const nextAt = pos.phase === "en_route" ? mission.arrive_at : pos.phase === "operating" ? mission.finish_at : mission.return_at;
  const nextLabel = pos.phase === "en_route" ? "chega em" : pos.phase === "operating" ? "conclui em" : "regressa em";
  const remaining = Math.max(0, (Date.parse(nextAt) - nowMs) / 1000);
  return (
    <Marker position={[pos.lat, pos.lng]} icon={icon} zIndexOffset={500}>
      <LTooltip direction="top" offset={[0, -14]} opacity={1} className="lus-map-tip">
        <div className="min-w-[130px]">
          <p className="text-[11px] font-bold text-white">{mission.team_name}</p>
          <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: STATUS_COLORS[pos.phase] || "#22D3EE" }}>
            {STATUS_LABELS[pos.phase] || pos.phase} · {mission.opportunity?.name}
          </p>
          <TipRow label={nextLabel} value={fmtDuration(remaining)} color="#F59E0B" />
          {mission.success_chance != null && (
            <TipRow label="probabilidade" value={`${Math.round(mission.success_chance * 100)}%`} color="#34D399" />
          )}
        </div>
      </LTooltip>
    </Marker>
  );
};

export default function LiveMap({ state, serverNow, selectedOppId, onSelectOpp }) {
  const { catalog } = useGame();
  const hq = state.player.hq;
  const hqMarkerIcon = useMemo(() => hqIcon(), []);
  const level = state.player.level;

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
      <Marker position={[hq.lat, hq.lng]} icon={hqMarkerIcon} zIndexOffset={400}>
        <LTooltip direction="top" offset={[0, -18]} opacity={1} className="lus-map-tip">
          <div className="min-w-[130px]">
            <p className="text-[11px] font-bold text-white">{hq.name}</p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">Quartel-general · {state.player.org_name}</p>
            <p className="mt-0.5 text-[9px] text-zinc-400">As equipas partem e regressam aqui.</p>
          </div>
        </LTooltip>
      </Marker>
      {state.properties.map((p) => {
        const pt = catalog?.property_types?.[p.type_key];
        return (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={propIcon(p.type_key)} zIndexOffset={300}>
            <LTooltip direction="top" offset={[0, -14]} opacity={1} className="lus-map-tip">
              <div className="min-w-[140px]">
                <p className="text-[11px] font-bold text-white">{p.name}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                  {p.district} · nível {p.level}/{catalog?.property_max_level || 3}
                </p>
                {pt && <p className="mt-0.5 font-mono text-[9px] text-emerald-400">{propertyBenefit(pt, p.level)}</p>}
              </div>
            </LTooltip>
          </Marker>
        );
      })}
      {state.opportunities.map((opp) => {
        const locked = level < opp.min_level;
        const expiresS = Math.max(0, (Date.parse(opp.expires_at) - serverNow()) / 1000);
        return (
          <Marker
            key={opp.id}
            position={[opp.lat, opp.lng]}
            icon={oppIcon(opp, opp.id === selectedOppId)}
            eventHandlers={{ click: () => onSelectOpp(opp) }}
          >
            <LTooltip direction="top" offset={[0, -18]} opacity={1} className="lus-map-tip">
              <div className="min-w-[150px]">
                <p className="text-[11px] font-bold text-white">{opp.name}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: CATEGORY_COLORS[opp.category] }}>
                  {opp.district} · {SPEC_LABELS[opp.category]}
                </p>
                <div className="mt-1 space-y-0.5">
                  <TipRow label="recompensa" value={`${fmtMoney(opp.reward)} ${opp.pays === "clean" ? "limpos" : "sujos"}`} color={opp.pays === "clean" ? "#10B981" : "#F59E0B"} />
                  <TipRow label="risco" value={"●".repeat(opp.risk) + "○".repeat(5 - opp.risk)} color="#EF4444" />
                  <TipRow label="respeito" value={`+${opp.respect}`} color="#0A84FF" />
                  <TipRow label="expira" value={fmtDuration(expiresS)} color="#F59E0B" />
                </div>
                <p className="mt-1 text-[9px] text-zinc-500">
                  {locked ? `Bloqueada — requer nível ${opp.min_level}` : "Clica para escolher equipa e despachar"}
                </p>
              </div>
            </LTooltip>
          </Marker>
        );
      })}
      {state.missions.map((m) => (
        <MissionUnit key={m.id} mission={m} serverNow={serverNow} />
      ))}
      <PanTo target={state.opportunities.find((o) => o.id === selectedOppId)} />
    </MapContainer>
  );
}

export const MapLegend = () => {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="pointer-events-auto absolute right-2 z-30"
      style={{ bottom: "calc(3.6rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {open && (
        <div data-testid="map-legend-panel" className="absolute bottom-full right-0 mb-2 w-56 animate-slide-up rounded-lg border border-white/10 bg-black/85 p-3 shadow-2xl backdrop-blur-xl">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Legenda do mapa</p>
          <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Oportunidades (cor = categoria)</p>
          <div className="mb-2 grid grid-cols-2 gap-x-2 gap-y-1">
            {Object.entries(SPEC_LABELS).map(([k, label]) => (
              <span key={k} className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-300">
                <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[k] }} /> {label}
              </span>
            ))}
          </div>
          <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Marcadores</p>
          <div className="space-y-1 font-mono text-[10px] text-zinc-300">
            <span className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-white text-[8px] text-black">⌂</span> Quartel-general</span>
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-white/40 bg-zinc-800" /> Propriedade tua</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 animate-pulse rounded-full border border-red-500" /> Oportunidade ativa</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-cyan-400" /> Equipa em viagem</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-500" /> Equipa em operação</span>
          </div>
          <p className="mt-2 border-t border-white/10 pt-1.5 text-[9px] leading-snug text-zinc-500">
            Passa o rato sobre qualquer marcador para veres os detalhes. Clica numa oportunidade para despachar uma equipa.
          </p>
        </div>
      )}
      <button
        data-testid="map-legend-toggle"
        onClick={() => setOpen(!open)}
        title="Legenda do mapa"
        className="flex items-center justify-center rounded-full border border-white/10 bg-black/80 p-2 text-zinc-400 shadow-2xl backdrop-blur-xl transition-colors hover:bg-black hover:text-white"
      >
        {open ? <X size={15} /> : <MapIcon size={15} />}
      </button>
    </div>
  );
};
