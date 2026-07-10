// ============================================================================
// choreo.js v2 — Motor de estados da simulação visual de missões
// ============================================================================
//
// Simulação determinística 100% no cliente: tudo é derivado dos timestamps do
// motor (depart_at/arrive_at/finish_at/return_at) + seed do id da missão. A
// cena é reproduzível após refresh, mantém-se sincronizada com o ETA real e
// não precisa de qualquer estado adicional no servidor.
//
// Máquina de estados por missão:
//   travel → arrival → parking → disembark → approach → execute → withdraw
//   → board → return → done
//
// Arquitetura modular: cada arquetipo de missão é uma entrada no registo
// ARCHETYPES (papéis, estações, programas de execução, rótulo). Os programas
// são compostos a partir de uma biblioteca partilhada (pace/stand/inside/
// shuttle/cover/creep/orbit) — adicionar um tipo novo = adicionar uma entrada.
//
// Performance: a avaliação por frame (opStateAt / vehiclePoseAt) é matemática
// pura O(1) por entidade — escala para dezenas de missões e centenas de
// operacionais sem custo relevante.

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
const lerpPt = (a, b, f) => ({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f });

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

// Perfil de velocidade trapezoidal — aceleração suave, cruzeiro, travagem.
// t∈[0,1] tempo normalizado; a = fração de arranque; b = fração de travagem.
// Devolve a fração de DISTÂNCIA percorrida (integral do perfil, normalizado).
function trapezoidEase(t, a, b) {
  t = clamp(t, 0, 1);
  a = clamp(a, 0.001, 0.49);
  b = clamp(b, 0.001, 0.49);
  const norm = 1 - a / 2 - b / 2;
  let d;
  if (t < a) d = (t * t) / (2 * a);
  else if (t <= 1 - b) d = a / 2 + (t - a);
  else {
    const u = 1 - t;
    d = a / 2 + (1 - b - a) + b / 2 - (u * u) / (2 * b);
  }
  return clamp(d / norm, 0, 1);
}

// Rumo (graus, 0 = norte, sentido horário) na fração `frac` de uma rota,
// olhando na direção do deslocamento (dirSign +1 avança, -1 recua).
export function routeBearingDeg(latlngs, cum, frac, dirSign) {
  const eps = 0.004;
  const a = pointOnRoute(latlngs, cum, frac);
  const b = pointOnRoute(latlngs, cum, clamp(frac + dirSign * eps, 0, 1));
  if (!a || !b || (a.lat === b.lat && a.lng === b.lng)) return null;
  const dLng = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) * Math.PI) / 360);
  const dLat = b.lat - a.lat;
  return (Math.atan2(dLng, dLat) * 180) / Math.PI;
}

// ============================================================================
// Mapeamento tipo de oportunidade → arquetipo
// ============================================================================
// heist   — entram no edifício (vigia à porta), saem com o saque (joalharia…)
// spread  — dispersam pelas entradas, convergem e invadem (banco…)
// cargo   — vaivém contínuo veículo<->alvo a carregar/descarregar
// collect — semicírculo a "negociar" frente ao alvo (cobrança)
// stealth — avanço em passos, semi-transparentes, pelas traseiras (infiltração)
// tech    — 1 operacional planta o dispositivo, os restantes vigiam
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

// Tipos de carga em que o sentido "carregado" é veículo → alvo (descarga /
// entrega); nos restantes é alvo → veículo (recolha / contrabando).
const CARGO_OUTBOUND = new Set([
  "transporte", "entrega_expressa", "entrega_local", "transporte_armas",
  "carga_diplomatica", "rede_distribuicao",
]);

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

// Etiquetas pt-PT dos estados da máquina de estados.
export const MISSION_STATE_LABELS = {
  travel: "Deslocação",
  arrival: "Chegada",
  parking: "Estacionamento",
  disembark: "Desembarque",
  approach: "Aproximação",
  execute: "Execução",
  withdraw: "Retirada",
  board: "Embarque",
  return: "Regresso",
  done: "Concluída",
};

