// Coreografia visual das missões — simulação determinística 100% no cliente.
//
// Tudo é derivado dos timestamps do motor (arrive_at/finish_at) + seed do id da
// missão: a cena é reproduzível após refresh, mantém-se sincronizada com o ETA
// real e não precisa de qualquer estado adicional no servidor. A avaliação por
// frame (opStateAt) é matemática pura O(1) por operacional — escala para
// dezenas de missões simultâneas sem custo relevante.

import { buildCumulative, pointOnRoute } from "./routing";

// ---------- PRNG determinístico ----------
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Geometria (aproximação local em metros) ----------
const M_LAT = 111320;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function offsetM(pt, eastM, northM) {
  return {
    lat: pt.lat + northM / M_LAT,
    lng: pt.lng + eastM / (M_LAT * Math.cos((pt.lat * Math.PI) / 180)),
  };
}

function bearingRad(a, b) {
  const east = (b.lng - a.lng) * M_LAT * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const north = (b.lat - a.lat) * M_LAT;
  return Math.atan2(east, north);
}

function distMeters(a, b) {
  const east = (b.lng - a.lng) * M_LAT * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const north = (b.lat - a.lat) * M_LAT;
  return Math.hypot(east, north);
}

// Ponto num anel à volta de `center`, na direção `bearing` (rad), a `dist` metros.
const ringPoint = (center, bearing, dist) =>
  offsetM(center, Math.sin(bearing) * dist, Math.cos(bearing) * dist);

// Caminho a pé orgânico — bezier quadrática amostrada com barriga lateral.
function walkPath(from, to, bulgeM, samples = 12) {
  const mid = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
  const perp = bearingRad(from, to) + Math.PI / 2;
  const ctrl = offsetM(mid, Math.sin(perp) * bulgeM, Math.cos(perp) * bulgeM);
  const latlngs = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const a = 1 - t;
    latlngs.push([
      a * a * from.lat + 2 * a * t * ctrl.lat + t * t * to.lat,
      a * a * from.lng + 2 * a * t * ctrl.lng + t * t * to.lng,
    ]);
  }
  const cum = buildCumulative(latlngs);
  return { latlngs, cum, length: cum[cum.length - 1] || 0 };
}

const pathAt = (path, f) => pointOnRoute(path.latlngs, path.cum, clamp(f, 0, 1));

// Avanço em passos (infiltração): mover ~62% de cada troço, pausar o resto.
function steppedEase(t) {
  const steps = 4;
  const seg = 1 / steps;
  const k = Math.min(steps - 1, Math.floor(clamp(t, 0, 1) / seg));
  const within = (clamp(t, 0, 1) - k * seg) / seg;
  const moveFrac = 0.62;
  const p = within < moveFrac ? smooth(within / moveFrac) : 1;
  return clamp((k + p) * seg, 0, 1);
}

// ---------- Arquetipos por tipo de oportunidade ----------
// heist   — entram no edifício (vigia à porta), saem com o saque
// spread  — dispersam pelas entradas, convergem e entram
// cargo   — vaivém contínuo veículo<->alvo a carregar/descarregar
// colect  — semicírculo a "negociar" frente ao alvo
// stealth — fila indiana, movimento-pausa, semi-transparentes, pelas traseiras
// tech    — 1 operacional planta o dispositivo, os restantes vigiam o veículo
// combat  — arco tático com corridas curtas entre coberturas
// vip     — escolta em diamante à volta do ponto
const TYPE_CHOREO = {
  assalto: "heist",
  roubo: "heist",
  roubo_joalharia: "heist",
  assalto_licorista: "heist",
  assalto_penhores: "heist",
  assalto_casino: "heist",
  assalto_museu: "heist",
  assalto_armado: "spread",
  transporte: "cargo",
  contrabando: "cargo",
  entrega_expressa: "cargo",
  entrega_local: "cargo",
  recolha_mercadoria: "cargo",
  transporte_armas: "cargo",
  rota_costeira: "cargo",
  contrabando_tabaco: "cargo",
  frota_fantasma: "cargo",
  rota_alfandega: "cargo",
  carga_diplomatica: "cargo",
  rede_distribuicao: "cargo",
  porto_franco: "cargo",
  rota_internacional: "cargo",
  roubo_carga: "cargo",
  cobranca: "collect",
  lavagem: "collect",
  suborno_oficial: "collect",
  infiltracao: "stealth",
  sequestro_relampago: "stealth",
  hack: "tech",
  vigilancia_digital: "tech",
  ciberataque_bancario: "tech",
  phishing_bancario: "tech",
  clonagem_cartoes: "tech",
  hack_semaforos: "tech",
  fraude_criptomoedas: "tech",
  invasao_servidor: "tech",
  ciberespionagem: "tech",
  ataque_ddos: "tech",
  roubo_dados: "tech",
  sabotagem_industrial: "tech",
  guerra_cibernetica: "tech",
  emboscada_rival: "combat",
  guerra_territorio: "combat",
  ataque_territorio: "combat",
  assalto_blindado: "combat",
  operacao_vip: "vip",
  missao_especial: "vip",
};

