// ============================================================================
// segments.js — blocos de guião temporais partilhados (equipa + NPCs)
// ============================================================================
//
// Toda a simulação interior é uma lista de segmentos por agente com
// timestamps absolutos (segundos Unix). A avaliação por frame é O(1) por
// agente (memoização do índice + interpolação por distância nos moves).
//
// Tipos de segmento:
//   hidden — invisível (antes de aparecer / depois de sair)
//   hold   — parado num ponto, com deriva idle + olhar (face fixa ou POIs)
//   move   — caminho A* percorrido por interpolação temporal
//   action — interação num ponto (objetivo, saque, …)
//   gone   — terminou (nunca mais é avaliado)

import { findPath, nearestWalkable, pathMetrics, pointAlong } from "./pathfind";

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const WALK = 2.3; // células/s
export const RUN = 4.4;

export const holdSeg = (t0, t1, x, y, face, label, extra = {}) =>
  ({ t0, t1, kind: "hold", x, y, face, label, ...extra });
export const actionSeg = (t0, t1, x, y, face, label, extra = {}) =>
  ({ t0, t1, kind: "action", x, y, face, label, ...extra });

export function moveSeg(b, t0, budget, from, to, speed, label, extra = {}) {
  let pts = findPath(b.grid, b.gw, b.gh, from.x, from.y, to.x, to.y);
  if (!pts || pts.length < 1) pts = [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
  const metrics = pathMetrics(pts);
  const natural = metrics.length / speed;
  const dur = Math.max(0.4, Math.min(natural, Math.max(0.4, budget)));
  const end = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
  return { seg: { t0, t1: t0 + dur, kind: "move", pts, metrics, label, ...extra }, end, dur };
}

// Caminho manual (células conhecidas — ex.: atravessar a porta em linha).
export function rawMoveSeg(t0, dur, pts, label, extra = {}) {
  const metrics = pathMetrics(pts);
  return { t0, t1: t0 + dur, kind: "move", pts, metrics, label, ...extra };
}

// Célula livre perto de (x,y), com desempate determinístico por agente.
export function spotNear(b, x, y, i, rng) {
  const cand = nearestWalkable(b.grid, b.gw, b.gh, x + ((i % 3) - 1), y + (((i / 3) | 0) % 3) - 1, 5);
  return cand || nearestWalkable(b.grid, b.gw, b.gh, x, y, 6) || { x, y };
}

// ---------------------------------------------------------------------------
// Alertas — janelas de reação derivadas das complicações reais do live_log
// ---------------------------------------------------------------------------
export const alertDur = (al) => (al.good ? 2.6 : 4.6);

export function activeAlert(alerts, tSec) {
  if (!alerts || !alerts.length) return null;
  for (const al of alerts) {
    if (tSec >= al.t0 && tSec <= al.t0 + alertDur(al)) return al;
  }
  return null;
}

// Divide segmentos hold nos instantes de alerta: o agente vira-se para o
// ponto de foco (entrada) e fica "em alerta" pela duração da janela.
export function injectAlerts(segs, alerts, focus, opts = {}) {
  if (!alerts || !alerts.length) return segs;
  const badLabel = opts.badLabel || "Em alerta!";
  const goodLabel = opts.goodLabel || "Situação controlada";
  const out = [];
  for (const s of segs) {
    if (s.kind !== "hold") { out.push(s); continue; }
    let cur = s;
    for (const al of alerts) {
      const dur = alertDur(al);
      if (al.t0 > cur.t0 + 0.4 && al.t0 + dur < cur.t1 - 0.3) {
        out.push({ ...cur, t1: al.t0 });
        const face = al.good ? cur.face : Math.atan2(focus.y - cur.y, focus.x - cur.x);
        out.push({
          ...cur, t0: al.t0, t1: al.t0 + dur, face,
          label: al.good ? goodLabel : badLabel,
          alert: !al.good, look: null,
        });
        cur = { ...cur, t0: al.t0 + dur };
      }
    }
    out.push(cur);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Avaliação por frame — O(1) por agente (equipa e NPCs usam o mesmo motor)
// ---------------------------------------------------------------------------
export function evalAgent(a, tSec, i, alerts) {
  if (!a) return null;
  const segs = a.segs;
  let k = a._lastIdx || 0;
  if (k >= segs.length || tSec < segs[k].t0) k = 0;
  while (k < segs.length - 1 && tSec >= segs[k].t1) k++;
  a._lastIdx = k;
  const s = segs[k];
  if (!s || s.kind === "hidden" || s.kind === "gone") return null;
  const alertNow = activeAlert(alerts, tSec);
  const alertBad = !!(alertNow && !alertNow.good);

  if (s.kind === "move") {
    const f = clamp((tSec - s.t0) / Math.max(0.001, s.t1 - s.t0), 0, 1);
    const p = pointAlong(s.pts, s.metrics, f);
    const bob = Math.sin(tSec * (s.run ? 13 : 9) + i * 2.3) * 0.055;
    return {
      x: p.x + Math.cos(p.heading + Math.PI / 2) * bob,
      y: p.y + Math.sin(p.heading + Math.PI / 2) * bob,
      heading: p.heading, action: null, label: s.label,
      carry: s.carry || null, run: !!s.run, moving: true, alpha: 1,
      hands: !!s.hands, kneel: false, panic: !!s.panic,
      alert: alertBad && !s.panic, tool: null,
    };
  }

  // hold / action — deriva idle + olhar (POIs ou varrimento em torno da face)
  const kneel = !!s.kneel;
  const sway = s.kind === "action" ? 0.03 : kneel ? 0.015 : 0.07;
  const x = s.x + Math.sin(tSec * 0.9 + i * 2.1) * sway;
  const y = s.y + Math.cos(tSec * 0.7 + i * 1.4) * sway;
  let heading;
  if (Array.isArray(s.look) && s.look.length) {
    // olhar dirigido: alterna entre pontos de interesse a cada ~2.6 s
    const idx = Math.abs(Math.floor(tSec / 2.6 + i * 0.7)) % s.look.length;
    heading = s.look[idx] + Math.sin(tSec * 0.8 + i) * 0.12;
  } else {
    const scan = s.kind === "action" ? 0.12 : kneel ? 0.1 : 0.45;
    heading = (s.face ?? 0) + Math.sin(tSec * 0.5 + i * 1.7) * scan;
  }
  let alpha = 1;
  if (s.fade) alpha = clamp(1 - (tSec - s.t0) / Math.max(0.001, s.t1 - s.t0), 0, 1);
  return {
    x, y, heading, action: s.kind === "action" ? s.label : null, label: s.label,
    carry: s.carry || null, run: false, moving: false, alpha,
    objective: !!s.objective, hands: !!s.hands, kneel,
    tool: s.tool || null, alert: !!s.alert || alertBad, panic: false,
  };
}