// Sacos de dinheiro no regresso a pé (se a missão teve sucesso).
const LOOT_ON_EXIT = { heist: true, spread: true, collect: true };

// ============================================================================
// Veículo — timings, estacionamento e pose por frame
// ============================================================================

export function vehicleTimings(mission) {
  const depart = Date.parse(mission.depart_at) / 1000;
  const arrive = Date.parse(mission.arrive_at) / 1000;
  const finish = Date.parse(mission.finish_at) / 1000;
  const ret = Date.parse(mission.return_at) / 1000;
  const Tt = Math.max(1, arrive - depart);
  const Tr = Math.max(1, ret - finish);
  return {
    depart, arrive, finish, ret, Tt, Tr,
    accelDur: clamp(Tt * 0.10, 1.2, 5),   // arranque suave
    parkDur: clamp(Tt * 0.16, 2.2, 7),    // travagem + manobra de encosto
    departDur: clamp(Tr * 0.12, 1.5, 6),  // sai da berma + acelera
    brakeDur: clamp(Tr * 0.10, 1.2, 5),   // travagem na base
  };
}

// Escolhe o local de estacionamento: recuado 25–50m do fim da rota (variação
// por missão), encostado à berma (offset perpendicular à via) e NUNCA sobre o
// alvo. Devolve também o rumo da via nesse ponto (o carro fica orientado no
// sentido em que chegou).
export function buildParking(mission, routeInfo) {
  const rng = mulberry32(hashStr(String(mission.id || "m") + ":prk"));
  const latlngs = routeInfo.latlngs;
  const cum = buildCumulative(latlngs);
  const total = cum[cum.length - 1] || 0;
  const target = { lat: mission.target.lat, lng: mission.target.lng };

  const back = Math.min(25 + rng() * 25, Math.max(12, total * 0.25));
  const parkFrac = total > 0 ? clamp((total - back) / total, 0, 1) : 1;
  let anchor = total > 0 ? pointOnRoute(latlngs, cum, parkFrac) : null;
  let streetBearingRad = null;
  if (anchor && total > 0) {
    const before = pointOnRoute(latlngs, cum, Math.max(0, parkFrac - 0.02));
    if (before && (before.lat !== anchor.lat || before.lng !== anchor.lng)) {
      streetBearingRad = bearingRad(before, anchor);
    }
  }
  if (!anchor) {
    // Rota degenerada: ancora ~30m antes do alvo na direção da origem.
    const o = { lat: mission.origin.lat, lng: mission.origin.lng };
    const d = Math.max(1e-6, distMeters(o, target));
    anchor = lerpPt(target, o, Math.min(30, d * 0.5) / d);
  }
  if (streetBearingRad == null || !isFinite(streetBearingRad)) {
    streetBearingRad = bearingRad(anchor, target);
    if (!isFinite(streetBearingRad)) streetBearingRad = rng() * 2 * Math.PI;
  }

  // Encosto à berma — lado escolhido por missão, 2.6–3.8m da faixa.
  const curbSide = rng() < 0.5 ? 1 : -1;
  const curbDist = 2.6 + rng() * 1.2;
  let park = ringPoint(anchor, streetBearingRad + (curbSide * Math.PI) / 2, curbDist);
  if (distMeters(park, target) < 14) {
    // Garantia dura: nunca estacionar em cima do alvo.
    const away = bearingRad(target, anchor);
    park = ringPoint(target, isFinite(away) ? away : rng() * 2 * Math.PI, 16);
  }

  return { latlngs, cum, total, parkFrac, anchor, park, streetBearingRad, curbSide, fallback: !!routeInfo.fallback };
}

