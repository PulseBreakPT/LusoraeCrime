// ============================================================================
// interiorSim.js — Simulação tática do interior (IA por papel + fases)
// ============================================================================
//
// Expansão do motor exterior (choreo.js) para dentro do edifício: mesma
// filosofia — 100% determinístico, derivado dos timestamps reais da missão
// (arrive_at/finish_at) + seed do id. Zero estado no servidor, reproduzível
// após refresh, sincronizado com o mapa (o exterior continua a correr).
//
// Fases (janela de operação): aproximação → entrada → progressão → execução
// → objetivo concluído → retirada → regresso ao veículo. Cada fase muda
// automaticamente o comportamento dos operacionais.
//
// IA por papel: líder (coordena junto ao objetivo), especialista (executa o
// objetivo físico), batedor (varre à frente), vigias (protegem entrada e
// corredores), carregadores (saqueiam/transportam mercadoria).
//
// Toda a navegação usa A* (pathfind.js): nunca atravessam paredes — apenas
// portas e corredores. Avaliação por frame O(1) por agente (segmentos
// pré-calculados com timestamps absolutos).

import { hashStr, mulberry32 } from "../simCore";
import { nearestWalkable, pointAlong } from "./pathfind";
import { OBJECTIVES } from "./buildingGen";
import { buildNpcs } from "./npc";
import {
  clamp, WALK, RUN, holdSeg, actionSeg, moveSeg, rawMoveSeg, spotNear,
  injectAlerts, evalAgent, activeAlert,
} from "./segments";

export const INTERIOR_PHASES = [
  { key: "aproximacao", label: "Aproximação ao alvo" },
  { key: "entrada", label: "Entrada" },
  { key: "progressao", label: "Progressão" },
  { key: "execucao", label: "Execução do objetivo" },
  { key: "concluido", label: "Objetivo concluído" },
  { key: "retirada", label: "Retirada" },
  { key: "saida", label: "Regresso ao veículo" },
];

export const ROLE_META = {
  leader:     { label: "Líder",        color: "#FBBF24" },
  specialist: { label: "Especialista", color: "#F87171" },
  scout:      { label: "Batedor",      color: "#22D3EE" },
  guard:      { label: "Vigia",        color: "#A1A1AA" },
  carrier:    { label: "Carregador",   color: "#34D399" },
};

const DRIVER_KEYS = new Set(["motorista", "piloto"]);
const RANK_ORDER = ["recruta", "membro", "especialista", "veterano", "tenente", "chefe_equipa", "braco_direito"];
// Preferência de especialização real → papel interior, por tipo de objetivo.
const SPECIALIST_PREF = {
  safe: ["assaltante", "falsificador", "seguranca"],
  collect: ["assaltante", "contrabandista"],
  hack: ["hacker", "espiao"],
  docs: ["espiao", "informador", "hacker", "advogado"],
  destroy: ["assaltante", "seguranca"],
  carry: ["contrabandista", "gestor"],
  negotiate: ["negociador", "advogado", "gestor"],
};
const SCOUT_PREF = ["espiao", "informador", "seguranca", "assaltante"];
const CARRIER_PREF = ["contrabandista", "gestor", "lavador", "mecanico"];

// ---------------------------------------------------------------------------
// Papéis
// ---------------------------------------------------------------------------
function assignRoles(members, objKind, n, rng) {
  const roles = new Array(n).fill("guard");
  const taken = new Array(n).fill(false);
  // líder = patente mais alta
  let leaderIdx = 0, best = -1;
  for (let i = 0; i < n; i++) {
    const rk = RANK_ORDER.indexOf(members[i]?.rank);
    if (rk > best) { best = rk; leaderIdx = i; }
  }
  roles[leaderIdx] = "leader"; taken[leaderIdx] = true;

  const pickBy = (prefs) => {
    for (const p of prefs) {
      for (let i = 0; i < n; i++) if (!taken[i] && members[i]?.role_key === p) return i;
    }
    for (let i = 0; i < n; i++) if (!taken[i]) return i;
    return -1;
  };

  // especialista (executa o objetivo)
  let specIdx = n === 1 ? leaderIdx : pickBy(SPECIALIST_PREF[objKind] || []);
  if (specIdx >= 0 && specIdx !== leaderIdx) { roles[specIdx] = "specialist"; taken[specIdx] = true; }
  else specIdx = leaderIdx; // solo: o líder executa

  // batedor
  let scoutIdx = -1;
  if (n >= 3) {
    scoutIdx = pickBy(SCOUT_PREF);
    if (scoutIdx >= 0) { roles[scoutIdx] = "scout"; taken[scoutIdx] = true; }
  }
  // carregadores
  const nCarriers = n >= 6 ? 2 : n >= 4 ? 1 : 0;
  const carrierIdx = [];
  for (let k = 0; k < nCarriers; k++) {
    const c = pickBy(CARRIER_PREF);
    if (c >= 0) { roles[c] = "carrier"; taken[c] = true; carrierIdx.push(c); }
  }
  return { roles, leaderIdx, specIdx, scoutIdx, carrierIdx };
}

