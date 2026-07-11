// ============================================================================
// choreo.js v3 — Motor de estados da simulação visual de missões
// ============================================================================
//
// Simulação determinística 100% no cliente: tudo é derivado dos timestamps do
// motor (depart_at/arrive_at/finish_at/return_at) + seed do id da missão. A
// cena é reproduzível após refresh/mudança de página, mantém-se sincronizada
// com o ETA real e não precisa de qualquer estado adicional no servidor.
//
// Máquina de estados por missão (v3):
//   travel → arrival → parking → (repark) → disembark → recon → approach
//   → execute → withdraw → regroup → board → confirm → return → done
//
// Novidades v3 (QI de coreografia):
//   • Papéis por especialização real dos operacionais (hacker→acessos
//     técnicos, negociador→alvo, logística→carga/veículo, motorista pode
//     ficar ao volante) e líder de facto (patente mais alta).
//   • Sequenciamento tático: batedor verifica o perímetro primeiro; o líder
//     dá a ordem de avanço; os apoios avançam antes dos primários (os
//     primários aguardam que o primeiro apoio chegue à posição).
//   • Comunicações rádio (relatório do batedor, ordem de avanço, check-ins
//     periódicos, sinal de retirada, confirmação final) — commAt().
//   • Velocidades por fase: caminham na aproximação (abrandam junto ao alvo,
//     com micro-hesitações), correm apenas na retirada; urgência da missão
//     (janela curta) acelera tudo; missões longas → retirada apressada,
//     curtas → retirada organizada.
//   • Retirada em pipeline: percurso diferente da chegada → reagrupamento
//     junto ao veículo → espera → embarque escalonado; a retaguarda cobre a
//     retirada, corre em último e faz a confirmação visual à porta antes de
//     o veículo poder arrancar. O veículo aguarda ainda uns segundos.
//   • Veículo: micro-reposicionamento se ficou mal estacionado (repark) e
//     janelas de portas abertas (desembarque/embarque, fecham antes de partir).
//   • Naturalidade: orientação do olhar por papel + varrimento em direções
//     diferentes, hesitações nos trajetos, líder circula entre membros em
//     operações longas, rotação de posições (3 estações) em janelas grandes,
//     estações ordenadas por ângulo (trajetos que não se cruzam), leque e
//     raios adaptados ao espaço disponível (distância carro↔alvo).
//   • Objetos: caixas (carregadores), documentos/dispositivo (negociador,
//     hacker) e saque (€) no regresso com sucesso.
//
// Performance: a avaliação por frame (opStateAt / vehiclePoseAt / commAt) é
// matemática pura O(1) por entidade — escala para dezenas de missões.

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

const toDeg = (rad) => (rad * 180) / Math.PI;

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

// Caminho por pontos arbitrários (perímetro do batedor).
function polyPath(points, samplesPerLeg = 5) {
  const latlngs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (let k = 0; k < samplesPerLeg; k++) {
      const t = k / samplesPerLeg;
      latlngs.push([a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t]);
    }
  }
  const last = points[points.length - 1];
  latlngs.push([last.lat, last.lng]);
  const cum = buildCumulative(latlngs);
  return { latlngs, cum, length: cum[cum.length - 1] || 0 };
}

const pathAt = (path, f) => pointOnRoute(path.latlngs, path.cum, clamp(f, 0, 1));

// Rumo (graus) do deslocamento ao longo de um caminho a pé.
function pathHeading(path, f) {
  const a = pathAt(path, f);
  const b = pathAt(path, clamp(f + 0.03, 0, 1));
  if (!a || !b || (a.lat === b.lat && a.lng === b.lng)) return null;
  return toDeg(bearingRad(a, b));
}

// Avanço em passos (infiltração/batedor): mover ~62% de cada troço, pausar o resto.
function steppedEase(t) {
  const steps = 4;
  const seg = 1 / steps;
  const k = Math.min(steps - 1, Math.floor(clamp(t, 0, 1) / seg));
  const within = (clamp(t, 0, 1) - k * seg) / seg;
  const moveFrac = 0.62;
  const p = within < moveFrac ? smooth(within / moveFrac) : 1;
  return clamp((k + p) * seg, 0, 1);
}

// Hesitações: remove a janela [p, p+w] do tempo de progresso (congela aí).
function pauseWarp(t, p, w) {
  if (t <= p) return t;
  if (t >= p + w) return t - w;
  return p;
}

// Aproximação natural: arranque decidido + abrandamento junto ao alvo, com
// até duas micro-pausas seeded (só quando a missão não é urgente).
function hesitantEase(t, r1, r3, pauses) {
  t = clamp(t, 0, 1);
  let tau = t;
  let span = 1;
  if (pauses) {
    const p1 = 0.26 + r1 * 0.16;
    const w1 = 0.05 + r3 * 0.04;
    const p2 = 0.62 + r3 * 0.14;
    const w2 = 0.04 + r1 * 0.04;
    tau = pauseWarp(pauseWarp(t, p2, w2), p1, w1);
    span = 1 - w1 - w2;
  }
  const x = clamp(tau / span, 0, 1);
  return 1 - Math.pow(1 - x, 1.62);
}

// Perfil de velocidade trapezoidal — aceleração suave, cruzeiro, travagem.
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

// Tipos de carga em que o sentido "carregado" é veículo → alvo (entrega).
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
  repark: "Reposicionamento",
  disembark: "Desembarque",
  recon: "Reconhecimento",
  approach: "Aproximação",
  execute: "Execução",
  withdraw: "Retirada",
  regroup: "Reagrupamento",
  board: "Embarque",
  confirm: "Confirmação final",
  return: "Regresso",
  done: "Concluída",
};

// Sacos de dinheiro no regresso a pé (se a missão teve sucesso).
const LOOT_ON_EXIT = { heist: true, spread: true, collect: true };

// Papéis de apoio (nunca "entram" no objetivo).
const SUPPORT_ROLES = new Set(["vehicle", "retreat", "overwatch", "door", "techaccess"]);
const PRIMARY_ROLES = new Set(["entry", "carrier", "assault", "ghostop", "escort", "negotiator", "hacker"]);

// Especialização real → papel desejado na coreografia.
const DRIVER_KEYS = new Set(["motorista", "piloto"]);
const RANK_ORDER = ["recruta", "membro", "especialista", "veterano", "tenente", "chefe_equipa", "braco_direito"];

function specDesire(spec, kind) {
  if (spec === "tecnica") return kind === "tech" ? "hacker" : "techaccess";
  if (spec === "influencia") return "negotiator";
  if (spec === "logistica") return kind === "cargo" ? "carrier" : "vehicle";
  return null;
}

// ============================================================================
// Veículo — timings, estacionamento (com repark) e pose por frame
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