// Pose do veículo num instante — posição, rumo (graus) e estado.
// Aceleração/desaceleração via perfil trapezoidal; manobra de encosto à berma
// nos últimos segundos da viagem; arranque da berma no início do regresso.
export function vehiclePoseAt(mission, parking, nowMs) {
  const vt = vehicleTimings(mission);
  const s = nowMs / 1000;
  const { latlngs, cum, parkFrac, anchor, park, streetBearingRad } = parking;
  const streetDeg = (streetBearingRad * 180) / Math.PI;

  if (s >= vt.ret) {
    return { lat: mission.origin.lat, lng: mission.origin.lng, phase: "done", state: "done", frac: 0, progress: 1, bearing: null, moving: false };
  }

  if (s < vt.arrive) {
    const T = vt.Tt;
    const t = clamp((s - vt.depart) / T, 0, 1);
    const a = vt.accelDur / T;
    const b = vt.parkDur / T;
    const f = trapezoidEase(t, a, b) * parkFrac;
    const base = pointOnRoute(latlngs, cum, f) || anchor;
    // Encosto: desliza lateralmente para a berma durante a travagem final.
    const lateralT = clamp((s - (vt.arrive - vt.parkDur)) / vt.parkDur, 0, 1);
    const lf = smooth(lateralT);
    const pos = {
      lat: base.lat + (park.lat - anchor.lat) * lf,
      lng: base.lng + (park.lng - anchor.lng) * lf,
    };
    const bearing = routeBearingDeg(latlngs, cum, f, 1) ?? streetDeg;
    const state = lateralT <= 0 ? "travel" : lateralT < 0.55 ? "arrival" : "parking";
    return { ...pos, phase: "en_route", state, frac: f, progress: t, bearing, moving: true };
  }

  if (s < vt.finish) {
    return { lat: park.lat, lng: park.lng, phase: "operating", state: "execute", frac: parkFrac, progress: 1, bearing: streetDeg, moving: false };
  }

  // Regresso — sai da berma, acelera, trava na base.
  const T = vt.Tr;
  const t = clamp((s - vt.finish) / T, 0, 1);
  const a = vt.departDur / T;
  const b = vt.brakeDur / T;
  const f = parkFrac * (1 - trapezoidEase(t, a, b));
  const base = pointOnRoute(latlngs, cum, f) || anchor;
  const lf = 1 - smooth(clamp((s - vt.finish) / vt.departDur, 0, 1));
  const pos = {
    lat: base.lat + (park.lat - anchor.lat) * lf,
    lng: base.lng + (park.lng - anchor.lng) * lf,
  };
  const bearing = routeBearingDeg(latlngs, cum, f, -1) ?? (streetDeg + 180) % 360;
  return { ...pos, phase: "returning", state: "return", frac: f, progress: t, bearing, moving: true };
}

// ============================================================================
// Registo de arquetipos — papéis, estações e parâmetros por tipo de missão
// ============================================================================
// Papéis:
//   entry      — aproxima-se / entra no objetivo
//   door       — cobertura da entrada (patrulha a fachada)
//   overwatch  — vigilância (parado, varre a zona, reposiciona-se)
//   vehicle    — proteção do veículo (patrulha junto ao carro)
//   retreat    — cobertura da retirada (a meio caminho carro↔alvo)
//   carrier    — vaivém de carga veículo↔alvo
//   hacker     — no dispositivo, junto ao alvo
//   negotiator — semicírculo frente ao alvo
//   ghostop    — infiltração (semi-transparente, avanços curtos)
//   assault    — corridas entre coberturas
//   escort     — escolta em anel com deriva lenta

const spreadAngles = (base, totalDeg, count) => {
  const out = [];
  for (let i = 0; i < count; i++) {
    const f = count > 1 ? i / (count - 1) - 0.5 : 0;
    out.push(base + (f * totalDeg * Math.PI) / 180);
  }
  return out;
};

// Substitui papéis "primários" por papéis de apoio conforme o tamanho da
// equipa — as posições variam por missão via jitter seeded nas estações.
function withSupportRoles(primary, n, extras) {
  const roles = new Array(n).fill(primary);
  for (const { min, at, role } of extras) {
    if (n >= min) roles[at % n] = role;
  }
  return roles;
}