// ---------------------------------------------------------------------------
// Construção da simulação
// ---------------------------------------------------------------------------
export function buildInteriorSim(mission, building, roster) {
  const b = building;
  const arrive = Date.parse(mission.arrive_at) / 1000;
  const finish = Date.parse(mission.finish_at) / 1000;
  const W = Math.max(6, finish - arrive);
  const rng = mulberry32(hashStr(String(mission.id || "m") + ":sim"));

  // ----- Réplica EXATA da regra do motorista do choreo.js (sincronização) -----
  const nTotal = clamp((mission.member_ids || []).length || 2, 1, 6);
  const members = Array.isArray(roster) ? roster.slice(0, nTotal) : [];
  const choreoRng = mulberry32(hashStr(String(mission.id || "m")));
  let driverIdx = -1;
  if (nTotal >= 3) {
    for (let i = 0; i < members.length; i++) {
      if (members[i] && DRIVER_KEYS.has(members[i].role_key)) { driverIdx = i; break; }
    }
    if (driverIdx >= 0 && choreoRng() >= 0.75) driverIdx = -1;
  } else driverIdx = -1;
  const ground = [];
  for (let i = 0; i < nTotal; i++) {
    if (i === driverIdx) continue;
    ground.push(members[i] || null);
  }
  const n = ground.length;

  // ----- Janela interior + fases -----
  const T0 = arrive + Math.min(10, Math.max(2.5, W * 0.10));
  const T1 = finish - Math.max(1, W * 0.02);
  const IW = Math.max(4, T1 - T0);
  const fr = [0.09, 0.17, 0.50, 0.05, 0.12, 0.07];
  const cuts = [T0];
  for (const f of fr) cuts.push(cuts[cuts.length - 1] + IW * f);
  const [tEnt0, tProg0, tExec0, tDone0, tRet0, tExit0, tEnd] =
    [cuts[0], cuts[1], cuts[2], cuts[3], cuts[4], cuts[5], cuts[6]];
  const phases = [
    { key: "aproximacao", t0: arrive, t1: tEnt0 },
    { key: "entrada", t0: tEnt0, t1: tProg0 },
    { key: "progressao", t0: tProg0, t1: tExec0 },
    { key: "execucao", t0: tExec0, t1: tDone0 },
    { key: "concluido", t0: tDone0, t1: tRet0 },
    { key: "retirada", t0: tRet0, t1: tExit0 },
    { key: "saida", t0: tExit0, t1: tEnd },
  ].map((p) => ({ ...p, label: INTERIOR_PHASES.find((x) => x.key === p.key)?.label || p.key }));

  const obj = b.objective;
  const objDef = OBJECTIVES[obj.kind] || OBJECTIVES.collect;
  const { roles, leaderIdx, specIdx, scoutIdx, carrierIdx } = assignRoles(ground, obj.kind, n, rng);

  // ----- Pontos-chave -----
  const entry = b.entry;
  const inside = nearestWalkable(b.grid, b.gw, b.gh, entry.x, entry.y - 1, 4) || { x: entry.x, y: entry.y - 1 };
  const frontRoom = b.rooms[b.roomMap[inside.y * b.gw + inside.x]] || b.rooms[0];
  const objRoom = b.rooms[obj.roomId] || b.rooms[b.rooms.length - 1];
  const objDoor = b.doors.find((d) => d.roomA === obj.roomId || d.roomB === obj.roomId);
  const corridor = b.rooms.find((r) => r.key === "corredor");
  const faceDoor = Math.PI / 2; // virado para a fachada (sul)

  // ----- Alertas: complicações REAIS do live_log (timestamps do servidor) -----
  // As janelas de alerta fazem vigias/batedor/líder reagir no instante exato
  // em que a complicação acontece na transmissão — mesma verdade do backend.
  const alerts = (mission.live_log || [])
    .filter((e) => (e.kind === "comp_bad" || e.kind === "comp_good") && e.phase === "operating")
    .map((e) => ({ t0: Date.parse(e.at) / 1000, good: e.kind === "comp_good", text: e.text || "" }))
    .filter((a) => Number.isFinite(a.t0) && a.t0 > T0 && a.t0 < tEnd)
    .sort((a, c) => a.t0 - c.t0);

  // ----- Ocupantes do edifício (NPCs) -----
  const rngNpc = mulberry32(hashStr(String(mission.id || "m") + ":npc"));
  const { npcs, assembly, fled } = buildNpcs(
    b, { arrive, tEnt0, tProg0, tExec0, tRet0, tExit0, tEnd }, rngNpc
  );

  // ----- Registo de saque (contador em tempo real + pilha junto à saída) -----
  const lootTimes = [];
  const lootDrops = [];

  // ----- Comms -----
  const comms = [];
  const nameOf = (i) => ground[i]?.name || `Operacional ${i + 1}`;
  const say = (at, i, text) => comms.push({ at, speaker: nameOf(i), text });

  // ----- Guiões por agente -----
  const agents = [];
  const enterOrder = [];
  if (scoutIdx >= 0) enterOrder.push(scoutIdx);
  if (!enterOrder.includes(leaderIdx)) enterOrder.push(leaderIdx);
  if (!enterOrder.includes(specIdx)) enterOrder.push(specIdx);
  for (let i = 0; i < n; i++) if (!enterOrder.includes(i)) enterOrder.push(i);

  const entDur = tProg0 - tEnt0;
  const stagger = entDur / Math.max(2, n + 1);

  for (let i = 0; i < n; i++) {
    const role = roles[i];
    const segs = [];
    const orderK = enterOrder.indexOf(i);
    // posição na fila cá fora (junto à fachada, ligeiramente ao lado da porta)
    const side = orderK % 2 === 0 ? -1 : 1;
    const stack = { x: entry.x + side * (1 + (orderK >> 1)), y: entry.y + 1 + (orderK > 3 ? 1 : 0) };

    // aproximação: invisível até ~meio da fase (o exterior mostra-os a chegar)
    const showAt = arrive + (tEnt0 - arrive) * (0.45 + 0.4 * (orderK / Math.max(1, n)));
    segs.push({ t0: arrive - 5, t1: showAt, kind: "hidden" });
    // fila junto à entrada
    const tIn = tEnt0 + 0.4 + orderK * stagger;
    segs.push(holdSeg(showAt, tIn, stack.x, stack.y, -Math.PI / 2, "Em posição na entrada"));
    // atravessar a porta (via ponto alinhado com a porta — nunca cruzar a
    // fachada na diagonal por células de parede)
    const belowDoor = { x: entry.x, y: entry.y + 1 };
    const aboveDoor = { x: entry.x, y: entry.y - 1 };
    const enterPts = [stack, belowDoor, { x: entry.x, y: entry.y }, aboveDoor, inside];
    segs.push(rawMoveSeg(tIn, Math.min(1.6, stagger), enterPts, "A entrar"));
    let cur = { x: inside.x, y: inside.y };
    let t = tIn + Math.min(1.6, stagger);

    // ---------------- Progressão + Execução por papel ----------------
    if (role === "leader" && i !== specIdx) {
      const post = spotNear(b, obj.x, obj.y, i + 1, rng);
      const mv1 = moveSeg(b, t, (tExec0 - t) * 0.55, cur, { x: Math.round(frontRoom.cx), y: Math.round(frontRoom.cy) }, WALK, "A avançar");
      segs.push(mv1.seg); cur = mv1.end; t = mv1.seg.t1;
      segs.push(holdSeg(t, t + Math.max(0.5, (tExec0 - t) * 0.25), cur.x, cur.y, Math.atan2(obj.y - cur.y, obj.x - cur.x), "A coordenar a equipa"));
      t = segs[segs.length - 1].t1;
      const mv2 = moveSeg(b, t, tExec0 - t, cur, post, WALK, "A avançar para o objetivo");
      segs.push(mv2.seg); cur = mv2.end; t = mv2.seg.t1;
      // execução: supervisiona junto ao objetivo com reposicionamentos
      const mid = tExec0 + (tDone0 - tExec0) * (0.45 + rng() * 0.2);
      segs.push(holdSeg(t, mid, cur.x, cur.y, Math.atan2(obj.anchor.y - cur.y, obj.anchor.x - cur.x), "A supervisionar"));
      const post2 = spotNear(b, objDoor ? objDoor.x : obj.x, objDoor ? objDoor.y + 1 : obj.y, i + 3, rng);
      const mv3 = moveSeg(b, mid, Math.min(4, tDone0 - mid), cur, post2, WALK, "A verificar o perímetro");
      segs.push(mv3.seg); cur = mv3.end;
      segs.push(holdSeg(mv3.seg.t1, tRet0, cur.x, cur.y, faceDoor, "A dar ordem de retirada"));
      t = tRet0;
    } else if (i === specIdx) {
      const mv = moveSeg(b, t, tExec0 - t - 0.3, cur, { x: obj.x, y: obj.y }, WALK, "A avançar para o objetivo");
      segs.push(mv.seg); cur = mv.end; t = mv.seg.t1;
      if (t < tExec0) { segs.push(holdSeg(t, tExec0, cur.x, cur.y, Math.atan2(obj.anchor.y - cur.y, obj.anchor.x - cur.x), "A preparar")); t = tExec0; }
      // ação principal — janela completa de execução
      segs.push(actionSeg(tExec0, tDone0, obj.x, obj.y, Math.atan2(obj.anchor.y - obj.y, obj.anchor.x - obj.x), obj.act, { objective: true, tool: obj.kind }));
      lootTimes.push(tDone0);
      segs.push(holdSeg(tDone0, tRet0, obj.x, obj.y, faceDoor, "Objetivo garantido", { carry: objDef.carry }));
      t = tRet0;
    } else if (role === "scout") {
      // CQB: verifica os cantos imediatamente após entrar
      segs.push(holdSeg(t, t + 0.7, cur.x, cur.y, -faceDoor, "A verificar os cantos", { look: [Math.PI * 0.85, 0.15, -Math.PI / 2] }));
      t += 0.7;
      // varre: sala frontal → divisão do objetivo → posto avançado
      const sweep1 = { x: Math.round(frontRoom.cx), y: Math.round(frontRoom.cy) };
      const mv1 = moveSeg(b, t, (tExec0 - t) * 0.3, cur, sweep1, WALK * 1.15, "A varrer a área");
      segs.push(mv1.seg); cur = mv1.end; t = mv1.seg.t1;
      const sweep2 = spotNear(b, Math.round(objRoom.cx), Math.round(objRoom.cy), i, rng);
      const mv2 = moveSeg(b, t, (tExec0 - t) * 0.55, cur, sweep2, WALK * 1.15, "A varrer a área");
      segs.push(mv2.seg); cur = mv2.end; t = mv2.seg.t1;
      segs.push(holdSeg(t, tExec0, cur.x, cur.y, Math.atan2(obj.anchor.y - cur.y, obj.anchor.x - cur.x), "Divisão limpa"));
      // execução: patrulha entre a porta do objetivo e o corredor/sala frontal
      const pA = objDoor ? spotNear(b, objDoor.x, objDoor.y + 1, i, rng) : cur;
      const pB = corridor ? { x: Math.round(corridor.cx), y: Math.round(corridor.cy) } : sweep1;
      let pt = tExec0, at = cur, flip = false;
      while (pt < tRet0 - 2) {
        const dst = flip ? pA : pB;
        const mv = moveSeg(b, pt, Math.min(6, tRet0 - pt), at, dst, WALK * 0.9, "A vigiar os corredores");
        segs.push(mv.seg); at = mv.end; pt = mv.seg.t1;
        const holdT = Math.min(tRet0, pt + 3.5 + rng() * 3);
        segs.push(holdSeg(pt, holdT, at.x, at.y, flip ? -faceDoor : faceDoor, "A vigiar os corredores", {
          look: [Math.atan2(pA.y - at.y, pA.x - at.x), Math.atan2(pB.y - at.y, pB.x - at.x)],
        }));
        pt = holdT; flip = !flip;
      }
      if (pt < tRet0) segs.push(holdSeg(pt, tRet0, at.x, at.y, faceDoor, "A vigiar os corredores"));
      cur = at; t = tRet0;
    } else if (role === "carrier") {
      const spots = b.lootSpots.length ? b.lootSpots : [{ x: obj.x, y: obj.y, face: 0 }];
      const kIdx = carrierIdx.indexOf(i);
      let pt = t, at = cur, s = kIdx % spots.length;
      const carryKind = obj.kind === "carry" ? "box" : "money";
      const shuttle = obj.kind === "carry"; // leva a mercadoria até à entrada
      let looted = false;
      while (pt < tRet0 - 3) {
        const spot = spots[s % spots.length];
        const mv = moveSeg(b, pt, Math.min(7, tRet0 - pt), at, spot, WALK, looted && !shuttle ? "A transportar o saque" : "A avançar", looted && !shuttle ? { carry: carryKind } : {});
        segs.push(mv.seg); at = mv.end; pt = mv.seg.t1;
        const actT = Math.min(tRet0, pt + 2.5 + rng() * 2.5);
        segs.push(actionSeg(pt, actT, at.x, at.y, spot.face ?? 0, obj.kind === "carry" ? "A carregar mercadoria" : "A recolher valores"));
        pt = actT; looted = true;
        lootTimes.push(actT);
        if (shuttle) {
          const back = moveSeg(b, pt, Math.min(7, tRet0 - pt), at, inside, WALK * 0.92, "A transportar a carga", { carry: "box" });
          segs.push(back.seg); at = back.end; pt = back.seg.t1;
          const dropT = Math.min(tRet0, pt + 1.2);
          segs.push(actionSeg(pt, dropT, at.x, at.y, faceDoor, "A empilhar junto à saída"));
          lootDrops.push({
            t: dropT,
            x: at.x + ((lootDrops.length % 3) - 1) * 0.55,
            y: at.y - 0.7 - Math.floor(lootDrops.length / 3) * 0.6,
          });
          pt = dropT;
        }
        s++;
      }
      if (pt < tRet0) segs.push(holdSeg(pt, tRet0, at.x, at.y, faceDoor, "Pronto para retirar", looted ? { carry: carryKind } : {}));
      cur = at; t = tRet0;
    } else {
      // vigia: postos com propósito — entrada, reféns, corredor/porta do objetivo
      const guardsAll = enterOrder.filter((k) => roles[k] === "guard");
      const guardSlot = guardsAll.indexOf(i);
      const hostages = npcs.length > 0 && assembly;
      let post, face, label;
      const lookPts = [];
      if (guardSlot === 0 && hostages && guardsAll.length === 1) {
        // vigia único com reféns: cobre a entrada sem perder o canto de vista
        post = spotNear(b, Math.round((inside.x + assembly.x) / 2), Math.round((inside.y + assembly.y) / 2), i, rng);
        face = faceDoor;
        label = "A vigiar entrada e reféns";
        lookPts.push(entry, assembly);
      } else if (guardSlot === 0) {
        post = spotNear(b, inside.x + (rng() < 0.5 ? -1 : 1), inside.y, i, rng);
        face = faceDoor; // de frente para a entrada
        label = "A proteger a entrada";
        lookPts.push(entry);
      } else if (guardSlot === 1 && hostages) {
        post = spotNear(
          b,
          assembly.x + Math.sign(frontRoom.cx - assembly.x) * 2,
          assembly.y + Math.sign(frontRoom.cy - assembly.y) * 2,
          i, rng
        );
        face = Math.atan2(assembly.y - post.y, assembly.x - post.x);
        label = "A vigiar os reféns";
        lookPts.push(assembly, entry);
      } else if (corridor) {
        post = spotNear(b, Math.round(corridor.cx), Math.round(corridor.cy), i, rng);
        face = 0;
        label = "A vigiar o corredor";
        if (objDoor) lookPts.push(objDoor);
        lookPts.push(entry);
      } else if (objDoor) {
        post = spotNear(b, objDoor.x, objDoor.y + 1, i, rng);
        face = -faceDoor;
        label = "A cobrir a porta do objetivo";
        lookPts.push(objDoor, entry);
      } else {
        post = spotNear(b, Math.round(frontRoom.cx), Math.round(frontRoom.cy), i, rng);
        face = faceDoor;
        label = "A cobrir a sala";
        lookPts.push(entry);
      }
      const mv = moveSeg(b, t, (tExec0 - t) * 0.6, cur, post, WALK, "A tomar posição");
      segs.push(mv.seg); cur = mv.end; t = mv.seg.t1;
      // olhar dirigido: alterna entre os pontos de interesse do posto
      const look = lookPts.map((p) => Math.atan2(p.y - cur.y, p.x - cur.x));
      if (look.length === 1) look.push(look[0] + 0.85);
      const mid = t + (tRet0 - t) * (0.4 + rng() * 0.25);
      segs.push(holdSeg(t, mid, cur.x, cur.y, face, label, { look }));
      segs.push(holdSeg(mid, tRet0, cur.x, cur.y, face + (rng() - 0.5) * 1.2, label, { look: [...look].reverse() }));
      t = tRet0;
    }

    // ---------------- Retirada + saída (todos) ----------------
    const exitStagger = ((tExit0 - tRet0) / Math.max(2, n + 1)) * orderK;
    const carryOut = i === specIdx ? objDef.carry : role === "carrier" ? (obj.kind === "carry" ? "box" : "money") : null;
    const mvOut = moveSeg(b, tRet0 + exitStagger * 0.4, tExit0 - (tRet0 + exitStagger * 0.4), cur, inside, RUN, "A retirar", carryOut ? { carry: carryOut, run: true } : { run: true });
    segs.push(mvOut.seg); cur = mvOut.end;
    let tOut = Math.max(mvOut.seg.t1, tExit0 + orderK * ((tEnd - tExit0) / Math.max(2, n + 1)) * 0.7);
    segs.push(holdSeg(mvOut.seg.t1, tOut, cur.x, cur.y, faceDoor, "A cobrir a saída", carryOut ? { carry: carryOut } : {}));
    const outPts = [cur, aboveDoor, { x: entry.x, y: entry.y }, belowDoor, { x: stack.x, y: stack.y }];
    segs.push(rawMoveSeg(tOut, 1.4, outPts, "A sair do edifício", carryOut ? { carry: carryOut, run: true } : { run: true }));
    segs.push({ t0: tOut + 1.4, t1: tOut + 2.6, kind: "hold", x: stack.x, y: stack.y, face: -Math.PI / 2, label: "A regressar ao veículo", fade: true, ...(carryOut ? { carry: carryOut } : {}) });
    segs.push({ t0: tOut + 2.6, t1: Infinity, kind: "gone" });

    // reações a complicações reais: vigias/batedor/líder viram-se para a
    // entrada no instante exato em que a transmissão relata o problema
    const reactive = role === "guard" || role === "scout" || (role === "leader" && i !== specIdx);
    agents.push({
      name: nameOf(i), role, roleLabel: ROLE_META[role].label, color: ROLE_META[role].color,
      roleKey: ground[i]?.role_key || null,
      segs: reactive ? injectAlerts(segs, alerts, inside) : segs,
      _lastIdx: 0,
    });
  }

  // ----- Comms determinísticos -----
  say(tEnt0 + 0.5, leaderIdx, "Em posição. Vamos entrar.");
  if (scoutIdx >= 0) say(tProg0 + (tExec0 - tProg0) * 0.35, scoutIdx, "Entrada limpa. A avançar.");
  say(tExec0 - (tExec0 - tProg0) * 0.15, scoutIdx >= 0 ? scoutIdx : leaderIdx, `${objRoom.name} localizada.`);
  say(tExec0 + 1, specIdx, obj.kind === "safe" ? "A trabalhar no cofre." : obj.kind === "hack" ? "Ligação estabelecida — a extrair." : obj.kind === "carry" ? "A carregar a mercadoria." : obj.kind === "docs" ? "A vasculhar os arquivos." : obj.kind === "negotiate" ? "Estou com ele. A negociar." : obj.kind === "destroy" ? "A destruir as provas." : "A recolher o saque.");
  const guards = agents.map((a, i) => (a.role === "guard" ? i : -1)).filter((i) => i >= 0);
  if (guards.length) say(tExec0 + (tDone0 - tExec0) * 0.35, guards[0], "Entrada segura. Sem movimento.");
  say(tExec0 + (tDone0 - tExec0) * 0.55, specIdx, obj.kind === "hack" ? "Transferência a 60%." : obj.kind === "safe" ? "Última tranca. Quase." : "Mais de metade. Aguentem posições.");
  if (guards.length > 1) say(tExec0 + (tDone0 - tExec0) * 0.75, guards[1], "Corredor controlado.");
  say(tDone0 + 0.5, specIdx, "Feito! Objetivo garantido.");
  say(tRet0 + 0.4, leaderIdx, "Retirar! Todos para a saída.");
  say(tEnd - 1, leaderIdx, "Todos cá fora. Para o veículo!");
  // controlo de ocupantes
  if (npcs.length) {
    const herder = guards.length ? guards[0] : leaderIdx;
    say(tEnt0 + 1.2, herder, "No chão! Mãos onde as veja!");
    say(tProg0 + 1.5, herder, `${npcs.length} ${npcs.length === 1 ? "ocupante controlado" : "ocupantes controlados"}. Canto seguro.`);
  }
  if (fled) say(fled.at + 0.5, leaderIdx, "Um civil fugiu pelas traseiras. Foco na missão!");
  // reação falada às complicações reais da transmissão
  for (const al of alerts) {
    const reactor = guards.length ? guards[al.good ? 0 : guards.length - 1] : leaderIdx;
    say(al.t0 + 1.1, reactor, al.good ? "Está resolvido. Continuamos." : "Atentos! Temos movimento.");
  }
  comms.sort((a, c) => a.at - c.at);

  lootTimes.sort((a, c) => a - c);

  return {
    building: b, arrive, finish, T0, T1,
    phases, agents, comms,
    objective: { ...obj, t0: tExec0, t1: tDone0 },
    driverOut: driverIdx >= 0,
    entry, inside,
    npcs, assembly, fled, alerts,
    lootTimes, lootDrops,
  };
}