const CATEGORY_CHOREO = {
  assalto: "heist",
  logistica: "cargo",
  tecnica: "tech",
  influencia: "collect",
  especial: "vip",
};

export function choreoKind(opp) {
  return TYPE_CHOREO[opp?.type_key] || CATEGORY_CHOREO[opp?.category] || "collect";
}

export const CHOREO_LABELS = {
  heist: "Assalto — a equipa entra no edifício",
  spread: "Dispersão pelas entradas e invasão",
  cargo: "Carga/descarga de mercadoria",
  collect: "Aproximação e negociação",
  stealth: "Infiltração discreta pelas traseiras",
  tech: "Intrusão técnica no alvo",
  combat: "Assalto tático com coberturas",
  vip: "Escolta em formação",
};

// Sacos de dinheiro no regresso a pé (se a missão teve sucesso).
const LOOT_ON_EXIT = { heist: true, spread: true, collect: true };

// ---------- Construção da coreografia ----------
// park: ponto onde o veículo estaciona (fim útil da rota OSRM)
// opsCount: nº de operacionais visíveis (membros reais, máx. 6)
export function buildChoreography(mission, park, opsCount) {
  const arrive = Date.parse(mission.arrive_at) / 1000;
  const finish = Date.parse(mission.finish_at) / 1000;
  const W = Math.max(4, finish - arrive);
  const target = { lat: mission.target.lat, lng: mission.target.lng };
  const kind = choreoKind(mission.opportunity);
  const rng = mulberry32(hashStr(String(mission.id || "m")));
  const n = clamp(opsCount || 1, 1, 6);
  const approach = bearingRad(park, target); // rumo park -> alvo
  const street = approach + Math.PI; // lado da rua (de onde a equipa chega)
  const dPT = Math.max(6, distMeters(park, target));

  // Estações (posição de ação de cada operacional) por arquetipo.
  const stations = [];
  const spreadAngles = (base, totalDeg, count) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const f = count > 1 ? i / (count - 1) - 0.5 : 0;
      out.push(base + (f * totalDeg * Math.PI) / 180);
    }
    return out;
  };
  if (kind === "heist") {
    // porta virada para a rua; vigia (último op) fica mais afastado
    const angles = spreadAngles(street, 46, n);
    for (let i = 0; i < n; i++) stations.push(ringPoint(target, angles[i], i === n - 1 && n >= 2 ? 7.5 : 4));
  } else if (kind === "spread") {
    for (let i = 0; i < n; i++) stations.push(ringPoint(target, street + (i * 2 * Math.PI) / n, 12));
  } else if (kind === "cargo") {
    const angles = spreadAngles(street, 40, n);
    for (let i = 0; i < n; i++) stations.push(ringPoint(target, angles[i], 2.5));
  } else if (kind === "collect") {
    const angles = spreadAngles(street, 110, n);
    for (let i = 0; i < n; i++) stations.push(ringPoint(target, angles[i], 4));
  } else if (kind === "stealth") {
    const angles = spreadAngles(approach, 40, n); // traseiras = lado oposto à rua
    for (let i = 0; i < n; i++) stations.push(ringPoint(target, angles[i], 5));
  } else if (kind === "tech") {
    stations.push(ringPoint(target, street, 1.5)); // o hacker
    const angles = spreadAngles(approach, 120, Math.max(1, n - 1));
    for (let i = 1; i < n; i++) stations.push(ringPoint(park, angles[i - 1], 6));
  } else if (kind === "combat") {
    const angles = spreadAngles(street, 140, n);
    for (let i = 0; i < n; i++) stations.push(ringPoint(target, angles[i], 10));
  } else {
    // vip — diamante/círculo à volta do ponto
    for (let i = 0; i < n; i++) stations.push(ringPoint(target, (i * 2 * Math.PI) / n, 6));
  }

  const spawnStagger = clamp(W * 0.02, 0.25, 0.7);
  const boardStagger = 0.25;
  const ops = [];
  for (let i = 0; i < n; i++) {
    const r1 = rng();
    const r2 = rng();
    const r3 = rng();
    const station = stations[i];
    // sai por uma das portas do veículo (lados alternados)
    const doorSide = i % 2 === 0 ? 1 : -1;
    const spawnPt = ringPoint(park, approach + (doorSide * Math.PI) / 2, 1.8);
    const bulge = (r1 - 0.5) * 2 * clamp(dPT * 0.18, 3, 14);
    const pIn = walkPath(spawnPt, station, bulge);
    const pOut = walkPath(station, spawnPt, -bulge * 0.7);
    const speed = 1.55 * (0.88 + 0.3 * r2) * (kind === "stealth" ? 0.62 : 1);
    const walkInDur = clamp(pIn.length / speed, 1.2, W * 0.24) + (kind === "stealth" ? i * 1.0 : 0);
    const walkOutDur = clamp(pOut.length / speed, 1.2, W * 0.24);
    const spawnAt = arrive + 0.4 + i * spawnStagger;
    const boardEnd = finish - 0.35 - (n - 1 - i) * boardStagger;
    const actionStart = spawnAt + 0.6 + walkInDur;
    let walkBackAt = boardEnd - 0.45 - walkOutDur;
    if (walkBackAt < actionStart) {
      // janela apertada: vão ao ponto e voltam logo
      walkBackAt = Math.max(spawnAt + 0.8, (spawnAt + boardEnd) / 2);
    }
    const action = Math.max(0, walkBackAt - actionStart);
    const op = {
      station, spawnPt, pIn, pOut, speed,
      spawnAt, walkInDur, actionStart, walkBackAt, walkOutDur, boardEnd,
      r1, r2, r3, action,
    };
    // parâmetros de programa por arquetipo
    if (kind === "heist" || kind === "spread") {
      op.enterDelay = clamp(action * 0.15, 0.6, 2.5);
      op.exitLead = clamp(action * 0.1, 0.5, 1.5);
      op.holdDur = clamp(action * 0.3, 0.8, 4); // só usado no spread
      op.convergeDur = clamp(action * 0.15, 0.8, 1.8);
      op.door = ringPoint(target, street, 2);
    }
    if (kind === "cargo") {
      op.period = clamp(2 * (pIn.length / speed) * 0.8 + 5, 8, 26) * (0.9 + 0.2 * r3);
      op.dwell = op.period * 0.14;
    }
    if (kind === "combat") {
      const perp = bearingRad(station, target) + Math.PI / 2;
      op.coverA = ringPoint(station, perp, 4);
      op.coverB = ringPoint(station, perp + Math.PI, 4);
      op.cycleHold = 2.4 + r3 * 2.2;
      op.dashDur = 0.7;
    }
    if (kind === "collect" || kind === "vip" || kind === "tech") {
      op.swayPeriod = 3.5 + r3 * 2.5;
      op.swayAmp = kind === "vip" ? 0.9 : 0.6;
      op.swayBearing = bearingRad(station, target) + Math.PI / 2;
    }
    if (kind === "heist" && n >= 2 && i === n - 1) {
      // vigia: patrulha curta paralela à fachada
      const perp = street + Math.PI / 2;
      op.paceA = ringPoint(station, perp, 3.5);
      op.paceB = ringPoint(station, perp + Math.PI, 3.5);
      op.pacePeriod = 5.5 + r3 * 2;
      op.isLookout = true;
    }
    if (kind === "tech" && i > 0) {
      const perp = approach + Math.PI / 2;
      op.paceA = ringPoint(station, perp, 2.5);
      op.paceB = ringPoint(station, perp + Math.PI, 2.5);
      op.pacePeriod = 6 + r3 * 2;
      op.isLookout = true;
    }
    ops.push(op);
  }

  // Continuidade do vaivém de carga: fração do trajeto no instante em que o
  // regresso começa — o operacional caminha daí para o veículo sem teleporte.
  if (kind === "cargo") {
    for (const op of ops) op.cargoF0 = shuttleFrac(op, op.walkBackAt);
  }

  return {
    kind,
    park,
    target,
    ops,
    lootOnExit: !!LOOT_ON_EXIT[kind],
    basePath: walkPath(park, target, clamp(dPT * 0.1, 2, 8)),
    deployStart: arrive,
    deployEnd: finish,
  };
}