const ARCHETYPES = {
  heist: {
    speed: 1.55,
    roles: (n) => withSupportRoles("entry", n, [
      { min: 2, at: 1, role: "door" },
      { min: 4, at: 3, role: "vehicle" },
      { min: 5, at: 2, role: "retreat" },
      { min: 6, at: 5, role: "overwatch" },
    ]),
    primaryFan: { spreadDeg: 46, radius: 4 },
  },
  spread: {
    speed: 1.6,
    roles: (n) => withSupportRoles("entry", n, [
      { min: 3, at: 2, role: "overwatch" },
      { min: 5, at: 4, role: "vehicle" },
    ]),
    primaryFan: { spreadDeg: 360, radius: 12, fullCircle: true },
    invade: true, // entram todos pela porta após o cerco
  },
  cargo: {
    speed: 1.5,
    roles: (n) => withSupportRoles("carrier", n, [
      { min: 3, at: 2, role: "vehicle" },
      { min: 5, at: 4, role: "overwatch" },
    ]),
    primaryFan: { spreadDeg: 40, radius: 2.5 },
  },
  collect: {
    speed: 1.5,
    roles: (n) => withSupportRoles("negotiator", n, [
      { min: 3, at: 2, role: "vehicle" },
      { min: 4, at: 3, role: "overwatch" },
    ]),
    primaryFan: { spreadDeg: 110, radius: 4 },
  },
  stealth: {
    speed: 0.95,
    ghost: 0.55,
    roles: (n) => withSupportRoles("ghostop", n, [
      { min: 4, at: 3, role: "retreat" },
    ]),
    primaryFan: { spreadDeg: 40, radius: 5, rear: true },
  },
  tech: {
    speed: 1.5,
    roles: (n) => {
      const roles = ["hacker"];
      for (let i = 1; i < n; i++) roles.push(i % 2 === 1 ? "vehicle" : "overwatch");
      return roles;
    },
    primaryFan: { spreadDeg: 0, radius: 1.5 },
  },
  combat: {
    speed: 1.8,
    roles: (n) => withSupportRoles("assault", n, [
      { min: 5, at: 4, role: "retreat" },
    ]),
    primaryFan: { spreadDeg: 140, radius: 10 },
  },
  vip: {
    speed: 1.45,
    roles: (n) => withSupportRoles("escort", n, [
      { min: 5, at: 4, role: "vehicle" },
    ]),
    primaryFan: { spreadDeg: 360, radius: 6, fullCircle: true },
  },
};

// Estação de um papel de apoio (partilhada entre arquetipos).
function supportStation(role, ctx, rng) {
  const { target, park, approach, street } = ctx;
  if (role === "vehicle") {
    return ringPoint(park, approach + (rng() - 0.5) * 2.0, 2.6 + rng() * 1.4);
  }
  if (role === "retreat") {
    const mid = lerpPt(park, target, 0.38 + rng() * 0.2);
    const perp = approach + Math.PI / 2;
    return ringPoint(mid, perp, (rng() - 0.5) * 7);
  }
  if (role === "overwatch") {
    const side = rng() < 0.5 ? 1 : -1;
    return ringPoint(target, street + side * (1.0 + rng() * 0.8), 9 + rng() * 4);
  }
  if (role === "door") {
    return ringPoint(target, street + (rng() - 0.5) * 0.4, 6.5 + rng() * 2);
  }
  return ringPoint(target, street, 5);
}

