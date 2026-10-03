import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Tooltip as LTooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Home, Shield, Warehouse, FlaskConical, Landmark, Anchor, Wrench, Boxes, Map as MapIcon, X, Star, Check, UserRound } from "lucide-react";
import { useGame } from "../../context/GameContextV2";
import { propertyMarketPrice } from "../../lib/propertyMarket";
import { CATEGORY_COLORS, TYPE_ICONS, SPEC_LABELS, missionPosition, fmtMoney, fmtDuration, propertyBenefit, STATUS_LABELS, STATUS_COLORS, OPP_URGENT_SECONDS } from "../../lib/game";
import { fetchRoute, buildCumulative, pointOnRoute, sliceRoute } from "../../lib/routing";
import { buildChoreography, buildParking, vehiclePoseAt, missionStateAt, opStateAt, commAt, CHOREO_LABELS } from "../../lib/choreo";
import PoliceLayer from "./PoliceLayer";
import MapBaseLayer from "./MapBaseLayer";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

const isFiniteMapPoint = (point) =>
  !!point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));

const normaliseMissionForMap = (mission, hq) => {
  if (!mission) return null;
  const target = isFiniteMapPoint(mission.target)
    ? { lat: Number(mission.target.lat), lng: Number(mission.target.lng) }
    : isFiniteMapPoint(hq)
    ? { lat: Number(hq.lat), lng: Number(hq.lng) }
    : null;
  const origin = isFiniteMapPoint(mission.origin)
    ? { lat: Number(mission.origin.lat), lng: Number(mission.origin.lng) }
    : target;
  if (!origin || !target) return null;
  return {
    ...mission,
    origin,
    target,
    depart_at: mission.depart_at || mission.started_at || mission.arrive_at,
  };
};

const safeRiskLevel = (value) => Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
const safeRiskDots = (value) => {
  const risk = safeRiskLevel(value);
  return "●".repeat(risk) + "○".repeat(5 - risk);
};

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

const oppIcon = (opp, selected, favorite, urgent) => {
  const Icon = TYPE_ICONS[opp.type_key] || TYPE_ICONS.assalto;
  const color = CATEGORY_COLORS[opp.category] || "#fff";
  const initial = (SPEC_LABELS[opp.category] || "?").charAt(0);
  const taken = opp.status === "taken";
  const html = `
    <div class="opp-pin ${selected ? "opp-pin-selected" : ""} ${taken ? "opp-pin-taken" : ""} ${urgent && !taken ? "opp-pin-urgent" : ""}" style="--mk:${color}">
      ${renderToStaticMarkup(<Icon size={15} strokeWidth={2.5} />)}
      <span class="opp-pin-type" style="background:${color}">${initial}</span>
      ${favorite ? `<span style="position:absolute;top:-4px;right:-4px;color:#FBBF24;filter:drop-shadow(0 0 2px rgba(0,0,0,0.8))">${renderToStaticMarkup(<Star size={11} fill="#FBBF24" />)}</span>` : ""}
    </div>`;
  return makeDivIcon(html, 34);
};

// Cache de ícones por assinatura visual — evita recriar divIcons (e o churn de
// DOM do setIcon) a cada poll de estado, para todos os pins de oportunidade.
const oppIconCache = new Map();
const oppIconCached = (opp, selected, favorite, urgent) => {
  const key = `${opp.type_key}|${opp.category}|${opp.status === "taken" ? 1 : 0}|${selected ? 1 : 0}|${favorite ? 1 : 0}|${urgent ? 1 : 0}`;
  let icon = oppIconCache.get(key);
  if (!icon) {
    icon = oppIcon(opp, selected, favorite, urgent);
    oppIconCache.set(key, icon);
  }
  return icon;
};

// `skinColor` (da loja — Player.hq_skin_key) recolore a moldura do marcador;
// sem skin comprada/equipada, cai no contorno preto por omissão.
const hqIcon = (skinColor) => {
  const style = skinColor ? ` style="--skin:${skinColor}"` : "";
  const html = `
    <div class="hq-pin"${style}>
      ${renderToStaticMarkup(<Home size={16} strokeWidth={2.5} />)}
    </div>`;
  return makeDivIcon(html, 36);
};

// Veículo top-down — o corpo (<span data-car>) é rodado pelo loop rAF para o
// rumo real da via: em movimento segue a estrada, estacionado fica orientado
// no sentido em que chegou (encostado à berma, nunca sobre o alvo).
const unitIcon = (phase, chased) => {
  const parked = phase === "operating" && !chased;
  const color = chased ? "#EF4444" : parked ? "#0E7490" : phase === "returning" ? "#F59E0B" : "#22D3EE";
  const classes = ["unit-car"];
  if (parked) classes.push("unit-car-parked");
  if (chased) classes.push("unit-car-chased");
  const html = `
    <div class="${classes.join(" ")}" style="--mk:${color}">
      <span class="unit-car-body" data-car>
        <span class="unit-car-glass"></span>
        <span class="unit-car-door unit-car-door-l"></span>
        <span class="unit-car-door unit-car-door-r"></span>
      </span>
      ${parked ? '<span class="unit-parked-badge">P</span>' : ""}
    </div>`;
  return makeDivIcon(html, 30);
};