// Fração [0..1] do trajeto pIn no vaivém de carga no instante nowSec.
// Ciclo: pausa no alvo -> leg para o veículo (carregado) -> pausa -> leg de volta.
function shuttleFrac(op, nowSec) {
  const tt = ((nowSec - op.actionStart) % op.period + op.period) % op.period;
  const legDur = (op.period - 2 * op.dwell) / 2;
  if (tt < op.dwell) return 1;
  if (tt < op.dwell + legDur) return 1 - smooth((tt - op.dwell) / legDur);
  if (tt < 2 * op.dwell + legDur) return 0;
  return smooth((tt - 2 * op.dwell - legDur) / legDur);
}

function shuttleCarrying(op, nowSec) {
  const tt = ((nowSec - op.actionStart) % op.period + op.period) % op.period;
  const legDur = (op.period - 2 * op.dwell) / 2;
  // carregado do alvo até pousar no veículo
  return tt >= op.dwell && tt < op.dwell + legDur;
}

// Movimento pendular entre A e B (triângulo suavizado).
function paceBetween(a, b, period, nowSec) {
  const t = ((nowSec % period) + period) % period / period;
  const f = t < 0.5 ? smooth(t * 2) : smooth(2 - t * 2);
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}

const lerpPt = (a, b, f) => ({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f });