// ============================================================================
// Construção da coreografia (uma vez por missão)
// ============================================================================
// parking: resultado de buildParking; opsCount: nº de operacionais (máx. 6)
export function buildChoreography(mission, parking, opsCount) {
  const arrive = Date.parse(mission.arrive_at) / 1000;
  const finish = Date.parse(mission.finish_at) / 1000;
  const W = Math.max(4, finish - arrive);
  const target = { lat: mission.target.lat, lng: mission.target.lng };
  const park = parking.park || parking;
  const kind = choreoKind(mission.opportunity);
  const arch = ARCHETYPES[kind] || ARCHETYPES.collect;
  const rng = mulberry32(hashStr(String(mission.id || "m")));
  const n = clamp(opsCount || 1, 1, 6);

  const approach = bearingRad(park, target); // rumo carro -> alvo
  const street = approach + Math.PI;         // lado da rua (de onde chegam)
  const dPT = Math.max(6, distMeters(park, target));

  // ----- Papéis e estações (leque rodado + jitter por missão) -----
  const roles = arch.roles(n);
  const fan = arch.primaryFan;
  const fanRot = (rng() - 0.5) * (fan.fullCircle ? 0.9 : 0.6); // rotação global do leque
  const primaryIdx = [];
  for (let i = 0; i < n; i++) if (roles[i] !== "vehicle" && roles[i] !== "retreat" && roles[i] !== "overwatch" && roles[i] !== "door") primaryIdx.push(i);

  const baseBearing = fan.rear ? approach : street;
  const angles = fan.fullCircle
    ? primaryIdx.map((_, k) => baseBearing + fanRot + (k * 2 * Math.PI) / Math.max(1, primaryIdx.length))
    : spreadAngles(baseBearing + fanRot, fan.spreadDeg, primaryIdx.length);

  const stations = new Array(n);
  let pk = 0;
  for (let i = 0; i < n; i++) {
    const role = roles[i];
    if (role === "vehicle" || role === "retreat" || role === "overwatch" || role === "door") {
      stations[i] = supportStation(role, { target, park, approach, street }, rng);
    } else {
      const ang = angles[pk] + (rng() - 0.5) * 0.14; // jitter por estação
      const rad = fan.radius * (0.85 + rng() * 0.3);
      stations[i] = ringPoint(target, ang, rad);
      pk++;
    }
  }

  // ----- Timings partilhados (variação seeded por missão) -----
  const exitStagger = 0.45 + rng() * 0.4;   // intervalo entre saídas do carro
  const boardStagger = 0.4 + rng() * 0.5;   // intervalo entre embarques
  const bulgeBase = (rng() - 0.5) * 2 * clamp(dPT * 0.18, 3, 14); // curva partilhada da formação
  const boardOrder = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {         // shuffle seeded — regressam por ordem diferente
    const j = Math.floor(rng() * (i + 1));
    [boardOrder[i], boardOrder[j]] = [boardOrder[j], boardOrder[i]];
  }
  const cargoOutbound = CARGO_OUTBOUND.has(mission.opportunity?.type_key);

  const ops = [];
  for (let i = 0; i < n; i++) {
    const r1 = rng();
    const r2 = rng();
    const r3 = rng();
    const role = roles[i];
    const station = stations[i];

    // Sai por uma das portas (lados alternados) e contorna para o passeio.
    const doorSide = i % 2 === 0 ? 1 : -1;
    const spawnPt = ringPoint(park, approach + (doorSide * Math.PI) / 2, 1.8);

    // Formação: curva coerente (mesma barriga base) + variação individual +
    // afastamento lateral em leque — nunca caminham em linha única.
    const bulge = bulgeBase * (0.75 + 0.5 * r1) + (r1 - 0.5) * 2.5;
    const pIn = walkPath(spawnPt, station, bulge);
    const pOut = walkPath(station, spawnPt, -bulge * 0.7);
    const latAmp = clamp((i - (n - 1) / 2) * (1.0 + 0.8 * r2), -3.5, 3.5);
    const latPerp = bearingRad(spawnPt, station) + Math.PI / 2;

    const speed = arch.speed * (0.88 + 0.3 * r2);
    const walkInDur = clamp(pIn.length / speed, 1.2, W * 0.26) + (kind === "stealth" ? i * 1.0 : 0);
    const walkOutDur = clamp(pOut.length / speed, 1.2, W * 0.24);

    const spawnAt = arrive + 0.5 + i * exitStagger + (r3 - 0.5) * 0.2;
    const boardEnd = finish - 0.4 - boardOrder[i] * boardStagger;
    const actionStart = spawnAt + 0.6 + walkInDur;
    let walkBackAt = boardEnd - 0.5 - walkOutDur - r1 * 1.2;
    if (walkBackAt < actionStart) {
      // janela apertada: vão ao ponto e voltam logo
      walkBackAt = Math.max(spawnAt + 0.8, (spawnAt + boardEnd) / 2);
    }
    const action = Math.max(0, walkBackAt - actionStart);

    const op = {
      role, station, spawnPt, pIn, pOut, speed,
      spawnAt, walkInDur, actionStart, walkBackAt, walkOutDur, boardEnd,
      latAmp, latPerp, r1, r2, r3, action,
      // deriva idle universal (duas frequências — parece respiração/passos curtos)
      dw1: (2 * Math.PI) / (4.2 + r2 * 3.2), dp1: r1 * 6.28,
      dw2: (2 * Math.PI) / (6.5 + r3 * 3.5), dp2: r2 * 6.28,
    };

    // ----- Parâmetros de programa por papel/arquetipo -----
    if (role === "entry") {
      op.enterDelay = clamp(action * 0.15, 0.6, 2.5);
      op.exitLead = clamp(action * 0.1, 0.5, 1.5);
      op.holdDur = clamp(action * 0.3, 0.8, 4);      // usado no spread (cerco)
      op.convergeDur = clamp(action * 0.15, 0.8, 1.8);
      op.door = ringPoint(target, street, 2);
      op.invade = !!arch.invade;
      op.target = target;
    }
    if (role === "carrier") {
      op.period = clamp(2 * (pIn.length / speed) * 0.8 + 5, 8, 26) * (0.9 + 0.2 * r3);
      op.dwell = op.period * 0.14;
      op.cargoOutbound = cargoOutbound;
    }
    if (role === "assault") {
      const perp = bearingRad(station, target) + Math.PI / 2;
      op.coverA = ringPoint(station, perp, 4);
      op.coverB = ringPoint(station, perp + Math.PI, 4);
      op.cycleHold = 2.4 + r3 * 2.2;
      op.dashDur = 0.7;
    }
    if (role === "negotiator" || role === "escort" || role === "hacker") {
      op.swayPeriod = 3.5 + r3 * 2.5;
      op.swayAmp = role === "escort" ? 0.9 : role === "hacker" ? 0.35 : 0.6;
      op.swayBearing = bearingRad(station, target) + Math.PI / 2;
      if (role === "escort") {
        op.orbitCenter = target;
        op.orbitBearing = bearingRad(target, station);
        op.orbitRadius = Math.max(2, distMeters(target, station));
        op.orbitDrift = (2 * Math.PI) / (26 + r3 * 18); // deriva lenta do anel
        op.orbitDir = r1 < 0.5 ? 1 : -1;
      }
    }
    if (role === "door" || role === "vehicle") {
      // patrulha pendular — fachada (door) ou a flanquear o carro (vehicle)
      const axis = role === "door" ? street + Math.PI / 2 : (parking.streetBearingRad ?? approach);
      const span = role === "door" ? 3.5 : 2.8;
      op.paceA = ringPoint(station, axis, span);
      op.paceB = ringPoint(station, axis + Math.PI, span);
      op.pacePeriod = 5.5 + r3 * 3;
    }
    if (role === "overwatch" || role === "retreat" || role === "ghostop") {
      // reposicionamento discreto entre dois pontos próximos
      const shiftDir = role === "ghostop"
        ? bearingRad(station, target)                 // infiltração: aproxima-se
        : r2 * 2 * Math.PI;
      op.stationB = ringPoint(station, shiftDir, role === "ghostop" ? 1.6 + r3 * 1.2 : 1.5 + r3 * 1.8);
      op.msPeriod = 8 + r3 * 7;
    }

    ops.push(op);
  }

  // Continuidade do vaivém de carga: fração do trajeto no instante em que o
  // regresso começa — o operacional caminha daí para o veículo sem teleporte.
  for (const op of ops) {
    if (op.role === "carrier") op.cargoF0 = shuttleFrac(op, op.walkBackAt);
  }

  // ----- Agregados para a máquina de estados (etiquetas de fase) -----
  let tDisembarkEnd = arrive, tApproachEnd = arrive, tWithdrawStart = finish, tBoardStart = finish;
  for (const op of ops) {
    tDisembarkEnd = Math.max(tDisembarkEnd, op.spawnAt + 0.6);
    tApproachEnd = Math.max(tApproachEnd, op.actionStart);
    tWithdrawStart = Math.min(tWithdrawStart, op.walkBackAt);
    tBoardStart = Math.min(tBoardStart, op.walkBackAt + op.walkOutDur);
  }

  return {
    kind,
    park,
    target,
    ops,
    ghost: arch.ghost || 0,
    lootOnExit: !!LOOT_ON_EXIT[kind],
    basePath: walkPath(park, target, clamp(dPT * 0.1, 2, 8)),
    deployStart: arrive,
    deployEnd: finish,
    tDisembarkEnd, tApproachEnd, tWithdrawStart, tBoardStart,
  };
}

