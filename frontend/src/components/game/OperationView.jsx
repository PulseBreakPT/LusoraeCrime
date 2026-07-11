// ============================================================================
// OperationView — Câmara da operação (vista tática do interior em tempo real)
// ============================================================================
//
// Overlay fullscreen com render em canvas (blueprint noir). Tudo é derivado
// do motor determinístico (buildingGen + interiorSim): gerado apenas quando a
// câmara abre, destruído ao fechar — zero custo quando não está visível.
//
// Câmara: segue a equipa automaticamente; arrastar para mover; roda/pinch
// para zoom; botões enquadrar/seguir; alternância rápida com o mapa (fechar).
// O mapa exterior continua sincronizado por baixo (mesmos timestamps).

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, Crosshair, Maximize2, Plus, Minus, Radio, MapPinned } from "lucide-react";
import { generateBuilding, MARGIN } from "../../lib/interior/buildingGen";
import {
  buildInteriorSim, agentStateAt, phaseAt, objectiveProgress, commsUpto, ROLE_META,
} from "../../lib/interior/interiorSim";

const BASE = 26; // px por célula a zoom 1

// ---------- Paleta blueprint noir ----------
const C = {
  bg: "#05070a",
  street: "#090c11",
  floor: "#0d131b",
  floorAlt: "#0e141d",
  grid: "rgba(148,163,184,0.05)",
  wall: "#28323f",
  wallEdge: "#3a4a5e",
  door: "#22d3ee",
  entry: "#f43f5e",
  label: "rgba(148,163,184,0.55)",
  objective: "#f43f5e",
  progress: "#22d3ee",
  loot: "rgba(251,191,36,0.5)",
};
const ROOM_TINT = {
  cofre: "rgba(244,63,94,0.045)", cofres: "rgba(244,63,94,0.045)", caixa: "rgba(244,63,94,0.045)",
  tecnica: "rgba(34,211,238,0.04)", servidores: "rgba(34,211,238,0.04)", seguranca: "rgba(34,211,238,0.035)",
  corredor: "rgba(148,163,184,0.03)",
};
const FURN_STYLE = {
  counter:  { fill: "#182230", stroke: "#33415a" },
  display:  { fill: "#141d2a", stroke: "#67e8f9", glow: true },
  shelf:    { fill: "#161f2b", stroke: "#2e3c50" },
  safe:     { fill: "#1d1418", stroke: "#f43f5e" },
  safebox:  { fill: "#181320", stroke: "#a78bfa" },
  desk:     { fill: "#182230", stroke: "#33415a" },
  cabinet:  { fill: "#161f2b", stroke: "#2e3c50" },
  table:    { fill: "#182230", stroke: "#33415a", round: true },
  sofa:     { fill: "#1a2330", stroke: "#3b4a61", round: true },
  bed:      { fill: "#1a2330", stroke: "#3b4a61" },
  kitchen:  { fill: "#182230", stroke: "#33415a" },
  crate:    { fill: "#1f1a12", stroke: "#8a6d3b" },
  pallet:   { fill: "#1c180f", stroke: "#6b5426" },
  server:   { fill: "#101a22", stroke: "#22d3ee", glow: true },
  plant:    { fill: "#122016", stroke: "#34d399", round: true },
  car:      { fill: "#141c26", stroke: "#4b5b73", round: true },
  slot:     { fill: "#1c1426", stroke: "#c084fc" },
  pedestal: { fill: "#1d1d16", stroke: "#fbbf24", glow: true },
};

