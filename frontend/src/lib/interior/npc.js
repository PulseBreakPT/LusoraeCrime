// ============================================================================
// npc.js — ocupantes do edifício (seguranças, funcionários, civis)
// ============================================================================
//
// Antes da entrada vivem a sua rotina (balcão, secretária, ronda). Quando a
// equipa entra, reagem de forma determinística: sobressalto → mãos no ar →
// agrupados no canto de reunião sob vigia → ajoelhados até ao fim. Um civil
// pode fugir pela saída de emergência (se existir) — puro sabor narrativo,
// sem efeito na chance (essa vem do live_log do servidor).
//
// Usa o mesmo formato de segmentos da equipa (segments.js) — o OperationView
// avalia NPCs e operacionais com o mesmo motor O(1).

import { holdSeg, moveSeg, spotNear, WALK, RUN } from "./segments";

export const NPC_META = {
  guarda:      { label: "Segurança",   color: "#93c5fd" },
  funcionario: { label: "Funcionário", color: "#d4d4d8" },
  civil:       { label: "Civil",       color: "#a8a29e" },
};

const STAFF_NAMES = ["Sr. Bento", "D. Amélia", "Miguel", "Rita", "Sr. Costa", "Inês"];
const CIVIL_NAMES = ["Carlos", "D. Rosa", "Tomás", "Beatriz", "Sr. Ilídio", "Marta"];
const GUARD_NAMES = ["Vieira", "Barbosa", "Cardoso", "Machado"];

const nameFor = (kind, rng) => {
  const pool = kind === "guarda" ? GUARD_NAMES : kind === "civil" ? CIVIL_NAMES : STAFF_NAMES;
  return pool[Math.floor(rng() * pool.length)];
};

// ---------------------------------------------------------------------------
// Constrói os NPCs. T = { arrive, tEnt0, tProg0, tRet0, tExit0, tEnd }.
// Devolve { npcs, assembly, fled } — assembly é o canto de reunião dos reféns.
// ---------------------------------------------------------------------------
export function buildNpcs(b, T, rng) {
  const spawns = b.npcSpawns || [];
  if (!spawns.length) return { npcs: [], assembly: null, fled: null };

  // canto de reunião: canto da sala frontal mais afastado da entrada
  const front = b.rooms[b.roomMap[(b.entry.y - 1) * b.gw + b.entry.x]] || b.rooms[0];
  const corners = [
    [front.x0 + 1, front.y0 + 1], [front.x1 - 1, front.y0 + 1],
    [front.x0 + 1, front.y1 - 1], [front.x1 - 1, front.y1 - 1],
  ];
  let best = corners[0], bd = -1;
  for (const c of corners) {
    const d = Math.hypot(c[0] - b.entry.x, c[1] - b.entry.y);
    if (d > bd) { bd = d; best = c; }
  }
  const assembly = { x: best[0], y: best[1] };
  const emg = (b.doors || []).find((d) => d.emergency);

  const npcs = [];
  let fled = null;

  spawns.forEach((sp, k) => {
    const segs = [];
    let cur = { x: sp.x, y: sp.y };
    const baseFace = sp.face ?? Math.PI / 2;
    const idleLabel = sp.kind === "guarda" ? "Ronda de rotina"
      : sp.kind === "civil" ? "Sem suspeitar de nada" : "A trabalhar";

    // ---------------- rotina antes da entrada ----------------
    if (sp.kind === "guarda" && sp.patrol && sp.patrol.length >= 2) {
      let pt = T.arrive - 8, at = cur, flip = false;
      while (pt < T.tEnt0 - 1.5) {
        const dst = sp.patrol[flip ? 0 : 1];
        const mv = moveSeg(b, pt, Math.min(8, T.tEnt0 - pt), at, dst, WALK * 0.6, idleLabel);
        segs.push(mv.seg); at = mv.end; pt = mv.seg.t1;
        const ht = Math.min(T.tEnt0, pt + 3 + rng() * 2.5);
        segs.push(holdSeg(pt, ht, at.x, at.y, baseFace + (rng() - 0.5) * 1.4, idleLabel));
        pt = ht; flip = !flip;
      }
      if (pt < T.tEnt0) segs.push(holdSeg(pt, T.tEnt0, at.x, at.y, baseFace, idleLabel));
      cur = at;
    } else {
      segs.push(holdSeg(T.arrive - 8, T.tEnt0, cur.x, cur.y, baseFace, idleLabel));
    }

    const faceEntry = Math.atan2(b.entry.y - cur.y, b.entry.x - cur.x);

    // ---------------- sobressalto ----------------
    const react = T.tEnt0 + 0.7 + k * 0.5;
    segs.push(holdSeg(T.tEnt0, react, cur.x, cur.y, faceEntry, "!!", { startled: true }));

    // ---------------- fuga pela saída de emergência (só civis) ----------------
    if (sp.kind === "civil" && emg && !fled && rng() < 0.35) {
      const mv = moveSeg(b, react, 7, cur, { x: emg.x, y: emg.y }, RUN * 0.95, "A fugir!", { run: true, panic: true });
      segs.push(mv.seg);
      segs.push({ t0: mv.seg.t1, t1: Infinity, kind: "gone" });
      const name = nameFor(sp.kind, rng);
      fled = { at: mv.seg.t1, name };
      npcs.push({ name, kind: sp.kind, roleLabel: NPC_META[sp.kind].label, color: NPC_META[sp.kind].color, segs, _lastIdx: 0 });
      return;
    }

    // ---------------- mãos no ar ----------------
    const handsT = react + 1.4 + rng() * 0.8;
    segs.push(holdSeg(react, handsT, cur.x, cur.y, faceEntry, "Mãos no ar", { hands: true }));

    // ---------------- agrupado no canto ----------------
    const spot = spotNear(b, assembly.x, assembly.y, k, rng);
    const mv = moveSeg(b, handsT, 9, cur, spot, WALK * 0.62, "Levado para o canto", { hands: true });
    segs.push(mv.seg);
    const kneelFace = Math.atan2(front.cy - mv.end.y, front.cx - mv.end.x);

    // ---------------- ajoelhado até ao fim ----------------
    segs.push(holdSeg(mv.seg.t1, T.tExit0 + 2, mv.end.x, mv.end.y, kneelFace, "Sob vigilância", { kneel: true, hands: true }));
    segs.push(holdSeg(T.tExit0 + 2, T.tEnd + 60, mv.end.x, mv.end.y, kneelFace, "Ainda em choque", { kneel: true }));

    npcs.push({
      name: nameFor(sp.kind, rng), kind: sp.kind,
      roleLabel: NPC_META[sp.kind].label, color: NPC_META[sp.kind].color,
      segs, _lastIdx: 0,
    });
  });

  return { npcs, assembly, fled };
}