// ============================================================================
// Máquina de estados — estado nomeado num instante (para tooltips/HUD)
// ============================================================================
export function missionStateAt(mission, choreo, nowMs) {
  const vt = vehicleTimings(mission);
  const s = nowMs / 1000;
  let state;
  if (s >= vt.ret) state = "done";
  else if (s >= vt.finish) state = "return";
  else if (s >= vt.arrive) {
    if (!choreo) state = "execute";
    else if (s < choreo.tDisembarkEnd) state = "disembark";
    else if (s < choreo.tApproachEnd) state = "approach";
    else if (s >= choreo.tBoardStart) state = "board";
    else if (s >= choreo.tWithdrawStart) state = "withdraw";
    else state = "execute";
  } else if (s >= vt.arrive - vt.parkDur * 0.45) state = "parking";
  else if (s >= vt.arrive - vt.parkDur) state = "arrival";
  else state = "travel";
  return { state, label: MISSION_STATE_LABELS[state] };
}

// ============================================================================
// Biblioteca de programas de execução (avaliados por frame, O(1))
// ============================================================================

// Fração [0..1] do trajeto pIn no vaivém de carga no instante nowSec.
// Ciclo: pausa no alvo -> leg para o veículo -> pausa -> leg de volta.
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
  const towardVehicle = tt >= op.dwell && tt < op.dwell + legDur;
  const towardTarget = tt >= 2 * op.dwell + legDur;
  // sentido "carregado" depende do tipo (entrega vs recolha)
  return op.cargoOutbound ? towardTarget : towardVehicle;
}

