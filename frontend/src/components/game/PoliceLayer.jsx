// ============================================================================
// PoliceLayer — renderização da força policial viva sobre o LiveMap
// ============================================================================
// Mesmo padrão de performance da MissionUnit: UM único loop rAF para toda a
// frota, atualizações imperativas (setLatLng / style.transform / classList)
// sem passar pelo React. O React só re-renderiza quando a composição muda
// (patrulha entra/sai, agentes desembarcam/embarcam) e a 1 Hz para tooltips.

import { Fragment, useEffect, useRef, useState } from "react";
import { Marker, Polyline, Tooltip as LTooltip } from "react-leaflet";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { UserRound } from "lucide-react";
import {
  ensurePoliceSim, policeTick, getPatrols, getPoliceVersion,
  officerStateAt, deployCommAt, patrolStateLabel, FORCES, DEFAULT_FORCE, VEHICLE_TYPE_LABELS,
} from "../../lib/police";

// ---------- Ícones (data-driven por força — sem hard-code PSP/GNR) ----------
// A cor da viatura/agente vem de FORCES[force] (bodyColor/tint) por CSS vars,
// e o tipo de viatura de uma classe `.police-vehicle-<tipo>`. Acrescentar uma
// força ou um tipo de viatura no futuro não exige tocar aqui.
const cfgFor = (force) => FORCES[force] || FORCES[DEFAULT_FORCE];

const carIconCache = {};
const policeCarIcon = (force, vtype = "carro") => {
  const key = `${force}|${vtype}`;
  if (!carIconCache[key]) {
    const F = cfgFor(force);
    const fkey = force || DEFAULT_FORCE;
    // Distintivo da força (P/G) sempre visível — identifica quem enfrentas sem
    // precisar de passar o rato por cima. Genérico: inicial da chave da força.
    const badge = fkey.charAt(0).toUpperCase();
    const html = `
      <div class="police-car police-force-${fkey.toLowerCase()}" data-proot
           style="--pbody:${F.bodyColor};--ptint:${F.tint};--pforce:${F.color}">
        <span class="police-car-body police-vehicle-${vtype}" data-car>
          <span class="police-lightbar"><i></i><i></i></span>
          <span class="unit-car-glass"></span>
          <span class="unit-car-door unit-car-door-l"></span>
          <span class="unit-car-door unit-car-door-r"></span>
        </span>
        <span class="police-force-badge">${badge}</span>
      </div>`;
    carIconCache[key] = L.divIcon({ html, className: "lus-marker", iconSize: [30, 30], iconAnchor: [15, 15] });
  }
  return carIconCache[key];
};

const officerIconCache = {};
const policeOfficerIcon = (force) => {
  const key = force || DEFAULT_FORCE;
  if (!officerIconCache[key]) {
    const F = cfgFor(force);
    const html = `
      <div class="op-pin police-op police-op-${key.toLowerCase()}" style="--ptint:${F.tint}">
        <span class="op-face-wrap" data-face><span class="op-face"></span></span>
        ${renderToStaticMarkup(<UserRound size={9} strokeWidth={3} />)}
      </div>`;
    officerIconCache[key] = L.divIcon({ html, className: "lus-marker lus-marker-op", iconSize: [14, 14], iconAnchor: [7, 7] });
  }
  return officerIconCache[key];
};

const TipRow = ({ label, value, color = "#E4E4E7" }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</span>
    <span className="font-mono text-[10px] font-bold" style={{ color }}>{value}</span>
  </div>
);

const STATE_COLORS = {
  patrol: "#60A5FA",
  responding: "#3B82F6",
  arriving: "#3B82F6",
  onscene_assess: "#93C5FD",
  onscene_intervene: "#EF4444",
  onscene_backup: "#3B82F6",
  pursuit: "#EF4444",
  returning: "#38BDF8",
  offduty: "#64748B",
};