// Escolhe o local de estacionamento: recuado 25–50m do fim da rota, encostado
// à berma e NUNCA sobre o alvo. v3: com probabilidade seeded o carro fica
// "mal estacionado" e faz um micro-reposicionamento (repark) já no local.
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
    const away = bearingRad(target, anchor);
    park = ringPoint(target, isFinite(away) ? away : rng() * 2 * Math.PI, 16);
  }

  // Repark: ~38% das missões o carro encosta mal e ajusta 4.5–8m ao longo da
  // via, ainda antes de as portas abrirem.
  const repark = rng() < 0.38 && total > 40;
  let park2 = park;
  if (repark) {
    park2 = ringPoint(park, streetBearingRad, 4.5 + rng() * 3.5);
    if (distMeters(park2, target) < 14) park2 = ringPoint(park, streetBearingRad + Math.PI, 5 + rng() * 2);
  }

  return {
    latlngs, cum, total, parkFrac, anchor, park, streetBearingRad, curbSide,
    repark, park2, reparkStartOff: 0.9, reparkDur: 2.4,
    fallback: !!routeInfo.fallback,
  };
}

// Pose do veículo num instante — posição, rumo (graus) e estado.
export function vehiclePoseAt(mission, parking, nowMs) {
  const vt = vehicleTimings(mission);
  const s = nowMs / 1000;
  const { latlngs, cum, parkFrac, anchor, park, streetBearingRad } = parking;
  const streetDeg = toDeg(streetBearingRad);
  const parkEff = parking.repark ? parking.park2 : park;

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
    // v3: micro-reposicionamento se ficou mal estacionado.
    if (parking.repark) {
      const rs = vt.arrive + parking.reparkStartOff;
      const reEnd = rs + parking.reparkDur;
      if (s < rs) {
        return { lat: park.lat, lng: park.lng, phase: "operating", state: "parking", frac: parkFrac, progress: 1, bearing: streetDeg, moving: false };
      }
      if (s < reEnd) {
        const f = smooth((s - rs) / parking.reparkDur);
        const pos = lerpPt(park, parking.park2, f);
        return { ...pos, phase: "operating", state: "repark", frac: parkFrac, progress: 1, bearing: streetDeg, moving: true };
      }
    }
    return { lat: parkEff.lat, lng: parkEff.lng, phase: "operating", state: "execute", frac: parkFrac, progress: 1, bearing: streetDeg, moving: false };
  }

  // Regresso — sai da berma, acelera lentamente, trava na base.
  const T = vt.Tr;
  const t = clamp((s - vt.finish) / T, 0, 1);
  const a = vt.departDur / T;
  const b = vt.brakeDur / T;
  const f = parkFrac * (1 - trapezoidEase(t, a, b));
  const base = pointOnRoute(latlngs, cum, f) || anchor;
  const lf = 1 - smooth(clamp((s - vt.finish) / vt.departDur, 0, 1));
  const pos = {
    lat: base.lat + (parkEff.lat - anchor.lat) * lf,
    lng: base.lng + (parkEff.lng - anchor.lng) * lf,
  };
  const bearing = routeBearingDeg(latlngs, cum, f, -1) ?? (streetDeg + 180) % 360;
  return { ...pos, phase: "returning", state: "return", frac: f, progress: t, bearing, moving: true };
}

// ============================================================================
// Registo de arquetipos — papéis, estações e parâmetros por tipo de missão
// ============================================================================

const spreadAngles = (base, totalDeg, count) => {
  const out = [];
  for (let i = 0; i < count; i++) {
    const f = count > 1 ? i / (count - 1) - 0.5 : 0;
    out.push(base + (f * totalDeg * Math.PI) / 180);
  }
  return out;
};

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
    entrances: true, // distribuem-se pelas entradas do edifício
  },
  spread: {
    speed: 1.6,
    roles: (n) => withSupportRoles("entry", n, [
      { min: 3, at: 2, role: "overwatch" },
      { min: 5, at: 4, role: "vehicle" },
    ]),
    primaryFan: { spreadDeg: 360, radius: 12, fullCircle: true },
    invade: true,
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

// Estação de um papel de apoio (partilhada entre arquetipos). radScale adapta
// as distâncias ao espaço disponível em redor do alvo.
function supportStation(role, ctx, rng) {
  const { target, park, approach, street, radScale } = ctx;
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
    return ringPoint(target, street + side * (1.0 + rng() * 0.8), (9 + rng() * 4) * radScale);
  }
  if (role === "door") {
    return ringPoint(target, street + (rng() - 0.5) * 0.4, (6.5 + rng() * 2) * radScale);
  }
  if (role === "techaccess") {
    // acessos técnicos — traseiras/lateral do edifício
    const side = rng() < 0.5 ? 1 : -1;
    return ringPoint(target, street + Math.PI + side * (0.5 + rng() * 0.5), (4.5 + rng() * 2.5) * radScale);
  }
  return ringPoint(target, street, 5 * radScale);
}

// Normaliza um ângulo para (-π, π].
const normAng = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
};