// Movimento pendular entre A e B (triângulo suavizado).
function paceBetween(a, b, period, nowSec) {
  const t = ((nowSec % period) + period) % period / period;
  const f = t < 0.5 ? smooth(t * 2) : smooth(2 - t * 2);
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}

// Reposicionamento discreto: alterna entre station e stationB a cada período,
// com uma transição curta a caminhar.
function microShift(op, nowSec) {
  const t = Math.max(0, nowSec - op.actionStart);
  const k = Math.floor(t / op.msPeriod);
  const within = t - k * op.msPeriod;
  const from = k % 2 === 0 ? op.station : op.stationB;
  const to = k % 2 === 0 ? op.stationB : op.station;
  const mv = 1.4;
  if (within < mv) return { pos: lerpPt(from, to, smooth(within / mv)), walking: true };
  return { pos: to, walking: false };
}

// Programa de ação por papel (durante [actionStart, walkBackAt]).
function programEval(choreo, op, nowSec) {
  const target = choreo.target;
  const role = op.role;

  if (role === "entry") {
    let enterAt = op.actionStart + op.enterDelay;
    let from = op.station;
    if (op.invade) {
      // cerco nas entradas, depois convergem para a porta e invadem
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

  if (role === "carrier") {
    const f = shuttleFrac(op, nowSec);
    return { pos: pathAt(op.pIn, f), ghost: 0, walking: f > 0.02 && f < 0.98, carry: shuttleCarrying(op, nowSec) };
  }

  if (role === "assault") {
    const cycle = op.cycleHold + op.dashDur;
    const k = Math.floor(Math.max(0, nowSec - op.actionStart) / cycle);
    const within = Math.max(0, nowSec - op.actionStart) % cycle;
    const from = k % 2 === 0 ? op.coverA : op.coverB;
    const to = k % 2 === 0 ? op.coverB : op.coverA;
    if (within < op.cycleHold) return { pos: from, ghost: 0, walking: false };
    return { pos: lerpPt(from, to, smooth((within - op.cycleHold) / op.dashDur)), ghost: 0, walking: true };
  }

  if (role === "door" || role === "vehicle") {
    return { pos: paceBetween(op.paceA, op.paceB, op.pacePeriod, nowSec), ghost: 0, walking: true };
  }

  if (role === "overwatch" || role === "retreat" || role === "ghostop") {
    const ms = microShift(op, nowSec);
    return { pos: ms.pos, ghost: 0, walking: ms.walking };
  }

  if (role === "escort") {
    // anel com deriva angular lenta à volta do alvo
    const ang = op.orbitBearing + op.orbitDir * Math.sin(nowSec * op.orbitDrift) * 0.35;
    const pos = ringPoint(op.orbitCenter, ang, op.orbitRadius);
    return { pos, ghost: 0, walking: false };
  }

  // negotiator / hacker — permanecem com um balanço subtil virado ao alvo
  const sway = Math.sin((nowSec * 2 * Math.PI) / (op.swayPeriod || 4)) * (op.swayAmp || 0.6);
  return {
    pos: offsetM(op.station, Math.sin(op.swayBearing || 0) * sway, Math.cos(op.swayBearing || 0) * sway),
    ghost: 0,
    walking: false,
  };
}

// Deriva idle universal — nenhum operacional fica imóvel como uma estátua.
function idleDrift(op, nowSec, amp = 0.55) {
  return {
    e: Math.sin(nowSec * op.dw1 + op.dp1) * amp,
    n: Math.cos(nowSec * op.dw2 + op.dp2) * amp * 0.8,
  };
}

// Offset de formação — afastamento lateral em leque durante as caminhadas,
// desvanece nas pontas (saem do carro juntos, chegam à estação exata).
function formationOffset(op, pos, f, ampMult = 1) {
  const off = op.latAmp * ampMult * Math.sin(Math.PI * clamp(f, 0, 1));
  if (off === 0) return pos;
  return offsetM(pos, Math.sin(op.latPerp) * off, Math.cos(op.latPerp) * off);
}

// ============================================================================
// Estado por frame de um operacional
// ============================================================================
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

  const stealthGhost = choreo.ghost ? 1 - choreo.ghost * (op.role === "ghostop" ? 0.82 : 0.5) : 1;
  let pos;
  let carry = false;
  let walking = false;

  const walkStart = op.spawnAt + 0.6;
  const walkInEnd = walkStart + op.walkInDur;

  if (nowSec < walkInEnd) {
    // ----- Aproximação em formação -----
    const t = clamp((nowSec - walkStart) / op.walkInDur, 0, 1);
    const f = op.role === "ghostop" ? steppedEase(t) : smooth(t);
    pos = formationOffset(op, pathAt(op.pIn, f), f);
    walking = t > 0 && t < 1;
    alpha *= stealthGhost;
  } else if (nowSec < op.walkBackAt) {
    // ----- Execução (programa por papel) -----
    const ev = programEval(choreo, op, nowSec);
    pos = ev.pos;
    walking = !!ev.walking;
    carry = !!ev.carry;
    alpha *= (1 - (ev.ghost || 0)) * stealthGhost;
    if (ev.ghost >= 1) return null; // dentro do edifício — invisível
    if (!walking && pos) {
      const d = idleDrift(op, nowSec);
      pos = offsetM(pos, d.e, d.n);
    }
  } else {
    // ----- Retirada para o veículo -----
    const t = clamp((nowSec - op.walkBackAt) / op.walkOutDur, 0, 1);
    if (op.role === "carrier") {
      pos = pathAt(op.pIn, (op.cargoF0 ?? 1) * (1 - smooth(t)));
    } else {
      pos = formationOffset(op, pathAt(op.pOut, smooth(t)), t, 0.5);
    }
    walking = t < 1;
    carry = !!success && choreo.lootOnExit;
    alpha *= stealthGhost;
  }

  if (!pos) return null;
  return { lat: pos.lat, lng: pos.lng, alpha, scale, carry, walking };
}