const fmtMMSS = (s) => {
  const v = Math.max(0, Math.ceil(s));
  return `${String((v / 60) | 0).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

// Path2D em cache (coordenadas de célula) — construídos uma vez por edifício.
function buildPaths(b) {
  const { grid, gw, gh } = b;
  const wall = new Path2D();
  // fusão de sequências horizontais de parede (menos retângulos)
  for (let y = 0; y < gh; y++) {
    let run = -1;
    for (let x = 0; x <= gw; x++) {
      const isW = x < gw && grid[y * gw + x] === 2;
      if (isW && run < 0) run = x;
      if (!isW && run >= 0) { wall.rect(run, y, x - run, 1); run = -1; }
    }
  }
  const floor = new Path2D();
  floor.rect(b.bx0, b.by0, b.w, b.h);
  const gridLines = new Path2D();
  for (let x = b.bx0; x <= b.bx1 + 1; x++) { gridLines.moveTo(x, b.by0); gridLines.lineTo(x, b.by1 + 1); }
  for (let y = b.by0; y <= b.by1 + 1; y++) { gridLines.moveTo(b.bx0, y); gridLines.lineTo(b.bx1 + 1, y); }
  const doors = b.doors.map((d) => ({ ...d, horizontal: grid[d.y * gw + d.x - 1] === 2 || grid[d.y * gw + d.x + 1] === 2 }));
  const furnByKind = new Map();
  for (const f of b.furniture) {
    let e = furnByKind.get(f.kind);
    if (!e) { e = { fill: new Path2D(), items: [] }; furnByKind.set(f.kind, e); }
    e.fill.rect(f.x + 0.08, f.y + 0.08, f.w - 0.16, f.h - 0.16);
    e.items.push(f);
  }
  return { wall, floor, gridLines, doors, furnByKind };
}

export function OperationView({ mission, roster, serverNow, onClose }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const camRef = useRef({ x: 0, y: 0, zoom: 1, follow: true });
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const [followUi, setFollowUi] = useState(true);
  const [, setTick] = useState(0); // HUD 2 Hz

  const rosterKey = (roster || []).map((r) => `${r.name}:${r.role_key}:${r.rank}`).join(",");

  // ----- Construção lazy (só quando a câmara está aberta) -----
  const built = useMemo(() => {
    try {
      const b = generateBuilding(mission);
      const sim = buildInteriorSim(mission, b, roster || []);
      return { b, sim, paths: buildPaths(b) };
    } catch (e) {
      console.error("OperationView: falha na geração do interior", e);
      return { error: true };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission.id, mission.arrive_at, mission.finish_at, rosterKey]);

  const { b, sim, paths } = built;

  // câmara inicial: enquadrar o edifício
  useEffect(() => {
    if (!b) return;
    const cam = camRef.current;
    cam.x = b.bx0 + b.w / 2;
    cam.y = b.by0 + b.h / 2;
    const el = wrapRef.current;
    if (el) {
      const fit = Math.min(el.clientWidth / ((b.w + 6) * BASE), el.clientHeight / ((b.h + 6) * BASE));
      cam.zoom = Math.max(0.45, Math.min(1.6, fit));
    }
    cam.follow = true;
    setFollowUi(true);
  }, [b]);

  // ESC fecha
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // ----- Interações da câmara -----
  const setFollow = useCallback((v) => {
    camRef.current.follow = v;
    setFollowUi(v);
  }, []);

  const fitBuilding = useCallback(() => {
    if (!b) return;
    const el = wrapRef.current;
    const cam = camRef.current;
    cam.x = b.bx0 + b.w / 2;
    cam.y = b.by0 + b.h / 2;
    if (el) cam.zoom = Math.max(0.35, Math.min(2, Math.min(el.clientWidth / ((b.w + 4) * BASE), el.clientHeight / ((b.h + 4) * BASE))));
    setFollow(false);
  }, [b, setFollow]);

  const zoomBy = useCallback((f, cx, cy) => {
    const el = wrapRef.current;
    if (!el) return;
    const cam = camRef.current;
    const rect = el.getBoundingClientRect();
    const px = cam.zoom * BASE;
    const wx = cam.x + ((cx ?? rect.width / 2) - rect.width / 2) / px;
    const wy = cam.y + ((cy ?? rect.height / 2) - rect.height / 2) / px;
    cam.zoom = Math.max(0.3, Math.min(3.5, cam.zoom * f));
    const px2 = cam.zoom * BASE;
    cam.x = wx - ((cx ?? rect.width / 2) - rect.width / 2) / px2;
    cam.y = wy - ((cy ?? rect.height / 2) - rect.height / 2) / px2;
  }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = wrapRef.current.getBoundingClientRect();
    zoomBy(Math.exp(-e.deltaY * 0.0012), e.clientX - rect.left, e.clientY - rect.top);
  }, [zoomBy]);

  const onPointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      pinchRef.current = { d: Math.hypot(p2.x - p1.x, p2.y - p1.y), zoom: camRef.current.zoom };
    }
  }, []);
  const onPointerMove = useCallback((e) => {
    const p = pointersRef.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const cam = camRef.current;
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [p1, p2] = [...pointersRef.current.values()];
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (pinchRef.current.d > 8) {
        cam.zoom = Math.max(0.3, Math.min(3.5, pinchRef.current.zoom * (d / pinchRef.current.d)));
      }
    } else if (pointersRef.current.size === 1 && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
      const px = cam.zoom * BASE;
      cam.x -= dx / px;
      cam.y -= dy / px;
      if (cam.follow) setFollow(false);
    }
  }, [setFollow]);
  const onPointerUp = useCallback((e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
  }, []);

  // ----- Loop de render -----
  useEffect(() => {
    if (!b || !sim || !paths) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    let raf;
    let lastHud = 0;
    const speakerToIdx = new Map(sim.agents.map((a, i) => [a.name, i]));

    const loop = (frameTs) => {
      raf = requestAnimationFrame(loop);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = wrap.clientWidth, ch = wrap.clientHeight;
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr; canvas.height = ch * dpr;
        canvas.style.width = cw + "px"; canvas.style.height = ch + "px";
      }
      const nowMs = serverNow();
      const t = nowMs / 1000;
      const phase = mission.phase;
      const operating = phase === "operating";

      // estados dos agentes (uma avaliação por frame)
      const states = sim.agents.map((_, i) => (operating ? agentStateAt(sim, i, t) : null));

      // follow: centróide dos agentes visíveis
      const cam = camRef.current;
      if (cam.follow) {
        let sx = 0, sy = 0, c = 0;
        for (const st of states) if (st) { sx += st.x; sy += st.y; c++; }
        const tx = c ? sx / c + 0.5 : b.entry.x + 0.5;
        const ty = c ? sy / c + 0.5 : b.entry.y + 0.5;
        cam.x += (tx - cam.x) * 0.06;
        cam.y += (ty - cam.y) * 0.06;
        const wantZoom = c ? Math.max(0.85, Math.min(1.5, 26 / Math.max(b.w, b.h) * 1.6)) : cam.zoom;
        cam.zoom += (wantZoom - cam.zoom) * 0.03;
      }

      const px = cam.zoom * BASE;
      const ox = cw / 2 - cam.x * px;
      const oy = ch / 2 - cam.y * px;
      const toSX = (wx) => wx * px + ox;
      const toSY = (wy) => wy * px + oy;

      // fundo
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, cw, ch);

      // mundo (coordenadas de célula)
      ctx.setTransform(dpr * px, 0, 0, dpr * px, dpr * ox, dpr * oy);
      // rua em volta
      ctx.fillStyle = C.street;
      ctx.fillRect(0, 0, b.gw, b.gh);
      // chão
      ctx.fillStyle = C.floor;
      ctx.fill(paths.floor);
      // tinta por divisão
      for (const r of b.rooms) {
        const tint = ROOM_TINT[r.key];
        if (!tint) continue;
        ctx.fillStyle = tint;
        ctx.fillRect(r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1);
      }
      // grelha
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1 / px;
      ctx.stroke(paths.gridLines);
      // paredes
      ctx.fillStyle = C.wall;
      ctx.fill(paths.wall);
      ctx.strokeStyle = C.wallEdge;
      ctx.lineWidth = 1.2 / px;
      ctx.stroke(paths.wall);
      // mobiliário
      for (const [kind, e] of paths.furnByKind) {
        const st = FURN_STYLE[kind] || { fill: "#161f2b", stroke: "#2e3c50" };
        ctx.fillStyle = st.fill;
        ctx.fill(e.fill);
        ctx.strokeStyle = st.stroke;
        ctx.lineWidth = (st.glow ? 1.6 : 1.1) / px;
        ctx.globalAlpha = st.glow ? 0.9 : 0.7;
        ctx.stroke(e.fill);
        ctx.globalAlpha = 1;
      }
      // portas
      for (const d of paths.doors) {
        ctx.fillStyle = C.floor;
        ctx.fillRect(d.x, d.y, 1, 1);
        const isEntry = d.roomB === -1 || d.roomA === -1;
        ctx.strokeStyle = isEntry ? C.entry : C.door;
        ctx.globalAlpha = isEntry ? 0.95 : 0.55;
        ctx.lineWidth = 2 / px;
        ctx.beginPath();
        if (d.horizontal) { ctx.moveTo(d.x + 0.15, d.y + 0.5); ctx.lineTo(d.x + 0.85, d.y + 0.5); }
        else { ctx.moveTo(d.x + 0.5, d.y + 0.15); ctx.lineTo(d.x + 0.5, d.y + 0.85); }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // pontos de saque
      if (operating) {
        for (const s of b.lootSpots) {
          ctx.strokeStyle = C.loot;
          ctx.lineWidth = 1.2 / px;
          ctx.strokeRect(s.x + 0.28, s.y + 0.28, 0.44, 0.44);
        }
      }

      // objetivo — anel pulsante + arco de progresso
      const obj = b.objective;
      const prog = operating ? objectiveProgress(sim, t) : 0;
      const done = prog >= 1;
      const pulse = 0.5 + 0.5 * Math.sin(frameTs / 320);
      ctx.save();
      ctx.translate(obj.anchor.x, obj.anchor.y);
      ctx.strokeStyle = done ? "#34d399" : C.objective;
      ctx.globalAlpha = done ? 0.9 : 0.45 + 0.4 * pulse;
      ctx.lineWidth = 2 / px;
      ctx.beginPath();
      ctx.arc(0, 0, 1.15 + (done ? 0 : pulse * 0.18), 0, Math.PI * 2);
      ctx.stroke();
      if (operating && prog > 0 && !done) {
        ctx.strokeStyle = C.progress;
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 3 / px;
        ctx.beginPath();
        ctx.arc(0, 0, 1.15, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // ----- espaço de ecrã (textos e agentes nítidos) -----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // etiquetas das divisões
      if (px > 13) {
        ctx.font = `600 ${Math.min(11, Math.max(9, px * 0.38))}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = C.label;
        for (const r of b.rooms) {
          if ((r.x1 - r.x0 + 1) * px < 56) continue;
          ctx.fillText(r.name.toUpperCase(), toSX(r.cx + 0.5), toSY(r.y0 + 1.1), (r.x1 - r.x0 + 1) * px);
        }
      }
      // etiqueta do objetivo
      const oX = toSX(obj.anchor.x), oY = toSY(obj.anchor.y);
      ctx.font = "700 10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = done ? "#34d399" : "#fda4af";
      ctx.fillText(done ? "OBJETIVO GARANTIDO" : obj.label.toUpperCase(), oX, oY - 1.4 * px - 6);
      if (operating && prog > 0 && !done) {
        ctx.fillStyle = "#67e8f9";
        ctx.fillText(`${Math.round(prog * 100)}%`, oX, oY + 1.4 * px + 12);
      }

      // agentes
      const rAg = Math.max(4, Math.min(11, 5.5 * cam.zoom));
      const comms = operating ? commsUpto(sim, t, 3) : [];
      const lastComm = comms.length ? comms[comms.length - 1] : null;
      for (let i = 0; i < states.length; i++) {
        const st = states[i];
        if (!st) continue;
        const a = sim.agents[i];
        const sx = toSX(st.x + 0.5), sy = toSY(st.y + 0.5);
        if (sx < -40 || sy < -40 || sx > cw + 40 || sy > ch + 40) continue;
        ctx.globalAlpha = st.alpha;
        // cone de visão
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, rAg * 3.4, st.heading - 0.5, st.heading + 0.5);
        ctx.closePath();
        ctx.fill();
        // corpo
        ctx.beginPath();
        ctx.arc(sx, sy, rAg, 0, Math.PI * 2);
        ctx.fillStyle = "#0b0f14";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = a.color;
        ctx.stroke();
        // ponto de direção
        ctx.beginPath();
        ctx.arc(sx + Math.cos(st.heading) * rAg * 0.55, sy + Math.sin(st.heading) * rAg * 0.55, rAg * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = a.color;
        ctx.fill();
        // ação (anel a pulsar)
        if (st.action) {
          ctx.strokeStyle = st.objective ? C.progress : "rgba(251,191,36,0.8)";
          ctx.globalAlpha = st.alpha * (0.4 + 0.5 * pulse);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, rAg + 4 + pulse * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = st.alpha;
        }
        // carga
        if (st.carry) {
          ctx.font = "700 9px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = st.carry === "money" ? "#fbbf24" : st.carry === "doc" ? "#93c5fd" : "#d6a35c";
          ctx.fillText(st.carry === "money" ? "€" : st.carry === "doc" ? "DOC" : "■", sx, sy - rAg - 5);
        }
        // nome
        if (cam.zoom > 0.75) {
          ctx.font = "600 9px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(228,231,236,0.85)";
          ctx.fillText(a.name.split(" ")[0], sx, sy + rAg + 11);
        }
        // balão de rádio
        if (lastComm && lastComm.speaker === a.name && t - lastComm.at < 3.2 && speakerToIdx.has(a.name)) {
          ctx.font = "600 9.5px ui-monospace, monospace";
          const txt = lastComm.text.length > 42 ? lastComm.text.slice(0, 40) + "…" : lastComm.text;
          const tw = ctx.measureText(txt).width + 12;
          const bx = sx - tw / 2, by = sy - rAg - 30;
          ctx.fillStyle = "rgba(6,10,14,0.92)";
          ctx.strokeStyle = "rgba(34,211,238,0.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bx, by, tw, 17, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#a5f3fc";
          ctx.textAlign = "center";
          ctx.fillText(txt, sx, by + 12);
        }
        ctx.globalAlpha = 1;
      }

      // varrimento tipo sonar quando ainda em rota
      if (!operating && phase === "en_route") {
        const cx = toSX(b.bx0 + b.w / 2 + 0.5), cy = toSY(b.by0 + b.h / 2 + 0.5);
        const rr = ((frameTs / 18) % (Math.max(b.w, b.h) * px * 0.7));
        ctx.strokeStyle = "rgba(34,211,238,0.25)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // HUD React a 2 Hz
      if (frameTs - lastHud > 500) { lastHud = frameTs; setTick((v) => v + 1); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [b, sim, paths, mission.phase, serverNow]);

  // ----- HUD (2 Hz) -----
  const now = serverNow() / 1000;
  const operating = mission.phase === "operating";
  const enRoute = mission.phase === "en_route";
  const ended = !operating && !enRoute;
  const ph = sim && operating ? phaseAt(sim, now) : null;
  const chance = Math.round(((mission.success_chance || 0) + (mission.live_chance_delta || 0)) * 100);
  const etaS = enRoute ? (Date.parse(mission.arrive_at) - serverNow()) / 1000 : (Date.parse(mission.finish_at) - serverNow()) / 1000;
  const feed = useMemo(() => {
    if (!sim) return [];
    const own = operating ? commsUpto(sim, now, 3) : [];
    const log = (mission.live_log || [])
      .filter((e) => e.kind === "radio" && Date.parse(e.at) / 1000 <= now)
      .slice(-2)
      .map((e) => ({ at: Date.parse(e.at) / 1000, speaker: e.speaker, text: e.text }));
    return [...log, ...own].sort((a, c) => a.at - c.at).slice(-3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim, operating, Math.floor(now * 2)]);

  const agentChips = sim && operating
    ? sim.agents.map((a, i) => ({ a, st: agentStateAt(sim, i, now), i })).filter((x) => x.st)
    : [];

  const outcomeInfo = mission.outcome === "success"
    ? { txt: "OBJETIVO CUMPRIDO", cls: "text-emerald-300 border-emerald-400/40" }
    : mission.outcome
      ? { txt: "OPERAÇÃO COMPROMETIDA", cls: "text-red-300 border-red-400/40" }
      : { txt: "OPERAÇÃO TERMINADA", cls: "text-zinc-300 border-white/20" };

  if (built.error) {
    return (
      <div data-testid="operation-view" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90">
        <div className="lus-panel rounded-xl p-6 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-red-300">Sem cobertura no interior do alvo</p>
          <button data-testid="operation-close" onClick={onClose} className="mt-4 rounded-md border border-white/15 px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-300 hover:text-white">
            Voltar ao mapa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="operation-view" className="fixed inset-0 z-[80] bg-[#05070a]">
      {/* canvas */}
      <div
        ref={wrapRef}
        className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* efeitos noir (não interativos) */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.5) 2px 3px)" }} />

      {/* header */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className="lus-panel flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2">
          <span className="lus-lo-rec" />
          <div className="min-w-0">
            <p className="truncate font-mono text-[10px] font-bold uppercase tracking-widest text-white">
              Câmara da operação
              <span className="ml-2 font-normal normal-case text-zinc-400">{b?.archLabel}</span>
            </p>
            <p className="truncate font-mono text-[9px] uppercase tracking-wider text-zinc-500">
              {mission.team_name} · {mission.opportunity?.name} · {mission.opportunity?.district}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="lus-panel hidden items-center gap-3 rounded-lg px-3 py-2 sm:flex">
            <div data-testid="operation-phase" className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              {enRoute ? "Aproximação ao alvo" : ph ? ph.label : outcomeInfo.txt}
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="font-mono text-[10px] text-zinc-300">
              <span className="text-zinc-500">CHANCE </span>{chance}%
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="font-mono text-[10px] tabular-nums text-zinc-300">
              <span className="text-zinc-500">{enRoute ? "ETA " : "T-"}</span>{fmtMMSS(etaS)}
            </div>
          </div>
          <button
            type="button"
            data-testid="operation-close"
            title="Voltar ao mapa"
            onClick={onClose}
            className="lus-panel flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300 transition-colors hover:text-white"
          >
            <MapPinned size={12} className="text-cyan-300" /> Mapa
            <X size={12} />
          </button>
        </div>
      </div>

      {/* controlos da câmara */}
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-1.5 sm:right-3">
        <button
          type="button"
          data-testid="operation-follow"
          title={followUi ? "A seguir a equipa (desligar)" : "Seguir a equipa"}
          onClick={() => setFollow(!followUi)}
          className={`lus-panel rounded-lg p-2 transition-colors ${followUi ? "text-cyan-300" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          <Crosshair size={14} />
        </button>
        <button type="button" data-testid="operation-fit" title="Enquadrar o edifício" onClick={fitBuilding} className="lus-panel rounded-lg p-2 text-zinc-400 transition-colors hover:text-white">
          <Maximize2 size={14} />
        </button>
        <button type="button" data-testid="operation-zoom-in" title="Aproximar" onClick={() => { setFollow(false); zoomBy(1.25); }} className="lus-panel rounded-lg p-2 text-zinc-400 transition-colors hover:text-white">
          <Plus size={14} />
        </button>
        <button type="button" data-testid="operation-zoom-out" title="Afastar" onClick={() => { setFollow(false); zoomBy(0.8); }} className="lus-panel rounded-lg p-2 text-zinc-400 transition-colors hover:text-white">
          <Minus size={14} />
        </button>
      </div>

      {/* rádio */}
      {feed.length > 0 && operating && (
        <div className="absolute bottom-2 left-2 max-w-[70vw] sm:bottom-3 sm:left-3 sm:max-w-sm">
          <div className="lus-panel rounded-lg px-3 py-2">
            <p className="mb-1 flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-widest text-zinc-500">
              <Radio size={9} className="text-cyan-400" /> Rádio da equipa
            </p>
            {feed.map((c, i) => (
              <p key={`${c.at}-${i}`} className={`truncate font-mono text-[10px] leading-relaxed ${i === feed.length - 1 ? "text-cyan-200" : "text-zinc-500"}`}>
                <span className="text-zinc-600">{c.speaker ? `${String(c.speaker).split(" ")[0]}: ` : ""}</span>
                {c.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* operacionais */}
      {agentChips.length > 0 && (
        <div data-testid="operation-agents" className="absolute bottom-2 right-2 flex max-w-[92vw] gap-1.5 overflow-x-auto sm:bottom-3 sm:right-3 sm:max-w-lg" style={{ scrollbarWidth: "none" }}>
          {agentChips.map(({ a, st, i }) => (
            <div key={i} className="lus-panel flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-200">{a.name.split(" ")[0]}</p>
                <p className="max-w-[9rem] truncate font-mono text-[8px] text-zinc-500">{a.roleLabel} · {st.action || st.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* overlays por fase */}
      {enRoute && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="lus-panel rounded-xl px-6 py-4 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">Reconhecimento do alvo</p>
            <p className="mt-1 font-mono text-[11px] text-zinc-400">Equipa a caminho — entrada em <span className="tabular-nums text-white">{fmtMMSS(etaS)}</span></p>
          </div>
        </div>
      )}
      {ended && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className={`lus-panel rounded-xl border px-8 py-5 text-center ${outcomeInfo.cls}`}>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.3em]">{outcomeInfo.txt}</p>
            <p className="mt-1.5 font-mono text-[10px] text-zinc-400">A equipa está em retirada — segue o regresso no mapa.</p>
            <button
              type="button"
              data-testid="operation-return-map"
              onClick={onClose}
              className="mt-3 rounded-md border border-white/15 px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-200 transition-colors hover:border-cyan-400/40 hover:text-white"
            >
              Voltar ao mapa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OperationView;
