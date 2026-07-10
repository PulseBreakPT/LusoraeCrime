// ============================================================================
// PoliceLayer — renderização da força policial viva sobre o LiveMap
// ============================================================================
// Mesmo padrão de performance da MissionUnit: UM único loop rAF para toda a
// frota, atualizações imperativas (setLatLng / style.transform / classList)
// sem passar pelo React. O React só re-renderiza quando a composição muda
// (patrulha entra/sai, agentes desembarcam/embarcam) e a 1 Hz para tooltips.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Marker, Polyline, Tooltip as LTooltip } from "react-leaflet";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { UserRound } from "lucide-react";
import {
  ensurePoliceSim, policeTick, getPatrols, getPoliceVersion,
  officerStateAt, deployCommAt, patrolStateLabel,
} from "../../lib/police";

// ---------- Ícones (cacheados — 1 instância por tipo) ----------
let carIconCache = null;
const policeCarIcon = () => {
  if (!carIconCache) {
    const html = `
      <div class="police-car" data-proot>
        <span class="police-pulse"></span>
        <span class="police-car-body" data-car>
          <span class="police-lightbar"><i></i><i></i></span>
          <span class="unit-car-glass"></span>
          <span class="unit-car-door unit-car-door-l"></span>
          <span class="unit-car-door unit-car-door-r"></span>
        </span>
      </div>`;
    carIconCache = L.divIcon({ html, className: "lus-marker", iconSize: [30, 30], iconAnchor: [15, 15] });
  }
  return carIconCache;
};

let officerIconCache = null;
const policeOfficerIcon = () => {
  if (!officerIconCache) {
    const html = `
      <div class="op-pin police-op">
        <span class="op-face-wrap" data-face><span class="op-face"></span></span>
        ${renderToStaticMarkup(<UserRound size={9} strokeWidth={3} />)}
      </div>`;
    officerIconCache = L.divIcon({ html, className: "lus-marker lus-marker-op", iconSize: [14, 14], iconAnchor: [7, 7] });
  }
  return officerIconCache;
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
  const ctxRef = useRef({ missions: [], heat: 0 });
  ctxRef.current = {
    missions: state?.missions || [],
    heat: state?.player?.heat || 0,
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
  const carIcon = useMemo(() => policeCarIcon(), []);
  const officerIcon = useMemo(() => policeOfficerIcon(), []);

  return (
    <>
      {patrols.map((p) => {
        const label = patrolStateLabel(p);
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
              icon={carIcon}
              zIndexOffset={460}
            >
              <LTooltip direction="top" offset={[0, -14]} opacity={1} className="lus-map-tip">
                <div className="min-w-[150px]">
                  <p className="text-[11px] font-bold text-blue-300">Patrulha {p.id}</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color }}>{label}</p>
                  <div className="mt-1 space-y-0.5">
                    <TipRow label="zona" value={p.zone.name} color="#93C5FD" />
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
                    <p className="mt-1 text-[9px] text-zinc-500">Evita operar debaixo do olhar de uma patrulha…</p>
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
                icon={officerIcon}
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