// ============================================================================
// Construção da coreografia (uma vez por missão)
// ============================================================================
// parking: resultado de buildParking; opsCount: nº de operacionais (máx. 6);
// roster: [{ role_key, spec, rank }] alinhado com mission.member_ids (opcional).
export function buildChoreography(mission, parking, opsCount, roster) {
  const arrive = Date.parse(mission.arrive_at) / 1000;
  const finish = Date.parse(mission.finish_at) / 1000;
  const W = Math.max(4, finish - arrive);
  const target = { lat: mission.target.lat, lng: mission.target.lng };
  const park = parking.repark ? parking.park2 : (parking.park || parking);
  const kind = choreoKind(mission.opportunity);
  const arch = ARCHETYPES[kind] || ARCHETYPES.collect;
  const rng = mulberry32(hashStr(String(mission.id || "m")));
  const nTotal = clamp(opsCount || 1, 1, 6);
  const members = Array.isArray(roster) ? roster.slice(0, nTotal) : [];

  // ----- Urgência e estilo de retirada -----
  // Janela curta → todos se mexem mais depressa; missões longas terminam com
  // uma retirada apressada, curtas com uma retirada organizada.
  const urgency = clamp(1.26 - W / 300, 0.92, 1.26);
  const hurried = W > 110;
  const calm = urgency < 1.12; // permite micro-hesitações na aproximação

  // ----- Motorista pode ficar ao volante -----
  let driverInside = false;
  let driverMemberIdx = -1;
  if (nTotal >= 3) {
    for (let i = 0; i < members.length; i++) {
      if (members[i] && DRIVER_KEYS.has(members[i].role_key)) { driverMemberIdx = i; break; }
    }
    if (driverMemberIdx >= 0 && rng() < 0.75) driverInside = true;
  }
  const groundMembers = [];
  for (let i = 0; i < nTotal; i++) {
    if (driverInside && i === driverMemberIdx) continue;
    groundMembers.push(members[i] || null);
  }
  const n = driverInside ? nTotal - 1 : nTotal;
  const cinematic = W >= 26 && n >= 2;

  const approach = bearingRad(park, target); // rumo carro -> alvo
  const street = approach + Math.PI;         // lado da rua (de onde chegam)
  const dPT = Math.max(6, distMeters(park, target));
  const radScale = clamp(dPT / 26, 0.72, 1.5); // adapta a ocupação ao espaço

  // ----- Papéis: arquetipo + especializações reais -----
  const roles = arch.roles(n);
  let primaryCount = roles.filter((r) => PRIMARY_ROLES.has(r)).length;
  const minPrimary = Math.max(1, Math.ceil(n * 0.4));
  for (let i = 0; i < n; i++) {
    const spec = groundMembers[i]?.spec || null;
    const desire = spec ? specDesire(spec, kind) : null;
    if (!desire || roles[i] === desire) continue;
    const j = roles.indexOf(desire);
    if (j >= 0) {
      const tmp = roles[i];
      roles[i] = roles[j];
      roles[j] = tmp;
      continue;
    }
    const iPrim = PRIMARY_ROLES.has(roles[i]);
    const dPrim = PRIMARY_ROLES.has(desire);
    if (!iPrim || dPrim || primaryCount > minPrimary) {
      if (iPrim && !dPrim) primaryCount--;
      if (!iPrim && dPrim) primaryCount++;
      roles[i] = desire;
    }
  }

  // ----- Líder de facto (patente mais alta em terra) -----
  let leaderIdx = 0;
  let bestRank = -1;
  for (let i = 0; i < n; i++) {
    const rk = RANK_ORDER.indexOf(groundMembers[i]?.rank);
    if (rk > bestRank) { bestRank = rk; leaderIdx = i; }
  }

  // ----- Batedor (verifica o perímetro antes de todos) -----
  let scoutIdx = -1;
  if (cinematic) {
    const prefs = ["overwatch", "door", "retreat", "vehicle", "techaccess"];
    for (const pr of prefs) {
      const j = roles.findIndex((r, k) => r === pr && k !== leaderIdx);
      if (j >= 0) { scoutIdx = j; break; }
    }
    if (scoutIdx < 0) {
      for (let i = 0; i < n; i++) if (i !== leaderIdx) { scoutIdx = i; break; }
    }
  }

  // ----- Estações (leque/entradas + jitter), ordenadas para não se cruzarem -----
  const fan = arch.primaryFan;
  const fanRot = (rng() - 0.5) * (fan.fullCircle ? 0.9 : 0.6);
  const primaryIdx = [];
  for (let i = 0; i < n; i++) if (!SUPPORT_ROLES.has(roles[i])) primaryIdx.push(i);

  const baseBearing = fan.rear ? approach : street;
  // Entradas do edifício (heist): 2–3 pontos de acesso; spread mantém o cerco
  // completo mas cada op invade pela entrada mais próxima.
  const entrances = [street + (rng() - 0.5) * 0.3];
  if (n >= 2) entrances.push(street + 1.7 + (rng() - 0.5) * 0.3);
  if (n >= 5) entrances.push(street - 1.7 + (rng() - 0.5) * 0.3);

  let angles;
  if (arch.entrances && primaryIdx.length >= 2) {
    angles = primaryIdx.map((_, k) => entrances[k % entrances.length] + (rng() - 0.5) * 0.24);
  } else if (fan.fullCircle) {
    angles = primaryIdx.map((_, k) => baseBearing + fanRot + (k * 2 * Math.PI) / Math.max(1, primaryIdx.length));
  } else {
    angles = spreadAngles(baseBearing + fanRot, fan.spreadDeg, primaryIdx.length);
  }
  // Trajetos que não se cruzam: estações ordenadas por ângulo relativo e
  // atribuídas por ordem — o op mais "à esquerda" sai pela porta esquerda.
  const sortedAngles = angles
    .map((a) => ({ a, rel: normAng(a - approach) }))
    .sort((x, y) => x.rel - y.rel);

  const stations = new Array(n);
  const doorSides = new Array(n);
  const opAngle = new Array(n).fill(null);
  for (let k = 0; k < primaryIdx.length; k++) {
    const i = primaryIdx[k];
    const ent = sortedAngles[k];
    const ang = ent.a + (rng() - 0.5) * 0.14;
    const rad = fan.radius * radScale * (0.85 + rng() * 0.3);
    stations[i] = ringPoint(target, ang, rad);
    doorSides[i] = ent.rel > 0 ? 1 : -1;
    opAngle[i] = ang;
  }
  for (let i = 0; i < n; i++) {
    if (stations[i]) continue;
    stations[i] = supportStation(roles[i], { target, park, approach, street, radScale }, rng);
    doorSides[i] = normAng(bearingRad(park, stations[i]) - approach) > 0 ? 1 : -1;
  }

  // ----- Timeline global (v3) -----
  const settleEnd = arrive + (parking.repark ? parking.reparkStartOff + parking.reparkDur + 0.3 : 0.7);
  const doorsOpenAt = settleEnd + 0.25;

  // Ordem de saída: batedor → líder → apoios → primários.
  const exitOrder = [];
  if (scoutIdx >= 0) exitOrder.push(scoutIdx);
  if (leaderIdx !== scoutIdx) exitOrder.push(leaderIdx);
  for (let i = 0; i < n; i++) if (!exitOrder.includes(i) && SUPPORT_ROLES.has(roles[i])) exitOrder.push(i);
  for (let i = 0; i < n; i++) if (!exitOrder.includes(i)) exitOrder.push(i);

  const exitStagger = (0.5 + rng() * 0.35) / urgency;
  const spawnAts = new Array(n);
  for (let k = 0; k < exitOrder.length; k++) {
    spawnAts[exitOrder[k]] = doorsOpenAt + 0.3 + k * exitStagger * (0.85 + rng() * 0.3);
  }
  let tDisembarkEnd = arrive;
  for (let i = 0; i < n; i++) tDisembarkEnd = Math.max(tDisembarkEnd, spawnAts[i] + 0.6);
  const doorsCloseExitAt = tDisembarkEnd + 1.4 + rng() * 1.8; // ficam abertas uns segundos

  const bulgeBase = (rng() - 0.5) * 2 * clamp(dPT * 0.18, 3, 14);
  const cargoOutbound = CARGO_OUTBOUND.has(mission.opportunity?.type_key);

  // ----- Ops: pontos, caminhos e velocidades -----
  const rallyBase = ringPoint(park, approach, clamp(3.2 * radScale, 2.4, 4.5));
  const ops = [];
  for (let i = 0; i < n; i++) {
    const r1 = rng();
    const r2 = rng();
    const r3 = rng();
    const role = roles[i];
    const station = stations[i];
    const doorSide = doorSides[i] ?? (i % 2 === 0 ? 1 : -1);
    const spawnPt = ringPoint(park, approach + (doorSide * Math.PI) / 2, 1.8);
    const holdPt = ringPoint(spawnPt, rng() * 2 * Math.PI, 0.5 + rng() * 0.8);
    const rallyPt = ringPoint(rallyBase, rng() * 2 * Math.PI, 0.6 + rng() * 1.0);

    const bulge = bulgeBase * (0.75 + 0.5 * r1) + (r1 - 0.5) * 2.5;
    const pIn = walkPath(spawnPt, station, bulge);
    // Retirada por percurso diferente: barriga invertida, via ponto de reunião.
    const pOut = walkPath(station, rallyPt, -bulge * 0.9);
    const pBoard = walkPath(rallyPt, spawnPt, (rng() - 0.5) * 1.2, 6);
    const latAmp = clamp((i - (n - 1) / 2) * (1.0 + 0.8 * r2), -3.5, 3.5);
    const latPerp = bearingRad(spawnPt, station) + Math.PI / 2;

    const speed = arch.speed * (0.88 + 0.3 * r2) * urgency;         // caminhar
    const runSpeed = speed * (1.9 + 0.3 * r3) * (hurried ? 1.12 : 1); // correr (só retirada)
    const walkInDur = clamp(pIn.length / speed, 1.0, W * 0.26);
    const runOutDur = clamp(pOut.length / runSpeed, 0.8, W * 0.22);

    const op = {
      role, station, spawnPt, holdPt, rallyPt, pIn, pOut, pBoard,
      speed, runSpeed, walkInDur, runOutDur,
      spawnAt: spawnAts[i],
      isLeader: i === leaderIdx,
      isScout: i === scoutIdx,
      latAmp, latPerp, r1, r2, r3,
      // deriva idle universal (duas frequências)
      dw1: (2 * Math.PI) / (4.2 + r2 * 3.2), dp1: r1 * 6.28,
      dw2: (2 * Math.PI) / (6.5 + r3 * 3.5), dp2: r2 * 6.28,
      // varrimento do olhar — período/fase próprios por operacional
      lookP: 2.8 + r1 * 2.8, lookPhase: r2 * 20, lookSeed: r3 * 97.3,
      faceBase: null, // preenchido abaixo
    };

    // Orientação base do olhar por papel (parado).
    if (role === "overwatch" || role === "retreat" || role === "door" || role === "techaccess") {
      op.faceBase = toDeg(bearingRad(target, station)); // vigiam para fora
    } else if (role === "vehicle") {
      op.faceBase = toDeg(parking.streetBearingRad ?? approach);
    } else {
      op.faceBase = toDeg(bearingRad(station, target)); // virados ao alvo
    }

    // ----- Parâmetros de programa por papel/arquetipo -----
    if (role === "entry") {
      op.invade = !!arch.invade;
      op.target = target;
      // porta de entrada: a mais próxima da estação (entradas do edifício)
      let bestEnt = entrances[0];
      let bestD = Infinity;
      for (const ea of entrances) {
        const d = Math.abs(normAng((opAngle[i] ?? bearingRad(target, station)) - ea));
        if (d < bestD) { bestD = d; bestEnt = ea; }
      }
      op.door = ringPoint(target, bestEnt, 1.9);
    }
    if (role === "carrier") {
      op.period = clamp(2 * (pIn.length / speed) * 0.8 + 5, 8, 26) * (0.9 + 0.2 * r3);
      op.dwell = op.period * 0.14;
      op.cargoOutbound = cargoOutbound;
    }
    if (role === "assault") {
      const perp = bearingRad(station, target) + Math.PI / 2;
      op.coverA = ringPoint(station, perp, 4 * radScale);
      op.coverB = ringPoint(station, perp + Math.PI, 4 * radScale);
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
        op.orbitDrift = (2 * Math.PI) / (26 + r3 * 18);
        op.orbitDir = r1 < 0.5 ? 1 : -1;
      }
    }
    if (role === "door" || role === "vehicle") {
      const axis = role === "door" ? street + Math.PI / 2 : (parking.streetBearingRad ?? approach);
      const span = (role === "door" ? 3.5 : 2.8) * radScale;
      op.paceA = ringPoint(station, axis, span);
      op.paceB = ringPoint(station, axis + Math.PI, span);
      op.pacePeriod = 5.5 + r3 * 3;
    }
    if (role === "overwatch" || role === "retreat" || role === "ghostop" || role === "techaccess") {
      const shiftDir = role === "ghostop" ? bearingRad(station, target) : r2 * 2 * Math.PI;
      op.stationB = ringPoint(station, shiftDir, role === "ghostop" ? 1.6 + r3 * 1.2 : 1.5 + r3 * 1.8);
      op.msPeriod = 8 + r3 * 7;
      // Operações longas: terceira estação → rotação periódica de posições.
      if (W > 75) op.stationC = ringPoint(station, r1 * 2 * Math.PI, 2.0 + r2 * 2.2);
    }

    ops.push(op);
  }

  // ----- Reconhecimento do batedor + ordem do líder -----
  let reconEnd = null;
  if (scoutIdx >= 0) {
    const sc = ops[scoutIdx];
    const reconR = fan.radius * radScale + 4.5;
    const side = rng() < 0.5 ? 1 : -1;
    const b0 = street + side * (0.7 + rng() * 0.4);
    const sweep = side * -(1.2 + rng() * 0.8);
    const pts = [sc.spawnPt, ringPoint(target, b0, reconR)];
    pts.push(ringPoint(target, b0 + sweep * 0.5, reconR * (0.92 + rng() * 0.16)));
    pts.push(ringPoint(target, b0 + sweep, reconR * (0.9 + rng() * 0.2)));
    pts.push(sc.station);
    sc.pRecon = polyPath(pts);
    sc.walkStart = sc.spawnAt + 0.5;
    sc.reconDur = clamp(sc.pRecon.length / sc.speed, 3, W * 0.2);
    reconEnd = sc.walkStart + sc.reconDur;
  }
  const orderAt = (reconEnd != null ? reconEnd : tDisembarkEnd) + 0.4 + rng() * 0.6;

  // ----- Avanço: apoios primeiro, primários aguardam a primeira cobertura -----
  const supIdx = [];
  const priIdx = [];
  for (let i = 0; i < n; i++) {
    if (i === scoutIdx) continue;
    (SUPPORT_ROLES.has(ops[i].role) ? supIdx : priIdx).push(i);
  }
  let firstSupportArrive = orderAt + 0.6;
  supIdx.forEach((i, k) => {
    const op = ops[i];
    op.advanceAt = Math.max(orderAt + 0.25 + k * (0.4 + op.r3 * 0.25), op.spawnAt + 0.6);
    op.actionStart = op.advanceAt + op.walkInDur;
    if (k === 0) firstSupportArrive = op.actionStart;
    else firstSupportArrive = Math.min(firstSupportArrive, op.actionStart);
  });
  const actionCap = arrive + W * 0.55;
  priIdx.forEach((i, k) => {
    const op = ops[i];
    const waitFor = cinematic && supIdx.length > 0 ? firstSupportArrive + 0.3 : orderAt + 0.6;
    op.advanceAt = Math.max(op.spawnAt + 0.6, Math.max(orderAt + 0.6, waitFor) + k * (0.45 + op.r3 * 0.3));
    if (op.advanceAt + op.walkInDur > actionCap) {
      op.advanceAt = Math.max(orderAt + 0.2 + k * 0.3, actionCap - op.walkInDur);
    }
    op.actionStart = op.advanceAt + op.walkInDur;
  });
  if (scoutIdx >= 0) {
    const sc = ops[scoutIdx];
    sc.advanceAt = sc.walkStart;
    sc.actionStart = reconEnd;
  }
  let tApproachEnd = arrive;
  for (const op of ops) tApproachEnd = Math.max(tApproachEnd, op.actionStart);

  // ----- Retaguarda (protege a retirada, embarca em último, confirma) -----
  let rearIdx = -1;
  if (cinematic && n >= 2) {
    rearIdx = ops.findIndex((o, k) => o.role === "retreat" && k !== leaderIdx);
    if (rearIdx < 0 && scoutIdx >= 0) rearIdx = scoutIdx;
    if (rearIdx < 0) rearIdx = n - 1 === leaderIdx ? n - 2 : n - 1;
    if (rearIdx < 0) rearIdx = -1;
  }

  // ----- Retirada resolvida de trás para a frente a partir do finish -----
  const solveRetreat = (tight) => {
    const departHold = tight ? 0.8 : 1.2 + rng() * 1.4;
    const confDur = rearIdx >= 0 ? (tight ? 0.6 : 0.9 + rng() * 0.8) : 0;
    const boardWalk = 1.0 + rng() * 0.4;
    const boardStagger = tight ? 0.35 : hurried ? 0.45 + rng() * 0.25 : 0.8 + rng() * 0.45;
    const regHold = tight ? 0.2 : hurried ? 0.25 + rng() * 0.4 : 0.9 + rng() * 1.1;
    const jitScale = tight ? 0.4 : hurried ? 0.6 : 1;
    return { departHold, confDur, boardWalk, boardStagger, regHold, jitScale };
  };

  const applyRetreat = (P) => {
    const departReadyAt = finish - P.departHold;
    const others = [];
    for (let i = 0; i < n; i++) if (i !== rearIdx) others.push(i);

    // jitters e caudas
    let maxTail = 0;
    for (const i of others) {
      const op = ops[i];
      op.retJit = (0.2 + op.r1 * 0.8) * P.jitScale;
      maxTail = Math.max(maxTail, op.retJit + op.runOutDur);
    }

    // ordem de embarque: organizada → primários (com saque) primeiro;
    // apressada → ordem baralhada seeded.
    const order = [...others];
    if (hurried) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    } else {
      order.sort((a, b) => (SUPPORT_ROLES.has(ops[a].role) ? 1 : 0) - (SUPPORT_ROLES.has(ops[b].role) ? 1 : 0));
    }

    const nB = others.length;
    const boardSpan = nB > 0 ? (nB - 1) * P.boardStagger + P.boardWalk + 0.45 : 0;

    // retaguarda: tempos próprios
    let rear = null;
    if (rearIdx >= 0) {
      const op = ops[rearIdx];
      const coverPt = ringPoint(lerpPt(park, target, 0.42 + op.r2 * 0.16), approach + Math.PI / 2, (op.r1 - 0.5) * 6);
      const pCoverIn = walkPath(op.station, coverPt, (op.r3 - 0.5) * 2, 6);
      const pCoverOut = walkPath(coverPt, op.spawnPt, (op.r1 - 0.5) * 2, 6);
      rear = {
        coverPt, pCoverIn, pCoverOut,
        dashDur: clamp(pCoverIn.length / op.runSpeed, 0.5, 3),
        runDur: clamp(pCoverOut.length / op.runSpeed, 0.6, 4),
      };
    }

    // estimativa inicial do sinal de retirada
    let signal = departReadyAt - (maxTail + P.regHold + boardSpan + (rear ? rear.runDur + P.confDur + 0.5 : 0.4));

    const computeForward = () => {
      let lastRally = signal;
      for (const i of others) {
        const op = ops[i];
        op.walkBackAt = signal + op.retJit;
        op.rallyArrive = op.walkBackAt + op.runOutDur;
        lastRally = Math.max(lastRally, op.rallyArrive);
      }
      const firstBoardAt = lastRally + P.regHold;
      let lastOthersEnd = firstBoardAt;
      order.forEach((i, k) => {
        const op = ops[i];
        op.boardStart = Math.max(firstBoardAt + k * P.boardStagger, op.rallyArrive);
        op.boardWalk = P.boardWalk;
        op.boardEnd = op.boardStart + P.boardWalk + 0.45;
        lastOthersEnd = Math.max(lastOthersEnd, op.boardEnd);
      });
      let rearEnd = lastOthersEnd;
      if (rear && rearIdx >= 0) {
        const op = ops[rearIdx];
        op.coverAt = signal + 0.15;
        op.coverArrive = op.coverAt + rear.dashDur;
        op.coverUntil = Math.max(firstBoardAt, op.coverArrive + 0.5);
        op.doorAt = Math.max(op.coverUntil + rear.runDur, lastOthersEnd - 0.25);
        op.confDur = P.confDur;
        op.boardEnd = op.doorAt + P.confDur + 0.5;
        op.walkBackAt = op.coverAt;
        op.rallyArrive = op.doorAt;
        op.boardStart = op.doorAt;
        op.boardWalk = 0;
        op.coverPt = rear.coverPt;
        op.pCoverIn = rear.pCoverIn;
        op.pCoverOut = rear.pCoverOut;
        op.coverDashDur = rear.dashDur;
        op.coverRunDur = rear.runDur;
        rearEnd = op.boardEnd;
      }
      return { lastRally, firstBoardAt, end: Math.max(lastOthersEnd, rearEnd) };
    };

    let fw = computeForward();
    const overshoot = fw.end - departReadyAt;
    if (overshoot > 0) {
      signal -= overshoot;
      fw = computeForward();
    }
    return { signal, fw, P };
  };

  const minSignal = tApproachEnd + clamp(W * 0.12, 0.8, 6);
  let R = applyRetreat(solveRetreat(false));
  if (R.signal < minSignal) R = applyRetreat(solveRetreat(true));
  if (R.signal < minSignal) {
    // janela apertadíssima — aceita a compressão mas garante monotonicidade
    R.signal = minSignal;
    for (const op of ops) {
      op.walkBackAt = Math.max(op.walkBackAt ?? R.signal, Math.min(op.actionStart + 0.4, finish - 2));
      op.rallyArrive = Math.min(op.rallyArrive ?? (op.walkBackAt + op.runOutDur), finish - 1.2);
      op.boardStart = Math.min(op.boardStart ?? op.rallyArrive, finish - 1.0);
      op.boardEnd = Math.min(op.boardEnd ?? (op.boardStart + 1.2), finish - 0.4);
    }
  }
  const retreatSignalAt = R.signal;
  let tRegroupStart = finish;
  let tBoardStart = finish;
  for (let i = 0; i < n; i++) {
    if (i === rearIdx) continue;
    tRegroupStart = Math.min(tRegroupStart, ops[i].rallyArrive ?? finish);
    tBoardStart = Math.min(tBoardStart, ops[i].boardStart ?? finish);
  }
  const tConfirmStart = rearIdx >= 0 ? ops[rearIdx].doorAt ?? null : null;
  if (rearIdx >= 0) ops[rearIdx].isRear = true;

  // Continuidade do vaivém de carga na retirada (sem teleporte).
  for (const op of ops) {
    if (op.role === "carrier") op.cargoF0 = shuttleFrac(op, op.walkBackAt);
  }

  // ----- Líder circula entre membros (operações longas) -----
  const ROAMABLE = new Set(["negotiator", "door", "vehicle", "overwatch", "techaccess", "retreat"]);
  const leaderOp = ops[leaderIdx];
  if (leaderOp && W > 45 && ROAMABLE.has(leaderOp.role) && n >= 3 && !leaderOp.isRear) {
    const visits = [];
    for (let i = 0; i < n; i++) {
      if (i === leaderIdx) continue;
      const st = ops[i].station;
      visits.push({ pt: ringPoint(st, bearingRad(st, leaderOp.station), 1.4), d: distMeters(leaderOp.station, st) });
    }
    visits.sort((a, b) => a.d - b.d);
    leaderOp.roam = {
      visits: visits.slice(0, 3).map((v) => v.pt),
      period: 13 + rng() * 8,
      start: tApproachEnd + 4,
      walkDur: 2.2,
      until: retreatSignalAt - 3,
    };
  }

  // ----- Comunicações rádio (linhas/pings entre operacionais) -----
  const comms = [];
  if (cinematic) {
    if (scoutIdx >= 0 && scoutIdx !== leaderIdx && reconEnd != null) {
      comms.push({ at: reconEnd - 0.3, dur: 1.5, from: scoutIdx, to: leaderIdx, kind: "report" });
    }
    let nearest = -1;
    let nd = Infinity;
    for (let i = 0; i < n; i++) {
      if (i === leaderIdx) continue;
      const d = distMeters(ops[leaderIdx].station, ops[i].station);
      if (d < nd) { nd = d; nearest = i; }
    }
    if (nearest >= 0) comms.push({ at: orderAt, dur: 1.7, from: leaderIdx, to: nearest, kind: "order" });
    // check-ins periódicos durante a execução
    const checkers = [...supIdx, ...priIdx].filter((i) => i !== leaderIdx);
    if (checkers.length) {
      let t = tApproachEnd + 5 + rng() * 3;
      let k = 0;
      while (t < retreatSignalAt - 7 && k < 6) {
        comms.push({ at: t, dur: 1.3, from: checkers[k % checkers.length], to: leaderIdx, kind: "check" });
        t += 8 + rng() * 8;
        k++;
      }
    }
    let farthest = nearest;
    let fd = -1;
    for (let i = 0; i < n; i++) {
      if (i === leaderIdx) continue;
      const d = distMeters(ops[leaderIdx].station, ops[i].station);
      if (d > fd) { fd = d; farthest = i; }
    }
    if (farthest >= 0) comms.push({ at: retreatSignalAt + 0.05, dur: 1.7, from: leaderIdx, to: farthest, kind: "retreat" });
    if (rearIdx >= 0 && tConfirmStart != null && rearIdx !== leaderIdx) {
      comms.push({ at: tConfirmStart + 0.25, dur: 1.2, from: rearIdx, to: leaderIdx, kind: "clear" });
    }
    comms.sort((a, b) => a.at - b.at);
  }

  // ----- Janelas das portas do veículo -----
  const boardDoorsOpenAt = tBoardStart - 0.6;
  const doorsFinalCloseAt = Math.min(finish - 0.7, (rearIdx >= 0 ? ops[rearIdx].boardEnd : tBoardStart + 2) + 0.4);

  return {
    kind,
    park,
    target,
    ops,
    n,
    groundCount: n,
    driverInside,
    leaderIdx,
    scoutIdx,
    rearIdx,
    calm,
    hurried,
    urgency,
    comms,
    ghost: arch.ghost || 0,
    lootOnExit: !!LOOT_ON_EXIT[kind],
    basePath: walkPath(park, target, clamp(dPT * 0.1, 2, 8)),
    deployStart: arrive,
    deployEnd: finish,
    orderAt,
    tDisembarkEnd,
    tReconEnd: reconEnd != null ? orderAt : null,
    tApproachEnd,
    tWithdrawStart: retreatSignalAt,
    tRegroupStart,
    tBoardStart,
    tConfirmStart,
    doorsOpenAt,
    doorsCloseExitAt,
    boardDoorsOpenAt,
    doorsFinalCloseAt,
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
    else if (choreo.tReconEnd != null && s < choreo.tReconEnd) state = "recon";
    else if (s < choreo.tApproachEnd) state = "approach";
    else if (choreo.tConfirmStart != null && s >= choreo.tConfirmStart) state = "confirm";
    else if (s >= choreo.tBoardStart) state = "board";
    else if (s >= choreo.tRegroupStart) state = "regroup";
    else if (s >= choreo.tWithdrawStart) state = "withdraw";
    else state = "execute";
  } else if (s >= vt.arrive - vt.parkDur * 0.45) state = "parking";
  else if (s >= vt.arrive - vt.parkDur) state = "arrival";
  else state = "travel";
  return { state, label: MISSION_STATE_LABELS[state] };
}

