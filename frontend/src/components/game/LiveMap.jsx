import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip as LTooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Home, Navigation, Shield, Warehouse, FlaskConical, Landmark, Anchor, Wrench, Boxes, Map as MapIcon, Siren, X, Star, Check } from "lucide-react";
import { useGame } from "../../context/GameContextV2";
import { CATEGORY_COLORS, TYPE_ICONS, SPEC_LABELS, missionPosition, fmtMoney, fmtDuration, propertyBenefit, STATUS_LABELS, STATUS_COLORS } from "../../lib/game";
import { fetchRoute, buildCumulative, pointOnRoute, sliceRoute } from "../../lib/routing";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

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

const oppIcon = (opp, selected, favorite) => {
  const Icon = TYPE_ICONS[opp.type_key] || TYPE_ICONS.assalto;
  const color = CATEGORY_COLORS[opp.category] || "#fff";
  const initial = (SPEC_LABELS[opp.category] || "?").charAt(0);
  const taken = opp.status === "taken";
  const html = `
    <div class="opp-pin ${selected ? "opp-pin-selected" : ""} ${taken ? "opp-pin-taken" : ""}" style="--mk:${color}">
      ${renderToStaticMarkup(<Icon size={15} strokeWidth={2.5} />)}
      <span class="opp-pin-type" style="background:${color}">${initial}</span>
      ${favorite ? `<span style="position:absolute;top:-4px;right:-4px;color:#FBBF24;filter:drop-shadow(0 0 2px rgba(0,0,0,0.8))">${renderToStaticMarkup(<Star size={11} fill="#FBBF24" />)}</span>` : ""}
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

const unitIcon = (phase, chased) => {
  const color = chased ? "#EF4444" : phase === "operating" ? "#EF4444" : "#22D3EE";
  const classes = ["unit-pin"];
  if (phase === "operating") classes.push("unit-operating");
  if (chased) classes.push("unit-chased");
  // Só a equipa a caminho ou a regressar pulsa (em branco) — não a operar no alvo
  // (que já tem o próprio "blink") nem em perseguição (que já tem a sirene).
  const traveling = (phase === "en_route" || phase === "returning") && !chased;
  const html = `
    <div class="${classes.join(" ")}" style="--mk:${color}">
      ${chased ? '<span class="unit-siren"></span>' : ''}
      ${traveling ? '<span class="unit-pulse"></span>' : ''}
      ${renderToStaticMarkup(<Navigation size={13} strokeWidth={2.5} />)}
    </div>`;
  return makeDivIcon(html, chased ? 30 : 26);
};

const TRANSFER_COLOR = "#A78BFA";

const transferIcon = () => {
  const html = `
    <div class="unit-pin" style="--mk:${TRANSFER_COLOR}">
      <span class="unit-pulse"></span>
      ${renderToStaticMarkup(<Warehouse size={12} strokeWidth={2.5} />)}
    </div>`;
  return makeDivIcon(html, 24);
};

const policeChaseIcon = () => {
  const html = `
    <div class="chase-pin" style="--mk:#EF4444">
      <span class="chase-flash"></span>
      ${renderToStaticMarkup(<Siren size={12} strokeWidth={3} />)}
    </div>`;
  return makeDivIcon(html, 24);
};

const propIcon = (typeKey) => {
  const Icon = PROP_ICONS[typeKey] || Warehouse;
  const html = `
    <div class="prop-pin">
      ${renderToStaticMarkup(<Icon size={13} strokeWidth={2.5} />)}
    </div>`;
  return makeDivIcon(html, 28);
};

const placementIcon = (valid) => {
  const color = valid ? "#34D399" : "#EF4444";
  const html = `
    <div class="prop-pin placement-pin" style="--mk:${color};border-color:${color}">
      ${renderToStaticMarkup(<Warehouse size={13} strokeWidth={2.5} />)}
    </div>`;
  return makeDivIcon(html, 30, "placement-pin-wrap");
};

// Modo de colocação de propriedades: cada clique/toque no mapa (ou arrasto
// do marcador) reposiciona o pin de pré-visualização — não é preciso um
// "primeiro clique" especial, mover é só voltar a clicar/arrastar.
const PlacementPreview = ({ placement, onPick }) => {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  if (!placement.point) return null;
  return (
    <Marker
      position={[placement.point.lat, placement.point.lng]}
      icon={placementIcon(placement.valid)}
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const p = e.target.getLatLng();
          onPick(p.lat, p.lng);
        },
      }}
      zIndexOffset={600}
    />
  );
};

const PanTo = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.panTo([target.lat, target.lng], { animate: true, duration: 0.6 });
  }, [target, map]);
  return null;
};

// Closes the opportunity/mission modal when the user clicks on the map background.
// Clicks on markers do not propagate to this handler (Leaflet stops them).
const MapBackgroundClick = ({ onClick }) => {
  useMapEvents({
    click: () => { if (onClick) onClick(); },
  });
  return null;
};

const TipRow = ({ label, value, color = "#E4E4E7" }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</span>
    <span className="font-mono text-[10px] font-bold" style={{ color }}>{value}</span>
  </div>
);

const MissionUnit = ({ mission, serverNow, dim = false }) => {
  const [route, setRoute] = useState(null);
  const cumRef = useRef(null);
  const glowRef = useRef(null);
  const lineRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchRoute(mission.origin, mission.target).then((info) => {
      if (cancelled) return;
      cumRef.current = buildCumulative(info.latlngs);
      setRoute(info);
    });
    return () => { cancelled = true; };
  }, [mission.id, mission.origin.lat, mission.origin.lng, mission.target.lat, mission.target.lng]);

  const computePos = () => {
    const now = serverNow();
    const depart = Date.parse(mission.depart_at);
    const arrive = Date.parse(mission.arrive_at);
    const finish = Date.parse(mission.finish_at);
    const ret = Date.parse(mission.return_at);
    // If route not loaded yet, fallback to straight-line lerp.
    if (!route || !cumRef.current) return { ...missionPosition(mission, now), progress: 0 };
    const latlngs = route.latlngs;
    const cum = cumRef.current;
    if (now <= arrive) {
      const t = Math.min(1, Math.max(0, (now - depart) / Math.max(1, arrive - depart)));
      const p = pointOnRoute(latlngs, cum, t);
      return { ...p, phase: "en_route", progress: t };
    }
    if (now <= finish) {
      const last = latlngs[latlngs.length - 1];
      return { lat: last[0], lng: last[1], phase: "operating", progress: 1 };
    }
    if (now <= ret) {
      const t = Math.min(1, Math.max(0, (now - finish) / Math.max(1, ret - finish)));
      const p = pointOnRoute(latlngs, cum, 1 - t);
      return { ...p, phase: "returning", progress: t };
    }
    return { lat: mission.origin.lat, lng: mission.origin.lng, phase: "done", progress: 1 };
  };

  const [pos, setPos] = useState(() => computePos());
  useEffect(() => {
    const id = setInterval(() => setPos(computePos()), 350);
    return () => clearInterval(id);
  }, [mission, serverNow, route]);

  // Imperatively update the polyline positions via ref — avoids React reconciling
  // the SVG element on every tick, which is what makes zoom feel laggy.
  useEffect(() => {
    if (!route?.latlngs || !cumRef.current) return;
    let latlngs = null;
    if (pos.phase === "en_route") {
      latlngs = sliceRoute(route.latlngs, cumRef.current, pos.progress, 1);
    } else if (pos.phase === "returning") {
      latlngs = sliceRoute(route.latlngs, cumRef.current, 1 - pos.progress, 0);
    }
    const arr = latlngs && latlngs.length > 1 ? latlngs : [];
    if (glowRef.current) glowRef.current.setLatLngs(arr);
    if (lineRef.current) lineRef.current.setLatLngs(arr);
  }, [pos.progress, pos.phase, route]);

  // Imperatively update style (dash) only when phase actually changes.
  useEffect(() => {
    const dashArray = pos.phase === "returning" ? "6 6" : null;
    if (lineRef.current) lineRef.current.setStyle({ dashArray });
  }, [pos.phase]);

  const chased = pos.phase === "returning" && !!mission.chase_active;
  const icon = useMemo(() => unitIcon(pos.phase, chased), [pos.phase, chased]);
  if (pos.phase === "done") return null;

  const nowMs = serverNow();
  const nextAt = pos.phase === "en_route" ? mission.arrive_at : pos.phase === "operating" ? mission.finish_at : mission.return_at;
  const nextLabel = pos.phase === "en_route" ? "chega em" : pos.phase === "operating" ? "conclui em" : "regressa em";
  const remaining = Math.max(0, (Date.parse(nextAt) - nowMs) / 1000);

  const carryingReward = (pos.phase === "operating" || pos.phase === "returning") && mission.outcome === "success"
    ? Number(mission.pending_reward || 0)
    : 0;
  const carryingPays = mission.pending_pays || mission.opportunity?.pays || "dirty";

  // Police chase car: rendered ~120m behind on the same route so it visually "follows" the team.
  let chasePos = null;
  if (chased && route?.latlngs && cumRef.current) {
    // returning: vehicle is at fraction (1 - progress); the tail is behind (closer to target)
    const total = cumRef.current[cumRef.current.length - 1] || 0;
    if (total > 0) {
      const lag = Math.min(0.35, 220 / Math.max(1, total)); // ~220m gap or 35% whichever is smaller
      const chaseFrac = Math.min(1, (1 - pos.progress) + lag);
      const cp = pointOnRoute(route.latlngs, cumRef.current, chaseFrac);
      if (cp) chasePos = cp;
    }
  }

  return (
    <>
      {route?.latlngs && route.latlngs.length > 1 && (
        <>
          {/* Glow underlay */}
          <Polyline
            ref={glowRef}
            positions={[]}
            smoothFactor={2}
            pathOptions={{ color: "#FFFFFF", weight: 6, opacity: 0.18, lineCap: "round", lineJoin: "round" }}
            interactive={false}
          />
          {/* Main line */}
          <Polyline
            ref={lineRef}
            positions={[]}
            smoothFactor={2}
            pathOptions={{ color: "#FFFFFF", weight: 2.4, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
            interactive={false}
          />
        </>
      )}
      <Marker position={[pos.lat, pos.lng]} icon={icon} zIndexOffset={500} opacity={dim ? 0.25 : 1}>
        <LTooltip direction="top" offset={[0, -14]} opacity={1} className="lus-map-tip">
          <div className="min-w-[150px]">
            <p className="text-[11px] font-bold text-white">{mission.team_name}</p>
            <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: chased ? "#EF4444" : STATUS_COLORS[pos.phase] || "#22D3EE" }}>
              {chased ? "PERSEGUIÇÃO POLICIAL" : STATUS_LABELS[pos.phase] || pos.phase} · {mission.opportunity?.name}
            </p>
            <TipRow label={nextLabel} value={fmtDuration(remaining)} color="#F59E0B" />
            {mission.success_chance != null && pos.phase === "en_route" && (
              <TipRow label="probabilidade" value={`${Math.round(mission.success_chance * 100)}%`} color="#34D399" />
            )}
            {carryingReward > 0 && (
              <TipRow
                label="a transportar"
                value={`${fmtMoney(carryingReward)} ${carryingPays === "clean" ? "limpos" : "sujos"}`}
                color={carryingPays === "clean" ? "#10B981" : "#F59E0B"}
              />
            )}
            {chased && (
              <TipRow label="escape" value={`${Math.round((mission.escape_chance || 0.5) * 100)}%`} color="#EF4444" />
            )}
            {route && !route.fallback && (
              <TipRow label="rota" value={`${(route.distance / 1000).toFixed(1)} km`} color="#22D3EE" />
            )}
          </div>
        </LTooltip>
      </Marker>
      {chased && chasePos && (
        <Marker position={[chasePos.lat, chasePos.lng]} icon={policeChaseIcon()} zIndexOffset={490}>
          <LTooltip direction="top" offset={[0, -12]} opacity={1} className="lus-map-tip">
            <div className="min-w-[130px]">
              <p className="text-[11px] font-bold text-red-400">Carro-patrulha</p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">A perseguir {mission.team_name}</p>
              <TipRow label="chance de escape" value={`${Math.round((mission.escape_chance || 0.5) * 100)}%`} color="#EF4444" />
              <p className="mt-1 text-[9px] text-zinc-500">
                Se apanhados antes do QG, perdem toda a carga.
              </p>
            </div>
          </LTooltip>
        </Marker>
      )}
    </>
  );
};

// Veículo a caminho de outra base (POST /vehicles/transfer) — mesmo padrão de
// rota/animação do MissionUnit, mas mais simples (sem fases, sem perseguição).
const VehicleTransferUnit = ({ vehicle, serverNow, dim = false }) => {
  const tr = vehicle.transfer;
  const origin = tr.from;
  const target = tr.to;
  const [route, setRoute] = useState(null);
  const cumRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchRoute(origin, target).then((info) => {
      if (cancelled) return;
      cumRef.current = buildCumulative(info.latlngs);
      setRoute(info);
    });
    return () => { cancelled = true; };
  }, [vehicle.id, origin.lat, origin.lng, target.lat, target.lng]);

  const computePos = () => {
    const now = serverNow();
    const started = Date.parse(tr.started_at);
    const ends = Date.parse(tr.ends_at);
    const t = Math.min(1, Math.max(0, (now - started) / Math.max(1, ends - started)));
    if (!route || !cumRef.current) {
      return { lat: origin.lat + (target.lat - origin.lat) * t, lng: origin.lng + (target.lng - origin.lng) * t };
    }
    return pointOnRoute(route.latlngs, cumRef.current, t) || { lat: target.lat, lng: target.lng };
  };

  const [pos, setPos] = useState(() => computePos());
  useEffect(() => {
    const id = setInterval(() => setPos(computePos()), 350);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle, route, serverNow]);

  const remaining = Math.max(0, (Date.parse(tr.ends_at) - serverNow()) / 1000);
  const icon = useMemo(() => transferIcon(), []);

  return (
    <>
      {route?.latlngs && route.latlngs.length > 1 && (
        <Polyline
          positions={route.latlngs}
          smoothFactor={2}
          pathOptions={{ color: TRANSFER_COLOR, weight: 2, opacity: dim ? 0.15 : 0.6, dashArray: "4 6" }}
          interactive={false}
        />
      )}
      <Marker position={[pos.lat, pos.lng]} icon={icon} zIndexOffset={480} opacity={dim ? 0.25 : 1}>
        <LTooltip direction="top" offset={[0, -12]} opacity={1} className="lus-map-tip">
          <div className="min-w-[140px]">
            <p className="text-[11px] font-bold text-white">{vehicle.name}</p>
            <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: TRANSFER_COLOR }}>Em transferência</p>
            <TipRow label="chega em" value={fmtDuration(remaining)} color={TRANSFER_COLOR} />
          </div>
        </LTooltip>
      </Marker>
    </>
  );
};

export default function LiveMap({ state, serverNow, selectedOppId, onSelectOpp, onSelectHQ, baseFilter = "all" }) {
  const { catalog, placement, updatePlacementPoint } = useGame();
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
      <MapBackgroundClick onClick={() => onSelectOpp(null)} />
      {placement && <PlacementPreview placement={placement} onPick={updatePlacementPoint} />}
      <Marker
        position={[hq.lat, hq.lng]}
        icon={hqMarkerIcon}
        zIndexOffset={400}
        opacity={baseFilter === "all" || baseFilter === "hq" ? 1 : 0.25}
        eventHandlers={{ click: () => onSelectHQ && onSelectHQ() }}
      >
        <LTooltip direction="top" offset={[0, -18]} opacity={1} className="lus-map-tip">
          <div className="min-w-[130px]">
            <p className="text-[11px] font-bold text-white">{hq.name}</p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">Quartel-general · {state.player.org_name}</p>
            <p className="mt-0.5 text-[9px] text-cyan-400">Nível {hq.level} · clica para gerir</p>
          </div>
        </LTooltip>
      </Marker>
      {state.properties.map((p) => {
        const pt = catalog?.property_types?.[p.type_key];
        return (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={propIcon(p.type_key)}
            zIndexOffset={300}
            opacity={baseFilter === "all" || baseFilter === p.id ? 1 : 0.25}
          >
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
        const taken = opp.status === "taken";
        const expiresS = Math.max(0, (Date.parse(opp.expires_at) - serverNow()) / 1000);
        const activeMission = taken ? state.missions.find((m) => m.opportunity_id === opp.id) : null;
        let missionEtaS = 0;
        let missionPhaseLabel = "";
        if (activeMission) {
          const nextAt = activeMission.phase === "en_route"
            ? activeMission.arrive_at
            : activeMission.phase === "operating"
            ? activeMission.finish_at
            : activeMission.return_at;
          missionEtaS = Math.max(0, (Date.parse(nextAt) - serverNow()) / 1000);
          missionPhaseLabel = STATUS_LABELS[activeMission.phase] || activeMission.phase;
        }
        const isFavorite = (state.player.favorite_types || []).includes(opp.type_key);
        return (
          <Marker
            key={opp.id}
            position={[opp.lat, opp.lng]}
            icon={oppIcon(opp, opp.id === selectedOppId, isFavorite)}
            zIndexOffset={isFavorite ? 400 : 0}
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
                  {taken && activeMission ? (
                    <>
                      <TipRow label="equipa" value={activeMission.team_name} color="#22D3EE" />
                      <TipRow label={missionPhaseLabel} value={fmtDuration(missionEtaS)} color={STATUS_COLORS[activeMission.phase] || "#F59E0B"} />
                    </>
                  ) : (
                    <TipRow label="expira" value={fmtDuration(expiresS)} color="#F59E0B" />
                  )}
                </div>
                <p className="mt-1 text-[9px] text-zinc-500">
                  {taken
                    ? "Operação em curso — clica para ver detalhes"
                    : locked
                    ? `Bloqueada — requer nível ${opp.min_level}`
                    : state.player.heat >= 90
                    ? "Polícia em alerta máximo — reduz o calor para operar"
                    : `Clica para escolher equipa e despachar (mín. ${opp.min_members} membro${opp.min_members > 1 ? "s" : ""})`}
                </p>
              </div>
            </LTooltip>
          </Marker>
        );
      })}
      {state.missions.map((m) => (
        <MissionUnit
          key={m.id}
          mission={m}
          serverNow={serverNow}
          dim={baseFilter !== "all" && (m.origin_property_id || "hq") !== baseFilter}
        />
      ))}
      {state.vehicles
        .filter((v) => v.transfer?.from && v.transfer?.to && v.transfer?.started_at)
        .map((v) => (
          <VehicleTransferUnit
            key={v.id}
            vehicle={v}
            serverNow={serverNow}
            dim={
              baseFilter !== "all" &&
              (v.property_id || "hq") !== baseFilter &&
              (v.transfer.to_property_id || "hq") !== baseFilter
            }
          />
        ))}
      <PanTo target={state.opportunities.find((o) => o.id === selectedOppId)} />
    </MapContainer>
  );
}

export const MapLegend = () => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Popover: clicar fora ou Escape fecha, tal como qualquer dropdown/menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (ev) => {
      if (containerRef.current && !containerRef.current.contains(ev.target)) setOpen(false);
    };
    const onKeyDown = (ev) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-auto absolute right-2 z-30"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {open && (
        <Card data-testid="map-legend-panel" className="absolute bottom-full right-0 mb-2 w-56 animate-slide-up border-white/10 bg-black/85 p-3 shadow-2xl backdrop-blur-xl">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Legenda do mapa</p>
          <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Oportunidades (cor + inicial = categoria)</p>
          <div className="mb-2 grid grid-cols-2 gap-x-2 gap-y-1">
            {Object.entries(SPEC_LABELS).map(([k, label]) => (
              <span key={k} className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-300">
                <span
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-extrabold text-black"
                  style={{ background: CATEGORY_COLORS[k] }}
                >
                  {label.charAt(0)}
                </span>
                {label}
              </span>
            ))}
          </div>
          <p className="mb-1 text-[9px] uppercase tracking-wider text-zinc-600">Marcadores</p>
          <div className="space-y-1 font-mono text-[10px] text-zinc-300">
            <span className="flex items-center gap-1.5"><span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-white text-[8px] text-black">⌂</span> Quartel-general</span>
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-white/40 bg-zinc-800" /> Propriedade tua</span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-3 w-3 items-center justify-center rounded-full bg-cyan-400">
                <span className="absolute -inset-1 animate-pulse rounded-full border border-white" />
              </span>
              Equipa a caminho / a regressar
            </span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-500" /> Equipa em operação</span>
          </div>
          <p className="mb-1 mt-2 text-[9px] uppercase tracking-wider text-zinc-600">Trajetos (restante)</p>
          <div className="space-y-1 font-mono text-[10px] text-zinc-300">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-6 rounded-full bg-cyan-400" /> A caminho — falta percorrer</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-6 rounded-full border-t-2 border-dashed border-violet-400" /> Regresso — falta chegar</span>
          </div>
          <p className="mt-2 border-t border-white/10 pt-1.5 text-[9px] leading-snug text-zinc-500">
            Passa o rato sobre qualquer marcador para veres os detalhes. Clica numa oportunidade para despachar uma equipa.
          </p>
        </Card>
      )}
      <Button
        data-testid="map-legend-toggle"
        variant="outline" size="icon"
        onClick={() => setOpen(!open)}
        title="Legenda do mapa"
        className="rounded-full border-white/10 bg-black/80 text-zinc-400 shadow-2xl backdrop-blur-xl hover:bg-black hover:text-white"
      >
        {open ? <X size={15} /> : <MapIcon size={15} />}
      </Button>
    </div>
  );
};

// Par de botões flutuante para o modo de colocação de propriedades — mesmo
// visual de MapLegend. Mostra uma dica antes de haver ponto escolhido e
// desativa Confirmar até o ponto estar num local válido.
export const PlacementControls = () => {
  const { placement, confirmPlacement, cancelPlacement } = useGame();
  if (!placement) return null;
  return (
    <div
      className="pointer-events-auto absolute left-1/2 z-30 flex -translate-x-1/2 items-center gap-2"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {!placement.point && (
        <span className="rounded-full border border-white/10 bg-black/80 px-3 py-1.5 font-mono text-[10px] text-zinc-300 shadow-2xl backdrop-blur-xl">
          Toca no mapa para escolher a localização
        </span>
      )}
      <Button
        data-testid="placement-confirm"
        onClick={confirmPlacement}
        disabled={!placement.point || !placement.valid}
        className="gap-1.5 rounded-full bg-emerald-600 text-white shadow-2xl hover:bg-emerald-500 disabled:opacity-40"
      >
        <Check size={15} /> Confirmar
      </Button>
      <Button
        data-testid="placement-cancel"
        variant="outline"
        onClick={cancelPlacement}
        className="gap-1.5 rounded-full border-white/10 bg-black/80 text-zinc-300 shadow-2xl backdrop-blur-xl hover:bg-black hover:text-white"
      >
        <X size={15} /> Cancelar
      </Button>
    </div>
  );
};

// Filtro do mapa por base — segmentado (Tabs), idioma já usado em
// QuestsPanel.jsx para filtros (por oposição a <Select>, que neste código é
// o idioma de atribuição). Esbate (não esconde) propriedades e missões que
// não pertencem à base selecionada.
export const MapBaseFilter = ({ value, onChange }) => {
  const { state } = useGame();
  if (!state?.properties?.length) return null;
  return (
    <div
      className="pointer-events-auto absolute left-2 z-30 max-w-[calc(100vw-1rem)] overflow-x-auto"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <Tabs value={value} onValueChange={onChange}>
        <TabsList className="bg-black/80 backdrop-blur-xl">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="hq">QG</TabsTrigger>
          {state.properties.map((p) => (
            <TabsTrigger key={p.id} value={p.id}>{p.name}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};