export default function PoliceLayer({ state, serverNow }) {
  // Contexto mais recente para o loop rAF (sem re-subscrever o efeito).
  // `assets` = Quartel-General + imóveis do jogador — é à volta destes pontos
  // que as zonas de patrulhamento são construídas (PSP em centros urbanos,
  // GNR em zonas rurais/vilas), onde quer que o jogador se instale no país.
  const ctxRef = useRef({ missions: [], heat: 0, assets: [] });
  const hq = state?.player?.hq;
  ctxRef.current = {
    missions: state?.missions || [],
    heat: state?.player?.heat || 0,
    assets: [
      ...(hq && hq.lat != null && hq.lng != null
        ? [{ kind: "hq", name: hq.name || "Quartel-General", lat: hq.lat, lng: hq.lng }]
        : []),
      ...(state?.properties || [])
        .filter((p) => p && p.lat != null && p.lng != null)
        .map((p) => ({ kind: "property", name: p.name, lat: p.lat, lng: p.lng })),
    ],
  };

  const [, setVersion] = useState(0);
  const [, setClockTick] = useState(0);

  const carMarkersRef = useRef({});   // id -> Marker leaflet
  const carElsRef = useRef({});       // id -> { root, body, bearing, flags }
  const ofMarkersRef = useRef({});    // id -> array de Markers
  const ofElsRef = useRef({});        // id -> array { el, face, heading, flags }
  const commLinesRef = useRef({});    // id -> Polyline leaflet

  useEffect(() => {
    ensurePoliceSim(ctxRef.current);
    setVersion(getPoliceVersion());
  }, []);

  useEffect(() => {
    let raf;
    let last = 0;
    let lastTick = 0;

    const loop = (t) => {
      const nowMs = serverNow();
      const dt = last ? Math.min(0.25, (t - last) / 1000) : 0.016;
      last = t;

      const changed = policeTick(nowMs, dt, ctxRef.current);
      if (changed) setVersion(getPoliceVersion());

      const nowSec = nowMs / 1000;
      for (const p of getPatrols()) {
        const mk = carMarkersRef.current[p.id];
        if (!mk) continue;
        mk.setLatLng([p.pos.lat, p.pos.lng]);

        let els = carElsRef.current[p.id];
        if (!els || !els.root || !els.root.isConnected) {
          const root = mk.getElement?.()?.querySelector("[data-proot]") || null;
          els = { root, body: root ? root.querySelector("[data-car]") : null, bearing: null, flags: {} };
          carElsRef.current[p.id] = els;
        }
        if (els.root) {
          // Rumo com lerp angular (wrap 360°) — igual ao veículo das missões.
          if (els.body && p.bearing != null) {
            const cur = els.bearing == null ? p.bearing : els.bearing;
            const diff = ((p.bearing - cur + 540) % 360) - 180;
            const next = cur + diff * 0.18;
            els.bearing = next;
            els.body.style.transform = `rotate(${next.toFixed(1)}deg)`;
          }
          // Fade de entrada (nunca "aparecer do nada").
          els.root.style.opacity = p.spawnFade < 1 ? p.spawnFade.toFixed(2) : "";

          const f = els.flags;
          const lights = !!p.lights;
          if (f.lights !== lights) { f.lights = lights; els.root.classList.toggle("police-lights", lights); }
          const pursuit = p.state === "pursuit";
          if (f.pursuit !== pursuit) { f.pursuit = pursuit; els.root.classList.toggle("police-pursuit", pursuit); }
          const dep = p.deploy;
          const doorsOpen = !!dep &&
            ((nowSec >= dep.doorsOpenAt && nowSec < dep.doorsCloseExitAt) ||
             (nowSec >= dep.boardDoorsOpenAt && nowSec < dep.doorsFinalCloseAt));
          if (f.doors !== doorsOpen) { f.doors = doorsOpen; els.root.classList.toggle("unit-doors-open", doorsOpen); }
        }

        // ---- Agentes no terreno ----
        const dep = p.deploy;
        const ofMks = ofMarkersRef.current[p.id];
        const comm = dep ? deployCommAt(dep, nowSec) : null;
        if (dep && ofMks) {
          let ofEls = ofElsRef.current[p.id];
          if (!ofEls) { ofEls = []; ofElsRef.current[p.id] = ofEls; }
          for (let i = 0; i < dep.ops.length; i++) {
            const omk = ofMks[i];
            if (!omk) continue;
            let oe = ofEls[i];
            if (!oe || !oe.el || !oe.el.isConnected) {
              const el = omk.getElement?.()?.querySelector(".op-pin") || null;
              oe = { el, face: el ? el.querySelector("[data-face]") : null, heading: null, flags: {} };
              ofEls[i] = oe;
            }
            const st = officerStateAt(dep, i, nowSec);
            if (!st) {
              if (oe.el) oe.el.style.opacity = "0";
              continue;
            }
            omk.setLatLng([st.lat, st.lng]);
            if (oe.el) {
              oe.el.style.opacity = st.alpha.toFixed(2);
              oe.el.style.transform = `scale(${st.scale.toFixed(2)})`;
              if (oe.face && st.heading != null) {
                const cur = oe.heading == null ? st.heading : oe.heading;
                const diff = ((st.heading - cur + 540) % 360) - 180;
                const next = cur + diff * 0.22;
                oe.heading = next;
                oe.face.style.transform = `rotate(${next.toFixed(1)}deg)`;
              }
              const fl = oe.flags;
              if (fl.walking !== st.walking) { fl.walking = st.walking; oe.el.classList.toggle("op-walking", !!st.walking); }
              if (fl.running !== st.running) { fl.running = st.running; oe.el.classList.toggle("op-running", !!st.running); }
              const radio = !!comm && comm.officer === i;
              if (fl.radio !== radio) { fl.radio = radio; oe.el.classList.toggle("op-radio", radio); }
            }
          }
          // Linha de comunicação agente → viatura durante a transmissão.
          const line = commLinesRef.current[p.id];
          if (line) {
            const st = comm ? officerStateAt(dep, comm.officer, nowSec) : null;
            if (comm && st) line.setLatLngs([[st.lat, st.lng], [p.pos.lat, p.pos.lng]]);
            else line.setLatLngs([]);
          }
        }
      }

      if (t - lastTick > 1000) {
        lastTick = t;
        setClockTick((x) => x + 1);
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [serverNow]);

  const patrols = getPatrols();

  return (
    <>
      {patrols.map((p) => {
        const label = patrolStateLabel(p);
        const F = FORCES[p.force] || FORCES[DEFAULT_FORCE];
        const forceTint = F.tint;
        const vtypeLabel = VEHICLE_TYPE_LABELS[p.vehicleType] || VEHICLE_TYPE_LABELS.carro;
        const color = STATE_COLORS[p.state] || "#60A5FA";
        const deployed = !!p.deploy;
        return (
          <Fragment key={p.id}>
            <Marker
              ref={(mk) => {
                if (mk) carMarkersRef.current[p.id] = mk;
                else { delete carMarkersRef.current[p.id]; delete carElsRef.current[p.id]; }
              }}
              position={[p.pos.lat, p.pos.lng]}
              icon={policeCarIcon(p.force, p.vehicleType)}
              zIndexOffset={460}
            >
              <LTooltip direction="top" offset={[0, -14]} opacity={1} className="lus-map-tip">
                <div className="min-w-[150px]">
                  <p className="text-[11px] font-bold" style={{ color: forceTint }}>Patrulha {p.id}</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color }}>{label}</p>
                  <div className="mt-1 space-y-0.5">
                    <TipRow label="força" value={`${p.force} · ${F.terrainLabel}`} color={F.color} />
                    <TipRow label="viatura" value={vtypeLabel} color={forceTint} />
                    <TipRow label="zona" value={p.zone.name} color={forceTint} />
                    <TipRow label="agentes" value={`${p.officers} a bordo`} color="#E4E4E7" />
                    {p.alert && (
                      <TipRow label="ocorrência" value={p.alert.missionName} color="#F59E0B" />
                    )}
                    {p.state === "pursuit" && p.pursuit?.missionName && (
                      <TipRow label="a perseguir" value={p.pursuit.missionName} color="#EF4444" />
                    )}
                  </div>
                  {p.state === "pursuit" && (
                    <p className="mt-1 text-[9px] text-red-400/80">Se apanhar a equipa antes do QG, a carga perde-se.</p>
                  )}
                  {p.state === "patrol" && (
                    <p className="mt-1 text-[9px] text-zinc-500">{F.label}.</p>
                  )}
                </div>
              </LTooltip>
            </Marker>
            {deployed && p.deploy.ops.map((_, i) => (
              <Marker
                key={`${p.id}-of-${i}`}
                ref={(mk) => {
                  const arr = ofMarkersRef.current[p.id] || (ofMarkersRef.current[p.id] = []);
                  if (mk) arr[i] = mk;
                  else { arr[i] = null; if (ofElsRef.current[p.id]) ofElsRef.current[p.id][i] = null; }
                }}
                position={[p.parkPos?.lat ?? p.pos.lat, p.parkPos?.lng ?? p.pos.lng]}
                icon={policeOfficerIcon(p.force)}
                interactive={false}
                keyboard={false}
                zIndexOffset={515}
              />
            ))}
            {deployed && (
              <Polyline
                ref={(pl) => {
                  if (pl) commLinesRef.current[p.id] = pl;
                  else delete commLinesRef.current[p.id];
                }}
                positions={[]}
                smoothFactor={1}
                pathOptions={{ color: "#3B82F6", weight: 1.1, opacity: 0.65, dashArray: "3 4", lineCap: "round" }}
                interactive={false}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}