// ---------- Execução visual das missões: operacionais + halo do alvo ----------
// Ícones cacheados por assinatura visual (mesmo padrão do oppIconCached) e
// marcadores NÃO interativos — puramente visuais, custo mínimo por frame.
const opIconCache = new Map();
const opIconCached = (kind) => {
  let icon = opIconCache.get(kind);
  if (!icon) {
    const html = `
      <div class="op-pin op-${kind}">
        <span class="op-face-wrap" data-face><span class="op-face"></span></span>
        ${renderToStaticMarkup(<UserRound size={9} strokeWidth={3} />)}
        <span class="op-carry-badge"></span>
      </div>`;
    icon = L.divIcon({ html, className: "lus-marker lus-marker-op", iconSize: [14, 14], iconAnchor: [7, 7] });
    opIconCache.set(kind, icon);
  }
  return icon;
};

const TRANSFER_COLOR = "#A78BFA";

// Alvo físico da missão — marcador vermelho persistente, visível do despacho
// ao fim da operação. Variante "hot" (execução) acende o anel.
const missionTargetIconCache = new Map();
const missionTargetIconCached = (hot) => {
  const key = hot ? "hot" : "idle";
  let icon = missionTargetIconCache.get(key);
  if (!icon) {
    const html = `
      <div class="mission-target ${hot ? "mission-target-hot" : ""}">
        <span class="mission-target-ring"></span>
        <span class="mission-target-cross"></span>
        <span class="mission-target-dot"></span>
      </div>`;
    icon = L.divIcon({ html, className: "lus-marker", iconSize: [30, 30], iconAnchor: [15, 15] });
    missionTargetIconCache.set(key, icon);
  }
  return icon;
};

const transferIcon = () => {
  const html = `
    <div class="unit-pin" style="--mk:${TRANSFER_COLOR}">
      ${renderToStaticMarkup(<Warehouse size={12} strokeWidth={2.5} />)}
    </div>`;
  return makeDivIcon(html, 24);
};

// Perseguição policial: agora simulada pela força policial viva (PoliceLayer /
// lib/police.js) — uma patrulha real intercepta e cola-se à rota da equipa.

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

// Câmara inteligente na seleção: se o zoom estiver longe, voa até um zoom de
// leitura confortável; caso contrário, só desloca suavemente.
const PanTo = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (!isFiniteMapPoint(target)) return;
    if (map.getZoom() < 13) map.flyTo([Number(target.lat), Number(target.lng)], 13.5, { duration: 0.7 });
    else map.panTo([Number(target.lat), Number(target.lng)], { animate: true, duration: 0.6 });
  }, [target, map]);
  return null;
};

// Nota: os antigos controlos de câmara (+/−/centrar/enquadrar) foram removidos —
// em mobile o zoom faz-se com os dedos e em desktop com a roda do rato/duplo clique.

// Arrastar o mapa liberta a câmara do modo seguir — comportamento standard
// de qualquer "follow cam".
const FollowManager = ({ onCancel }) => {
  useMapEvents({ dragstart: () => onCancel() });
  return null;
};