// ---------- Programa de ação (durante [actionStart, walkBackAt]) ----------
function programEval(choreo, op, i, nowSec) {
  const kind = choreo.kind;
  const target = choreo.target;

  if (kind === "heist" || kind === "spread") {
    if (op.isLookout) {
      return { pos: paceBetween(op.paceA, op.paceB, op.pacePeriod, nowSec), ghost: 0, walking: true };
    }
    let enterAt = op.actionStart + op.enterDelay;
    let from = op.station;
    if (kind === "spread") {
      // pausa nas entradas, depois convergem para a porta
      const holdEnd = op.actionStart + op.holdDur;
      enterAt = holdEnd + op.convergeDur;
      if (nowSec < holdEnd) return { pos: op.station, ghost: 0, walking: false };
      if (nowSec < enterAt) {
        return { pos: lerpPt(op.station, op.door, smooth((nowSec - holdEnd) / op.convergeDur)), ghost: 0, walking: true };
      }
      from = op.door;
    }
    const exitAt = op.walkBackAt - op.exitLead;
    const fadeT = 0.5;
    if (nowSec < enterAt) return { pos: from, ghost: 0, walking: false };
    if (nowSec < enterAt + fadeT) {
      const f = (nowSec - enterAt) / fadeT;
      return { pos: lerpPt(from, target, f), ghost: f, walking: true };
    }
    if (nowSec < exitAt) return { pos: target, ghost: 1, walking: false }; // dentro do edifício
    const f = clamp((nowSec - exitAt) / fadeT, 0, 1);
    return { pos: lerpPt(target, op.station, f), ghost: 1 - f, walking: true };
  }

  if (kind === "cargo") {
    const f = shuttleFrac(op, nowSec);
    return { pos: pathAt(op.pIn, f), ghost: 0, walking: f > 0.02 && f < 0.98, carry: shuttleCarrying(op, nowSec) };
  }

  if (kind === "combat") {
    const cycle = op.cycleHold + op.dashDur;
    const k = Math.floor(Math.max(0, nowSec - op.actionStart) / cycle);
    const within = Math.max(0, nowSec - op.actionStart) % cycle;
    const from = k % 2 === 0 ? op.coverA : op.coverB;
    const to = k % 2 === 0 ? op.coverB : op.coverA;
    if (within < op.cycleHold) return { pos: from, ghost: 0, walking: false };
    return { pos: lerpPt(from, to, smooth((within - op.cycleHold) / op.dashDur)), ghost: 0, walking: true };
  }

  if (kind === "tech" && op.isLookout) {
    return { pos: paceBetween(op.paceA, op.paceB, op.pacePeriod, nowSec), ghost: 0, walking: true };
  }

  if (kind === "stealth") {
    return { pos: op.station, ghost: 0.45, walking: false };
  }

  // collect / vip / hacker no alvo — permanecem com um balanço subtil
  const sway = Math.sin((nowSec * 2 * Math.PI) / (op.swayPeriod || 4)) * (op.swayAmp || 0.6);
  return {
    pos: offsetM(op.station, Math.sin(op.swayBearing || 0) * sway, Math.cos(op.swayBearing || 0) * sway),
    ghost: 0,
    walking: false,
  };
}