// ---------------------------------------------------------------------------
// Avaliação por frame — O(1) por agente
// ---------------------------------------------------------------------------
export function phaseAt(sim, tSec) {
  if (tSec < sim.phases[0].t0) return { key: "aproximacao", label: INTERIOR_PHASES[0].label };
  for (const p of sim.phases) if (tSec < p.t1) return p;
  return sim.phases[sim.phases.length - 1];
}

export function objectiveProgress(sim, tSec) {
  const { t0, t1 } = sim.objective;
  if (tSec <= t0) return 0;
  if (tSec >= t1) return 1;
  return (tSec - t0) / Math.max(0.001, t1 - t0);
}

export function agentStateAt(sim, i, tSec) {
  const a = sim.agents[i];
  if (!a) return null;
  const segs = a.segs;
  // memoização do índice (avanço quase sempre monotónico)
  let k = a._lastIdx;
  if (k >= segs.length || tSec < segs[k].t0) k = 0;
  while (k < segs.length - 1 && tSec >= segs[k].t1) k++;
  a._lastIdx = k;
  const s = segs[k];
  if (!s || s.kind === "hidden" || s.kind === "gone") return null;

  if (s.kind === "move") {
    const f = clamp((tSec - s.t0) / Math.max(0.001, s.t1 - s.t0), 0, 1);
    const p = pointAlong(s.pts, s.metrics, f);
    // passada: bob subtil perpendicular ao movimento
    const bob = Math.sin(tSec * (s.run ? 13 : 9) + i * 2.3) * 0.055;
    return {
      x: p.x + Math.cos(p.heading + Math.PI / 2) * bob,
      y: p.y + Math.sin(p.heading + Math.PI / 2) * bob,
      heading: p.heading, action: null, label: s.label,
      carry: s.carry || null, run: !!s.run, moving: true, alpha: 1,
    };
  }
  // hold / action — deriva idle + varrimento do olhar
  const sway = s.kind === "action" ? 0.03 : 0.07;
  const x = s.x + Math.sin(tSec * 0.9 + i * 2.1) * sway;
  const y = s.y + Math.cos(tSec * 0.7 + i * 1.4) * sway;
  const scan = s.kind === "action" ? 0.12 : 0.55;
  const heading = (s.face ?? 0) + Math.sin(tSec * 0.5 + i * 1.7) * scan;
  let alpha = 1;
  if (s.fade) alpha = clamp(1 - (tSec - s.t0) / Math.max(0.001, s.t1 - s.t0), 0, 1);
  return {
    x, y, heading, action: s.kind === "action" ? s.label : null, label: s.label,
    carry: s.carry || null, run: false, moving: false, alpha,
    objective: !!s.objective,
  };
}

// Últimas k comunicações até t (mistura com o live_log da missão no viewer).
export function commsUpto(sim, tSec, k = 3) {
  const out = [];
  for (let i = sim.comms.length - 1; i >= 0 && out.length < k; i--) {
    if (sim.comms[i].at <= tSec) out.push(sim.comms[i]);
  }
  return out.reverse();
}