const FollowChip = ({ name, onStop }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) L.DomEvent.disableClickPropagation(ref.current);
  }, []);
  return (
    <div ref={ref} className="lus-follow-chip" data-testid="map-follow-chip">
      <span className="lus-follow-dot" aria-hidden="true" />
      A seguir {name}
      <button type="button" data-testid="map-follow-stop" title="Parar de seguir" aria-label="Parar de seguir" onClick={onStop}>
        <X size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
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

const MissionUnit = ({ mission, serverNow, dim = false, followed = false, onToggleFollow, roster }) => {
  const map = useMap();
  const [route, setRoute] = useState(null);
  const cumRef = useRef(null);
  const glowRef = useRef(null);
  const lineRef = useRef(null);
  const markerRef = useRef(null);
  const svgRef = useRef(null);
  const carRootRef = useRef(null);
  const bearingRef = useRef(null);
  const posRef = useRef(null);
  const commLineRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchRoute(mission.origin, mission.target).then((info) => {
      if (cancelled) return;
      // Estacionamento credível (buildParking): recuo 25–50m seeded por
      // missão, encosto lateral à berma e rumo da via — nunca sobre o alvo.
      const parking = buildParking(mission, info);
      cumRef.current = parking.cum;
      setRoute({ ...info, parking, parkFrac: parking.parkFrac, park: parking.park });
    });
    return () => { cancelled = true; };
  }, [mission.id, mission.origin.lat, mission.origin.lng, mission.target.lat, mission.target.lng]);

  // Coreografia determinística da operação no terreno — construída uma vez por
  // rota/janela de execução; avaliada por frame no mesmo loop rAF do veículo.
  // v3: usa o roster real (especializações/patentes) para papéis, líder,
  // batedor, retaguarda e motorista ao volante.
  const memberCount = Math.max(1, Math.min(6, (mission.member_ids || []).length || 2));
  const rosterKey = (roster || []).map((r) => `${r.role_key}:${r.spec}:${r.rank}`).join(",");
  const choreo = useMemo(() => {
    if (!route?.parking) return null;
    return buildChoreography(mission, route.parking, memberCount, roster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, mission.id, mission.arrive_at, mission.finish_at, memberCount, rosterKey]);
  const choreoRef = useRef(null);
  choreoRef.current = choreo;
  const opMarkersRef = useRef([]);
  const opElsRef = useRef([]);
  const opFaceElsRef = useRef([]);
  const opHeadingRef = useRef([]);
  const opFlagsRef = useRef([]);

  const computePos = () => {
    const now = serverNow();
    // Rota ainda não carregada — fallback em linha reta (sem rumo).
    if (!route?.parking) return { ...missionPosition(mission, now), progress: 0, frac: 0, bearing: null, state: null };
    // Pose completa do motor de estados: posição com aceleração/travagem
    // reais, encosto à berma, rumo da via e estado nomeado.
    return vehiclePoseAt(mission, route.parking, now);
  };

  // PERF: o movimento é 100% imperativo num loop requestAnimationFrame —
  // marker.setLatLng por frame (deslize real a 60fps) sem passar pelo React.
  // O React só re-renderiza quando a FASE muda (ícone/estilo/dash) e a 1 Hz
  // para manter os countdowns do tooltip frescos. Antes: setState a cada
  // 350ms (movimento aos saltos + reconciliação constante do tooltip).
  const [phase, setPhase] = useState(() => computePos().phase);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    let raf;
    let lastLine = 0;
    let lastTick = 0;

    const loop = (now) => {
      const p = computePos();
      posRef.current = p;

      // 1) Marcador — deslize por frame.
      const mk = markerRef.current;
      if (mk && p.phase !== "done") mk.setLatLng([p.lat, p.lng]);

      // 2) Rumo com lerp angular (wrap 360°) aplicado diretamente ao corpo do
      //    veículo (<span data-car>) — em movimento segue a estrada; quando
      //    estaciona converge para o rumo da via e mantém a orientação.
      if (mk && p.bearing != null) {
        let el = svgRef.current;
        if (!el || !el.isConnected) {
          el = mk.getElement?.()?.querySelector("[data-car]") || null;
          svgRef.current = el;
        }
        if (el) {
          const cur = bearingRef.current == null ? p.bearing : bearingRef.current;
          const diff = ((p.bearing - cur + 540) % 360) - 180;
          const next = cur + diff * 0.18;
          bearingRef.current = next;
          el.style.transform = `rotate(${next.toFixed(1)}deg)`;
        }
      }

      // 3) Trajeto restante — o <path> SVG é mais caro; 3x/s chega.
      if (now - lastLine > 320) {
        lastLine = now;
        if (route?.latlngs && cumRef.current) {
          let latlngs = null;
          if (p.phase === "en_route") {
            latlngs = sliceRoute(route.latlngs, cumRef.current, p.frac ?? p.progress, route.parkFrac ?? 1);
          } else if (p.phase === "returning") {
            latlngs = sliceRoute(route.latlngs, cumRef.current, p.frac ?? (1 - p.progress), 0);
          }
          const arr = latlngs && latlngs.length > 1 ? latlngs : [];
          if (glowRef.current) glowRef.current.setLatLngs(arr);
          if (lineRef.current) lineRef.current.setLatLngs(arr);
        }
      }

      // 4) (o carro-patrulha da perseguição vive agora na PoliceLayer)

      // 4b) Operacionais no terreno — avaliados no MESMO loop (zero rAF extra).
      //     Posição via setLatLng; fades/escala/orientação do olhar/objetos/
      //     rádio aplicados diretamente aos elementos (compositor), sem React.
      const ch = choreoRef.current;
      if (ch && p.phase === "operating") {
        const nowSec = serverNow() / 1000;
        const success = mission.outcome === "success";
        const states = new Array(ch.ops.length).fill(null);
        for (let i = 0; i < ch.ops.length; i++) {
          const opMk = opMarkersRef.current[i];
          if (!opMk) continue;
          let el = opElsRef.current[i];
          if (!el || !el.isConnected) {
            el = opMk.getElement?.()?.querySelector(".op-pin") || null;
            opElsRef.current[i] = el;
            opFaceElsRef.current[i] = el ? el.querySelector("[data-face]") : null;
          }
          const st = opStateAt(ch, i, nowSec, success);
          states[i] = st;
          if (!st) {
            if (el) el.style.opacity = "0";
            continue;
          }
          opMk.setLatLng([st.lat, st.lng]);
          if (el) {
            el.style.opacity = ((dim ? 0.25 : 1) * st.alpha).toFixed(2);
            el.style.transform = `scale(${st.scale.toFixed(2)})`;
            // Orientação do olhar — lerp angular no wedge (compositor).
            const face = opFaceElsRef.current[i];
            if (face && st.heading != null) {
              const cur = opHeadingRef.current[i] == null ? st.heading : opHeadingRef.current[i];
              const diff = ((st.heading - cur + 540) % 360) - 180;
              const next = cur + diff * 0.22;
              opHeadingRef.current[i] = next;
              face.style.transform = `rotate(${next.toFixed(1)}deg)`;
            }
            const flags = opFlagsRef.current[i] || (opFlagsRef.current[i] = {});
            if (flags.carryKind !== st.carryKind) {
              flags.carryKind = st.carryKind;
              el.classList.toggle("op-carrying", !!st.carryKind);
              el.classList.toggle("op-carry-money", st.carryKind === "money");
              el.classList.toggle("op-carry-box", st.carryKind === "box");
              el.classList.toggle("op-carry-doc", st.carryKind === "doc");
            }
            if (flags.walking !== st.walking) {
              flags.walking = st.walking;
              el.classList.toggle("op-walking", !!st.walking);
            }
            if (flags.running !== st.running) {
              flags.running = st.running;
              el.classList.toggle("op-running", !!st.running);
            }
            if (!flags.tagged) {
              flags.tagged = true;
              if (ch.ops[i].isLeader) el.classList.add("op-leader");
              if (ch.ops[i].isRear) el.classList.add("op-rear");
            }
          }
        }

        // Comunicações rádio: ping em quem emite + linha tracejada até quem recebe.
        const comm = commAt(ch, nowSec);
        const fromEl = comm ? opElsRef.current[comm.from] : null;
        for (let i = 0; i < ch.ops.length; i++) {
          const el = opElsRef.current[i];
          if (!el) continue;
          const flags = opFlagsRef.current[i] || (opFlagsRef.current[i] = {});
          const active = !!comm && comm.from === i && !!states[i];
          if (flags.radio !== active) {
            flags.radio = active;
            el.classList.toggle("op-radio", active);
          }
        }
        if (commLineRef.current) {
          if (comm && states[comm.from] && states[comm.to] && fromEl) {
            commLineRef.current.setLatLngs([
              [states[comm.from].lat, states[comm.from].lng],
              [states[comm.to].lat, states[comm.to].lng],
            ]);
          } else {
            commLineRef.current.setLatLngs([]);
          }
        }

        // Portas do veículo: abertas no desembarque/embarque, fecham antes de partir.
        let car = carRootRef.current;
        if (!car || !car.isConnected) {
          car = mk?.getElement?.()?.querySelector(".unit-car") || null;
          carRootRef.current = car;
        }
        if (car) {
          const doorsOpen =
            (nowSec >= ch.doorsOpenAt && nowSec < ch.doorsCloseExitAt) ||
            (nowSec >= ch.boardDoorsOpenAt && nowSec < ch.doorsFinalCloseAt);
          car.classList.toggle("unit-doors-open", doorsOpen);
        }
      } else if (commLineRef.current) {
        commLineRef.current.setLatLngs([]);
      }

      // 5) Follow cam — sem animação: o próprio rAF é a animação.
      if (followed && p.phase !== "done") map.panTo([p.lat, p.lng], { animate: false });

      // 6) Fase mudou → re-render (ícone, dash, tooltip). setState com o mesmo
      //    valor não re-renderiza, por isso isto é grátis em regime normal.
      setPhase((prev) => (prev === p.phase ? prev : p.phase));

      // 7) Countdown do tooltip a 1 Hz.
      if (now - lastTick > 1000) {
        lastTick = now;
        setClockTick((t) => t + 1);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, mission, followed, map, dim]);

  // Dash do trajeto de regresso — só quando a fase realmente muda.
  useEffect(() => {
    if (lineRef.current) lineRef.current.setStyle({ dashArray: phase === "returning" ? "6 6" : null });
  }, [phase]);

  // Saída da fase de operação → os marcadores dos operacionais desmontam;
  // limpa as caches de elementos/flags para a próxima missão no mesmo slot.
  useEffect(() => {
    if (phase !== "operating") {
      opMarkersRef.current = [];
      opElsRef.current = [];
      opFaceElsRef.current = [];
      opHeadingRef.current = [];
      opFlagsRef.current = [];
    }
  }, [phase]);

  const chased = phase === "returning" && !!mission.chase_active;
  const icon = useMemo(() => unitIcon(phase, chased), [phase, chased]);
  // Ícone novo = elemento DOM novo — invalida a cache do <svg> rodado.
  useEffect(() => {
    svgRef.current = null;
    carRootRef.current = null;
  }, [icon]);
  if (phase === "done") return null;

  const pos = posRef.current || computePos();

  const nowMs = serverNow();
  const nextAt = phase === "en_route" ? mission.arrive_at : phase === "operating" ? mission.finish_at : mission.return_at;
  const nextLabel = phase === "en_route" ? "chega em" : phase === "operating" ? "conclui em" : "regressa em";
  const remaining = Math.max(0, (Date.parse(nextAt) - nowMs) / 1000);

  const carryingReward = (phase === "operating" || phase === "returning") && mission.outcome === "success"
    ? Number(mission.pending_reward || 0)
    : 0;
  const carryingPays = mission.pending_pays || mission.opportunity?.pays || "dirty";

  // Perseguição: visual do carro-patrulha entregue à PoliceLayer (patrulha
  // real intercepta e segue a equipa na mesma rota). Aqui fica só o estado
  // "chased" para o estilo/sirene do veículo da equipa.

  // Estado inicial dos operacionais para o primeiro render (o rAF assume logo a seguir).
  const deployed = phase === "operating" && !!choreo;
  const nowSec0 = nowMs / 1000;

  // Estado nomeado da máquina de estados (Deslocação, Reposicionamento,
  // Desembarque, Reconhecimento, Aproximação, Execução, Retirada,
  // Reagrupamento, Embarque, Confirmação, Regresso) — atualizado a 1 Hz pelo
  // clockTick, alimenta os tooltips do veículo e alvo.
  const mstate = missionStateAt(mission, choreo, nowMs);

  const groundCount = choreo?.groundCount ?? memberCount;

  return (
    <>
      {/* Alvo físico da operação — marcador vermelho visível do despacho ao fim.
          Clique abre a Câmara da Operação (vista tática do interior). */}
      <Marker
        position={[mission.target.lat, mission.target.lng]}
        icon={missionTargetIconCached(phase === "operating")}
        zIndexOffset={340}
        opacity={dim ? 0.25 : 1}
        eventHandlers={{
          click: () => window.dispatchEvent(new CustomEvent("lus:open-operation", { detail: { id: mission.id } })),
        }}
      >
        <LTooltip direction="top" offset={[0, -12]} opacity={1} className="lus-map-tip">
          <div className="min-w-[150px]">
            <p className="text-[11px] font-bold text-red-400">{mission.opportunity?.name}</p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
              Alvo da operação · {mission.opportunity?.district}
            </p>
            <div className="mt-1 space-y-0.5">
              <TipRow label="fase" value={mstate.label} color={chased ? "#EF4444" : STATUS_COLORS[phase] || "#EF4444"} />
              <TipRow label={nextLabel} value={fmtDuration(remaining)} color="#F59E0B" />
              <TipRow label="equipa" value={mission.team_name} color="#22D3EE" />
              {phase === "operating" && (
                <TipRow label="no terreno" value={`${groundCount} operacionais`} color="#FAFAFA" />
              )}
            </div>
            {phase === "operating" && choreo?.driverInside && (
              <p className="mt-0.5 text-[9px] text-cyan-500/80">Motorista ao volante — pronto para a fuga</p>
            )}
            {choreo && <p className="mt-1 text-[9px] text-zinc-500">{CHOREO_LABELS[choreo.kind]}</p>}
            <p className="mt-1 text-[9px] text-red-400/90">
              {phase === "operating" ? "Clica para abrir a câmara da operação" : "Clica para veres o interior do alvo"}
            </p>
          </div>
        </LTooltip>
      </Marker>
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
      {deployed && (
        <>
          {/* Trilho a pé veículo -> alvo (subtil, não interativo) */}
          <Polyline
            positions={choreo.basePath.latlngs}
            smoothFactor={1}
            pathOptions={{ color: "#E4E4E7", weight: 1.2, opacity: dim ? 0.08 : 0.28, dashArray: "2 5", lineCap: "round" }}
            interactive={false}
          />
          {/* Linha de comunicações rádio entre operacionais (gerida no rAF) */}
          <Polyline
            ref={commLineRef}
            positions={[]}
            smoothFactor={1}
            pathOptions={{ color: "#22D3EE", weight: 1.1, opacity: dim ? 0.15 : 0.65, dashArray: "3 4", lineCap: "round" }}
            interactive={false}
          />
          {/* Operacionais — marcadores puramente visuais, movidos pelo loop rAF */}
          {choreo.ops.map((op, i) => {
            const st = opStateAt(choreo, i, nowSec0, mission.outcome === "success");
            return (
              <Marker
                key={`${mission.id}-op-${i}`}
                ref={(el) => { opMarkersRef.current[i] = el; }}
                position={[st?.lat ?? choreo.park.lat, st?.lng ?? choreo.park.lng]}
                icon={opIconCached(choreo.kind)}
                interactive={false}
                keyboard={false}
                zIndexOffset={520}
              />
            );
          })}
        </>
      )}
      <Marker
        ref={markerRef}
        position={[pos.lat, pos.lng]}
        icon={icon}
        zIndexOffset={500}
        opacity={dim ? 0.25 : 1}
        eventHandlers={{ click: () => onToggleFollow && onToggleFollow() }}
      >
        <LTooltip direction="top" offset={[0, -14]} opacity={1} className="lus-map-tip">
          <div className="min-w-[150px]">
            <p className="text-[11px] font-bold text-white">{mission.team_name}</p>
            <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: chased ? "#EF4444" : STATUS_COLORS[pos.phase] || "#22D3EE" }}>
              {chased ? "PERSEGUIÇÃO POLICIAL" : STATUS_LABELS[pos.phase] || pos.phase} · {mission.opportunity?.name}
            </p>
            <TipRow label="fase" value={mstate.label} color={chased ? "#EF4444" : STATUS_COLORS[pos.phase] || "#22D3EE"} />
            <TipRow label={nextLabel} value={fmtDuration(remaining)} color="#F59E0B" />
            {phase === "operating" && (
              <TipRow label="no terreno" value={`${groundCount} operacionais`} color="#FAFAFA" />
            )}
            {phase === "operating" && choreo && (
              <p className="mt-0.5 text-[9px] text-zinc-400">
                {choreo.driverInside ? "Motorista ao volante" : "Veículo estacionado"} · {CHOREO_LABELS[choreo.kind]}
              </p>
            )}
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
            <p className="mt-1 text-[9px] text-cyan-500/80">
              {followed ? "A câmara está a segui-la — clica para largar" : "Clica para a câmara seguir esta unidade"}
            </p>
          </div>
        </LTooltip>
      </Marker>
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
  const hq = state?.player?.hq;
  const hqSkinColor = catalog?.shop?.hq_skins?.[state?.player?.hq_skin_key]?.color;
  const hqMarkerIcon = useMemo(() => hqIcon(hqSkinColor), [hqSkinColor]);
  const level = state.player.level;

  // Roster real por operacional (especialização/patente) — alimenta a
  // coreografia v3 (papéis por especialização, líder, motorista ao volante).
  const empById = useMemo(() => {
    const m = {};
    for (const e of state.employees || []) m[e.id] = e;
    return m;
  }, [state.employees]);

  // Modo seguir: id da missão cuja unidade a câmara acompanha.
  const [followId, setFollowId] = useState(null);
  const followedMission = followId ? state.missions.find((m) => m.id === followId) : null;

  // Selecionar uma oportunidade liberta a câmara.
  useEffect(() => {
    if (selectedOppId) setFollowId(null);
  }, [selectedOppId]);

  // Missão terminou/desapareceu do estado → deixa de haver o que seguir.
  useEffect(() => {
    if (followId && !state.missions.some((m) => m.id === followId)) setFollowId(null);
  }, [state.missions, followId]);

  // O dock "Operação em Direto" pode pedir para a câmara seguir uma unidade.
  useEffect(() => {
    const onFollow = (ev) => setFollowId(ev.detail?.id || null);
    window.addEventListener("lus:follow-mission", onFollow);
    return () => window.removeEventListener("lus:follow-mission", onFollow);
  }, []);

  // Guard defensivo (depois de todos os hooks): sem QG não há mapa do jogo —
  // acontece no onboarding (hq_pending) ou em qualquer estado inesperado.
  // Evita o crash "Cannot read properties of undefined (reading 'lat')".
  if (!hq || hq.lat == null) return null;

  return (
    <MapContainer
      // Câmara inicial centrada no Quartel-General do jogador (e não numa
      // cidade fixa): vale para o primeiro mount logo após colocar o QG no
      // onboarding e para cada início de sessão — o jogo abre sempre "em casa".
      center={[hq.lat, hq.lng]}
      zoom={13}
      zoomControl={false}
      className="lus-dark-map absolute inset-0 z-0 h-full w-full"
      attributionControl={true}
    >
      <MapBaseLayer />
      <MapBackgroundClick onClick={() => onSelectOpp(null)} />
      <FollowManager onCancel={() => setFollowId(null)} />
      {followedMission && <FollowChip name={followedMission.team_name} onStop={() => setFollowId(null)} />}
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
        const urgent = !taken && !locked && expiresS > 0 && expiresS < OPP_URGENT_SECONDS;
        // Filtro por base: esbate as oportunidades geradas por outra base
        // (mesma semântica das missões — generated_by_property_id ou "hq").
        const dim = baseFilter !== "all" && (opp.generated_by_property_id || "hq") !== baseFilter;
        return (
          <Marker
            key={opp.id}
            position={[opp.lat, opp.lng]}
            icon={oppIconCached(opp, opp.id === selectedOppId, isFavorite, urgent)}
            opacity={dim ? 0.25 : 1}
            zIndexOffset={isFavorite ? 400 : urgent ? 350 : 0}
            eventHandlers={{ click: () => { setFollowId(null); onSelectOpp(opp); } }}
          >
            <LTooltip direction="top" offset={[0, -18]} opacity={1} className="lus-map-tip">
              <div className="min-w-[150px]">
                <p className="text-[11px] font-bold text-white">{opp.name}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: CATEGORY_COLORS[opp.category] }}>
                  {opp.district} · {SPEC_LABELS[opp.category]}
                </p>
                <div className="mt-1 space-y-0.5">
                  <TipRow label="recompensa" value={`${fmtMoney(opp.reward)} ${opp.pays === "clean" ? "limpos" : "sujos"}`} color={opp.pays === "clean" ? "#10B981" : "#F59E0B"} />
                  <TipRow label="risco" value={safeRiskDots(opp.risk)} color="#EF4444" />
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
      {state.missions.map((m) => {
        const safeMission = normaliseMissionForMap(m, state.player?.hq);
        if (!safeMission) return null;
        return (
          <MissionUnit
            key={safeMission.id}
            mission={safeMission}
            serverNow={serverNow}
            dim={baseFilter !== "all" && (safeMission.origin_property_id || "hq") !== baseFilter}
            followed={safeMission.id === followId}
            onToggleFollow={() => setFollowId((cur) => (cur === safeMission.id ? null : safeMission.id))}
            roster={(safeMission.member_ids || [])
              .map((id) => empById[id])
              .filter(Boolean)
              .map((e) => ({ role_key: e.role_key, spec: e.spec, rank: e.rank }))}
          />
        );
      })}
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
      <PoliceLayer state={state} serverNow={serverNow} />
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
        <Card
          data-testid="map-legend-panel"
          className="absolute bottom-full right-0 mb-2 w-60 max-w-[calc(100vw-1.25rem)] animate-slide-up overflow-y-auto overscroll-contain border-white/10 bg-[#0a0a0c]/95 p-3 shadow-2xl"
          style={{ maxHeight: "min(calc(100dvh - 9rem), 34rem)" }}
        >
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
              <span className="relative flex h-3 w-3 items-center justify-center">
                <span className="h-3 w-1.5 rounded-sm bg-cyan-400" />
                <span className="absolute -inset-0.5 animate-pulse rounded-full border border-white" />
              </span>
              Veículo a caminho / a regressar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-extrabold text-cyan-200">
                <span className="h-3 w-1.5 rounded-sm bg-cyan-800" />
              </span>
              Veículo estacionado (orientado à via)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full border border-red-500/70">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              </span>
              Alvo da missão (visível toda a operação)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-black bg-zinc-100" />
              Operacionais no terreno (papéis distintos)
            </span>
            <span className="flex items-start gap-1.5">
              <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                <span className="flex h-3 w-2.5 items-center justify-center rounded-sm bg-blue-500 text-[6px] font-black text-black">P</span>
              </span>
              <span><b className="text-blue-300">PSP</b> — centros urbanos: muitas patrulhas, resposta imediata mas curto alcance; cerco compacto, perseguições curtas.</span>
            </span>
            <span className="flex items-start gap-1.5">
              <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                <span className="flex h-3 w-2.5 items-center justify-center rounded-sm bg-green-600 text-[6px] font-black text-black">G</span>
              </span>
              <span><b className="text-green-300">GNR</b> — periferia, estradas e campo: menos patrulhas mas alcance vasto, resposta mais lenta; reforços em maior número, perseguições longas e persistentes.</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 items-center justify-center">
                <span className="h-3 w-1.5 animate-pulse rounded-sm bg-blue-400 shadow-[0_0_6px_#3b82f6]" />
              </span>
              Patrulha com luzes — a responder / em perseguição
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-full border border-dashed border-blue-400/70" />
              Perímetro de patrulha junto ao QG e imóveis
            </span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-blue-900 bg-blue-200" /> Agentes no terreno (perímetro)</span>
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 animate-pulse rounded-full border-2 border-amber-400" /> Oportunidade a expirar (&lt;{Math.round(OPP_URGENT_SECONDS / 60)} min)</span>
          </div>
          <p className="mb-1 mt-2 text-[9px] uppercase tracking-wider text-zinc-600">Trajetos (restante)</p>
          <div className="space-y-1 font-mono text-[10px] text-zinc-300">
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-6 rounded-full bg-cyan-400" /> A caminho — falta percorrer</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-6 rounded-full border-t-2 border-dashed border-violet-400" /> Regresso — falta chegar</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-6 rounded-full border-t border-dotted border-zinc-300" /> Trilho a pé veículo ↔ alvo</span>
          </div>
        </Card>
      )}
      <Button
        data-testid="map-legend-toggle"
        variant="outline" size="icon"
        onClick={() => setOpen(!open)}
        title="Legenda do mapa"
        className="rounded-full border-white/10 bg-[#0a0a0c]/95 text-zinc-400 shadow-2xl hover:bg-black hover:text-white"
      >
        {open ? <X size={15} /> : <MapIcon size={15} />}
      </Button>
    </div>
  );
};