// ---------- Estado por frame de um operacional ----------
// Devolve null quando está dentro do veículo; caso contrário
// { lat, lng, alpha, scale, carry, walking }.
export function opStateAt(choreo, i, nowSec, success) {
  const op = choreo.ops[i];
  if (!op || nowSec < op.spawnAt || nowSec > op.boardEnd) return null;

  // fades de entrada/saída do veículo
  const inRamp = clamp((nowSec - op.spawnAt) / 0.6, 0, 1);
  const outRamp = clamp((op.boardEnd - nowSec) / 0.5, 0, 1);
  let alpha = Math.min(inRamp, outRamp);
  let scale = 0.45 + 0.55 * Math.min(inRamp, outRamp);
  if (alpha <= 0.01) return null;

  const stealthGhost = choreo.kind === "stealth" ? 0.55 : 1;
  let pos;
  let carry = false;
  let walking = false;

  const walkStart = op.spawnAt + 0.6;
  const walkInEnd = walkStart + op.walkInDur;

  if (nowSec < walkInEnd) {
    const t = clamp((nowSec - walkStart) / op.walkInDur, 0, 1);
    const f = choreo.kind === "stealth" ? steppedEase(t) : smooth(t);
    pos = pathAt(op.pIn, f);
    walking = t > 0 && t < 1;
    alpha *= stealthGhost;
  } else if (nowSec < op.walkBackAt) {
    const ev = programEval(choreo, op, i, nowSec);
    pos = ev.pos;
    walking = !!ev.walking;
    carry = !!ev.carry;
    alpha *= (1 - (ev.ghost || 0)) * stealthGhost;
    if (ev.ghost >= 1) return null; // dentro do edifício — invisível
  } else {
    const t = clamp((nowSec - op.walkBackAt) / op.walkOutDur, 0, 1);
    if (choreo.kind === "cargo") {
      pos = pathAt(op.pIn, (op.cargoF0 ?? 1) * (1 - smooth(t)));
    } else {
      pos = pathAt(op.pOut, smooth(t));
    }
    walking = t < 1;
    carry = !!success && choreo.lootOnExit;
    alpha *= stealthGhost;
  }

  if (!pos) return null;
  return { lat: pos.lat, lng: pos.lng, alpha, scale, carry, walking };
}