// ============================================================================
// Comunicações rádio — evento ativo num instante (ou null)
// ============================================================================
export function commAt(choreo, nowSec) {
  const cs = choreo?.comms;
  if (!cs || !cs.length) return null;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (nowSec >= c.at && nowSec < c.at + c.dur) return { ...c, f: (nowSec - c.at) / c.dur };
    if (c.at > nowSec) break;
  }
  return null;
}

// ============================================================================
// Biblioteca de programas de execução (avaliados por frame, O(1))
// ============================================================================

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
  return op.cargoOutbound ? towardTarget : towardVehicle;
}

function shuttleDir(op, nowSec) {
  const tt = ((nowSec - op.actionStart) % op.period + op.period) % op.period;
  const legDur = (op.period - 2 * op.dwell) / 2;
  if (tt >= op.dwell && tt < op.dwell + legDur) return -1; // alvo → veículo
  if (tt >= 2 * op.dwell + legDur) return 1;               // veículo → alvo
  return 0;
}

function paceBetween(a, b, period, nowSec) {
  const t = ((nowSec % period) + period) % period / period;
  const f = t < 0.5 ? smooth(t * 2) : smooth(2 - t * 2);
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}

// Reposicionamento discreto: alterna entre 2 (ou 3 em operações longas)
// estações, com uma transição curta a caminhar.
function microShift(op, nowSec) {
  const t = Math.max(0, nowSec - op.actionStart);
  const pts = op.stationC ? [op.station, op.stationB, op.stationC] : [op.station, op.stationB];
  const k = Math.floor(t / op.msPeriod);
  const within = t - k * op.msPeriod;
  const from = pts[k % pts.length];
  const to = pts[(k + 1) % pts.length];
  const mv = 1.4;
  if (within < mv) {
    return { pos: lerpPt(from, to, smooth(within / mv)), walking: true, heading: toDeg(bearingRad(from, to)) };
  }
  return { pos: to, walking: false, heading: null };
}