// Painel flutuante do modo de colocação de propriedades — quando ativo, a
// GamePage esconde o dock e restantes widgets do fundo, por isso este painel
// tem sempre o centro-fundo livre (z-40 garante topo da pilha). Mostra o tipo
// de propriedade, o estado do ponto escolhido e botões grandes e clicáveis.
export const PlacementControls = () => {
  const { placement, confirmPlacement, cancelPlacement, catalog } = useGame();
  if (!placement) return null;
  const propertyType = catalog?.property_types?.[placement.typeKey];
  const typeName = propertyType?.name || "Propriedade";
  const invalid = placement.point && !placement.valid;
  const market = placement.point && placement.valid && propertyType?.price
    ? propertyMarketPrice(propertyType.price, placement.point.lat, placement.point.lng)
    : null;
  return (
    <div
      data-testid="placement-controls"
      className="pointer-events-auto absolute left-1/2 z-40 w-[calc(100vw-1rem)] max-w-md -translate-x-1/2"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="lus-panel animate-slide-up rounded-xl border p-3 shadow-2xl">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-1.5 w-1.5 animate-pulse rounded-full ${invalid ? "bg-red-500" : "bg-emerald-400"}`} />
          <p className={`font-mono text-[9px] font-bold uppercase tracking-[0.24em] ${invalid ? "text-red-400" : "text-emerald-300"}`}>
            Modo de colocação
          </p>
        </div>
        <p className="mt-1 font-mono text-[11px] leading-snug text-zinc-300" data-testid="placement-hint">
          <span className="font-bold text-white">{typeName}</span>
          {" — "}
          {!placement.point
            ? "toca no mapa para escolheres a localização."
            : invalid
            ? "local inválido: escolhe um ponto em terra firme."
            : `localização válida · ${market?.zone || "Portugal"} · ${market?.price?.toLocaleString("pt-PT") || "—"} €.`}
        </p>
        {market && (
          <p className="mt-1 font-mono text-[9px] text-zinc-500">
            Base {propertyType.price.toLocaleString("pt-PT")} € × índice regional {market.multiplier.toFixed(2)}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Button
            data-testid="placement-confirm"
            onClick={confirmPlacement}
            disabled={!placement.point || !placement.valid}
            variant="success"
            className="flex-1 gap-1.5 rounded-full disabled:opacity-40"
          >
            <Check size={15} /> Confirmar
          </Button>
          <Button
            data-testid="placement-cancel"
            variant="outline"
            onClick={cancelPlacement}
            className="flex-1 gap-1.5 rounded-full border-white/10 bg-[#0a0a0c]/95 text-zinc-300 hover:bg-black hover:text-white"
          >
            <X size={15} /> Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
};

// Filtro do mapa por base — segmentado (Tabs), idioma já usado em
// QuestsPanel.jsx para filtros (por oposição a <Select>, que neste código é
// o idioma de atribuição). Esbate (não esconde) propriedades e missões que
// não pertencem à base selecionada. Vive no topo-esquerdo, sob a ResourceBar,
// para não colidir com o dock (que no mobile está encostado à esquerda) nem
// com a central da rede.
export const MapBaseFilter = ({ value, onChange }) => {
  const { state } = useGame();
  if (!state?.properties?.length) return null;
  return (
    <div className="pointer-events-auto absolute left-2 top-16 z-20 max-w-[calc(100vw-6rem)] overflow-x-auto md:max-w-[45vw]">
      <Tabs value={value} onValueChange={onChange}>
        <TabsList className="bg-[#0a0a0c]/95">
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