// Programa de ação por papel (durante [actionStart, walkBackAt]).
function programEval(choreo, op, nowSec) {
  const target = choreo.target;
  const role = op.role;

  if (role === "entry") {
    let enterAt = op.actionStart + clamp((op.walkBackAt - op.actionStart) * 0.15, 0.6, 2.5);
    let from = op.station;
    if (op.invade) {
      const action = Math.max(0, op.walkBackAt - op.actionStart);
      const holdEnd = op.actionStart + clamp(action * 0.3, 0.8, 4);
      const convergeDur = clamp(action * 0.15, 0.8, 1.8);
      enterAt = holdEnd + convergeDur;
      if (nowSec < holdEnd) return { pos: op.station, ghost: 0, walking: false };
      if (nowSec < enterAt) {
        return {
          pos: lerpPt(op.station, op.door, smooth((nowSec - holdEnd) / convergeDur)),
          ghost: 0, walking: true, heading: toDeg(bearingRad(op.station, op.door)),
        };
      }
      from = op.door;
    }
    const exitAt = op.walkBackAt - clamp((op.walkBackAt - op.actionStart) * 0.1, 0.5, 1.5);
    const fadeT = 0.5;
    if (nowSec < enterAt) return { pos: from, ghost: 0, walking: false };
    if (nowSec < enterAt + fadeT) {
      const f = (nowSec - enterAt) / fadeT;
      return { pos: lerpPt(from, target, f), ghost: f, walking: true };
    }
    if (nowSec < exitAt) return { pos: target, ghost: 1, walking: false };
    const f = clamp((nowSec - exitAt) / fadeT, 0, 1);
    return { pos: lerpPt(target, op.station, f), ghost: 1 - f, walking: true };
  }

  if (role === "carrier") {
    const f = shuttleFrac(op, nowSec);
    const dir = shuttleDir(op, nowSec);
    const heading = dir === 0 ? null : (pathHeading(op.pIn, f) != null ? (dir > 0 ? pathHeading(op.pIn, f) : (pathHeading(op.pIn, f) + 180) % 360) : null);
    return {
      pos: pathAt(op.pIn, f), ghost: 0,
      walking: f > 0.02 && f < 0.98,
      carry: shuttleCarrying(op, nowSec) ? "box" : null,
      heading,
    };
  }

  if (role === "assault") {
    const cycle = op.cycleHold + op.dashDur;
    const k = Math.floor(Math.max(0, nowSec - op.actionStart) / cycle);
    const within = Math.max(0, nowSec - op.actionStart) % cycle;
    const from = k % 2 === 0 ? op.coverA : op.coverB;
    const to = k % 2 === 0 ? op.coverB : op.coverA;
    if (within < op.cycleHold) return { pos: from, ghost: 0, walking: false };
    return {
      pos: lerpPt(from, to, smooth((within - op.cycleHold) / op.dashDur)),
      ghost: 0, walking: true, running: true, heading: toDeg(bearingRad(from, to)),
    };
  }

  if (role === "door" || role === "vehicle") {
    const pos = paceBetween(op.paceA, op.paceB, op.pacePeriod, nowSec);
    const pos2 = paceBetween(op.paceA, op.paceB, op.pacePeriod, nowSec + 0.15);
    const heading = pos.lat === pos2.lat && pos.lng === pos2.lng ? null : toDeg(bearingRad(pos, pos2));
    return { pos, ghost: 0, walking: true, heading };
  }

  if (role === "overwatch" || role === "retreat" || role === "ghostop" || role === "techaccess") {
    const ms = microShift(op, nowSec);
    return { pos: ms.pos, ghost: 0, walking: ms.walking, heading: ms.heading };
  }

  if (role === "escort") {
    const ang = op.orbitBearing + op.orbitDir * Math.sin(nowSec * op.orbitDrift) * 0.35;
    const pos = ringPoint(op.orbitCenter, ang, op.orbitRadius);
    return { pos, ghost: 0, walking: false, faceOut: true };
  }

  // negotiator / hacker — balanço subtil virado ao alvo
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

// Olhar: base por papel + varrimento por passos (cada operacional olha para
// um lado diferente e muda de direção no seu próprio ritmo).
function lookHeading(op, base, nowSec, amp = 55) {
  const t = (nowSec + op.lookPhase) / op.lookP;
  const k = Math.floor(t);
  const offK = Math.sin(k * 127.1 + op.lookSeed) * amp;
  const offPrev = Math.sin((k - 1) * 127.1 + op.lookSeed) * amp;
  const w = clamp((t - k) / 0.25, 0, 1);
  return base + offPrev + (offK - offPrev) * smooth(w);
}

// Offset de formação — afastamento lateral em leque durante as caminhadas.
function formationOffset(op, pos, f, ampMult = 1) {
  const off = op.latAmp * ampMult * Math.sin(Math.PI * clamp(f, 0, 1));
  if (off === 0) return pos;
  return offsetM(pos, Math.sin(op.latPerp) * off, Math.cos(op.latPerp) * off);
}

// ============================================================================
// Estado por frame de um operacional
// ============================================================================
// Devolve null quando está dentro do veículo/edifício; caso contrário
// { lat, lng, alpha, scale, carryKind, walking, running, heading }.
export function opStateAt(choreo, i, nowSec, success) {
  const op = choreo.ops[i];
  if (!op || nowSec < op.spawnAt || nowSec >= (op.boardEnd ?? choreo.deployEnd)) return null;

  const boardEnd = op.boardEnd ?? choreo.deployEnd;
  const inRamp = clamp((nowSec - op.spawnAt) / 0.6, 0, 1);
  const outRamp = clamp((boardEnd - nowSec) / 0.45, 0, 1);
  let alpha = Math.min(inRamp, outRamp);
  let scale = 0.45 + 0.55 * Math.min(inRamp, outRamp);
  if (alpha <= 0.01) return null;

  const stealthGhost = choreo.ghost ? 1 - choreo.ghost * (op.role === "ghostop" ? 0.82 : 0.5) : 1;
  let pos = null;
  let carryKind = null;
  let walking = false;
  let running = false;
  let heading = null;

  const faceTarget = toDeg(bearingRad(op.station, choreo.target));
  const withdrawStart = op.isRear ? (op.coverAt ?? op.walkBackAt) : op.walkBackAt;

  if (op.isScout && op.pRecon && nowSec < op.actionStart) {
    // ----- Reconhecimento do perímetro (batedor) -----
    if (nowSec < op.walkStart) {
      const d = idleDrift(op, nowSec, 0.4);
      pos = offsetM(op.holdPt, d.e, d.n);
      heading = lookHeading(op, faceTarget, nowSec, 70);
    } else {
      const t = clamp((nowSec - op.walkStart) / op.reconDur, 0, 1);
      const f = steppedEase(t);
      pos = pathAt(op.pRecon, f);
      walking = t > 0 && t < 1;
      heading = pathHeading(op.pRecon, f) ?? faceTarget;
    }
    alpha *= stealthGhost;
  } else if (nowSec < op.advanceAt) {
    // ----- À espera da ordem do líder, junto ao veículo -----
    const d = idleDrift(op, nowSec, 0.4);
    pos = offsetM(op.holdPt, d.e, d.n);
    heading = lookHeading(op, faceTarget, nowSec, 75);
    alpha *= stealthGhost;
  } else if (nowSec < op.actionStart) {
    // ----- Aproximação em formação (caminham; abrandam junto ao alvo) -----
    const t = clamp((nowSec - op.advanceAt) / op.walkInDur, 0, 1);
    const f = op.role === "ghostop" ? steppedEase(t) : hesitantEase(t, op.r1, op.r3, choreo.calm);
    pos = formationOffset(op, pathAt(op.pIn, f), f);
    walking = t > 0 && t < 1;
    heading = pathHeading(op.pIn, f) ?? faceTarget;
    alpha *= stealthGhost;
    if (op.role === "hacker" || op.role === "techaccess" || op.role === "negotiator") carryKind = "doc";
  } else if (nowSec < withdrawStart) {
    // ----- Execução (programa por papel; líder pode circular entre membros) -----
    let ev = null;
    if (op.roam && nowSec >= op.roam.start && nowSec < op.roam.until && op.roam.visits.length) {
      const cyc = op.roam.period;
      const el = nowSec - op.roam.start;
      const k = Math.floor(el / cyc) % op.roam.visits.length;
      const within = el % cyc;
      const v = op.roam.visits[k];
      const wd = op.roam.walkDur;
      const dwell = cyc * 0.32;
      if (within < wd) {
        ev = { pos: lerpPt(op.station, v, smooth(within / wd)), walking: true, heading: toDeg(bearingRad(op.station, v)) };
      } else if (within < wd + dwell) {
        ev = { pos: v, walking: false };
      } else if (within < 2 * wd + dwell) {
        ev = { pos: lerpPt(v, op.station, smooth((within - wd - dwell) / wd)), walking: true, heading: toDeg(bearingRad(v, op.station)) };
      } else {
        ev = { pos: op.station, walking: false };
      }
    } else {
      ev = programEval(choreo, op, nowSec);
    }
    pos = ev.pos;
    walking = !!ev.walking;
    running = !!ev.running;
    carryKind = typeof ev.carry === "string" ? ev.carry : null;
    alpha *= (1 - (ev.ghost || 0)) * stealthGhost;
    if (ev.ghost >= 1) return null; // dentro do edifício — invisível
    if (ev.heading != null) heading = ev.heading;
    else {
      const base = ev.faceOut
        ? toDeg(bearingRad(choreo.target, pos))
        : op.role === "negotiator" || op.role === "hacker" || op.role === "entry"
        ? faceTarget
        : op.faceBase ?? faceTarget;
      heading = lookHeading(op, base, nowSec, walking ? 20 : 55);
    }
    if (!walking && pos) {
      const d = idleDrift(op, nowSec);
      pos = offsetM(pos, d.e, d.n);
    }
  } else if (op.isRear) {
    // ----- Retaguarda: cobre a retirada, corre em último, confirma à porta -----
    const loot = success && choreo.lootOnExit ? "money" : null;
    if (nowSec < op.coverArrive) {
      const t = clamp((nowSec - op.coverAt) / op.coverDashDur, 0, 1);
      pos = pathAt(op.pCoverIn, smooth(t));
      running = true;
      walking = true;
      heading = pathHeading(op.pCoverIn, smooth(t)) ?? faceTarget;
    } else if (nowSec < op.coverUntil) {
      const d = idleDrift(op, nowSec, 0.35);
      pos = offsetM(op.coverPt, d.e, d.n);
      heading = lookHeading(op, toDeg(bearingRad(op.coverPt, choreo.target)), nowSec, 40);
      scale *= 0.94; // ligeiramente agachado, em cobertura
    } else if (nowSec < op.doorAt) {
      const t = clamp((nowSec - op.coverUntil) / Math.max(0.4, op.doorAt - op.coverUntil), 0, 1);
      pos = pathAt(op.pCoverOut, smooth(t));
      running = true;
      walking = true;
      heading = pathHeading(op.pCoverOut, smooth(t)) ?? (faceTarget + 180) % 360;
      carryKind = loot;
    } else {
      // confirmação visual: parado à porta, a varrer o perímetro
      const d = idleDrift(op, nowSec, 0.3);
      pos = offsetM(op.spawnPt, d.e, d.n);
      heading = toDeg(bearingRad(op.spawnPt, choreo.target)) + Math.sin(nowSec * 2.1) * 70;
      carryKind = loot;
    }
    alpha *= stealthGhost;
  } else {
    // ----- Retirada: corre para o ponto de reunião → espera → embarca -----
    const loot = success && choreo.lootOnExit ? "money" : op.role === "carrier" && success ? "box" : null;
    if (nowSec < op.rallyArrive) {
      const t = clamp((nowSec - op.walkBackAt) / op.runOutDur, 0, 1);
      if (op.role === "carrier") {
        pos = pathAt(op.pIn, (op.cargoF0 ?? 1) * (1 - smooth(t)));
        heading = pathHeading(op.pIn, (op.cargoF0 ?? 1) * (1 - smooth(t)));
        if (heading != null) heading = (heading + 180) % 360;
      } else {
        pos = formationOffset(op, pathAt(op.pOut, smooth(t)), t, 0.5);
        heading = pathHeading(op.pOut, smooth(t));
      }
      running = true;
      walking = true;
      carryKind = loot;
    } else if (nowSec < op.boardStart) {
      // reagrupamento junto ao veículo antes da fuga
      const d = idleDrift(op, nowSec, 0.4);
      pos = offsetM(op.rallyPt, d.e, d.n);
      heading = lookHeading(op, faceTarget, nowSec, 65);
      carryKind = loot;
    } else {
      const t = clamp((nowSec - op.boardStart) / Math.max(0.4, op.boardWalk || 1), 0, 1);
      pos = pathAt(op.pBoard, smooth(t));
      walking = t < 1;
      heading = pathHeading(op.pBoard, smooth(t));
      carryKind = loot;
    }
    alpha *= stealthGhost;
  }

  if (!pos) return null;
  return {
    lat: pos.lat, lng: pos.lng, alpha, scale,
    carry: !!carryKind, carryKind, walking, running,
    heading: heading == null ? null : ((heading % 360) + 360) % 360,
  };
}


// ============================================================================
// Primitivos genéricos partilhados — expostos para a camada de simulação de
// entidades (simCore.js). NÃO são específicos de missões: geometria local,
// caminhos a pé, easings de veículo e micro-comportamentos de personagens.
// A polícia (police.js) e futuras entidades especializam estes primitivos em
// vez de duplicar código.
// ============================================================================
export {
  clamp, smooth, lerpPt, bearingRad, toDeg, distMeters, ringPoint,
  walkPath, polyPath, pathAt, pathHeading,
  trapezoidEase, steppedEase, hesitantEase,
  idleDrift, lookHeading, spreadAngles, normAng,
};
