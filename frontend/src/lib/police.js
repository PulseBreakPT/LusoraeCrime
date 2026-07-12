// ============================================================================
// police.js — Força policial viva (especialização da camada simCore)
// ============================================================================
//
// Singleton fora do React: as patrulhas persistem entre mudanças de página e
// sobrevivem a refresh via snapshot em sessionStorage. Toda a IA é uma máquina
// de estados por patrulha; cada agente tem estado próprio (avaliado por frame
// com matemática pura, O(1), como os operacionais das missões).
//
// Máquina de estados da patrulha:
//   patrol → alerted → responding → arriving → onscene(desembarque/avaliação/
//   intervenção/embarque) → returning → patrol            (+ pursuit, offduty)
//
// Movimento contínuo: integração de velocidade por frame (aceleração,
// travagem, abrandamento em curva, paragem suave) ao longo de rotas OSRM
// reais — nunca teletransporta, nunca atualiza "de X em X segundos".
//
// Sincronização com o gameplay (100% visual, zero alteração de regras):
//   • missão com desfecho "police"  → intervenção da patrulha mais próxima
//   • chase_active no regresso      → perseguição real na rota da equipa
//   • risco/calor altos             → visita de "suspeita" (avaliar e retirar)
//   • calor do jogador              → mais patrulhas ativas no mapa

import {
  hashStr, mulberry32, clamp, smooth, lerpPt, bearingRad, toDeg, distMeters,
  ringPoint, walkPath, pathAt, pathHeading, idleDrift, lookHeading,
  vehicleTimings, buildParking, vehiclePoseAt, routeBearingDeg,
  fetchRoute, buildCumulative, pointOnRoute,
} from "./simCore";

// ---------------------------------------------------------------------------
// Configuração (tudo ajustável num sítio só)
// ---------------------------------------------------------------------------
export const POLICE_CONFIG = {
  maxPatrols: 12,
  heatPerExtraPatrol: 30,       // +1 patrulha por cada 30 de calor
  accel: 2.4,                   // m/s²
  brake: 3.4,                   // m/s²
  curbEaseDur: 2.2,             // s — manobra de encosto à berma
  officerWalk: 1.5,             // m/s a pé
  officerRun: 2.4,              // m/s em intervenção
  assessDurMin: 18,             // s no local numa visita de suspeita
  assessDurMax: 34,
  backupHeat: 60,               // calor a partir do qual há reforços
  backupRisk: 4,                // risco a partir do qual há reforços
  suspicionBase: 0.14,          // prob. base de visita de suspeita
  suspicionPerRisk: 0.055,
  suspicionPerHeat: 0.0022,
  suspicionCap: 0.62,
  pursuitLockM: 240,            // distância para "colar" à rota da equipa
  pursuitLagMinM: 110,          // nunca fica em cima da equipa
  routeThrottleMs: 650,         // 1 pedido OSRM de patrulha por 650ms (global)
};

// ---------------------------------------------------------------------------
// Forças de segurança — divisão real portuguesa (simplificada):
//   PSP  → zonas urbanas / centros das cidades: mais patrulhas, zonas
//          compactas, resposta mais rápida. Faixa AZUL.
//   GNR  → zonas rurais, vilas e estradas nacionais: menos patrulhas, áreas
//          muito maiores, resposta ligeiramente mais lenta mas cruzeiro de
//          estrada mais alto. Faixa VERDE.
// ---------------------------------------------------------------------------
// Força por omissão (fallthrough geográfico e fallback de segurança). GNR
// cobre tudo o que não é centro urbano — vilas, campo, estradas nacionais.
export const DEFAULT_FORCE = "GNR";

// Cada força é auto-descritiva: cor viva (color), cor do corpo da viatura
// (bodyColor), tinta clara dos agentes/labels (tint), rótulo do terreno
// (terrainLabel) e a frota (vehicles, com pesos). Acrescentar uma força nova
// (PJ, GOE, drones…) = mais uma entrada aqui + uma região em FORCE_REGIONS —
// nenhuma lógica hard-coded a "PSP"/"GNR" pelo meio.
export const FORCES = {
  PSP: {
    key: "PSP",
    label: "Polícia de Segurança Pública",
    color: "#3B82F6",
    bodyColor: "#1e3a8a",
    tint: "#93C5FD",
    terrainLabel: "urbana",
    zoneRadius: 620,        // m — perímetro urbano compacto
    patrolsPerZone: 2,      // presença reforçada no centro das cidades
    cruise: 9.0,            // m/s em patrulhamento (~32 km/h)
    cruiseVar: 3.5,
    responseCruise: 18.5,   // m/s a responder (~67 km/h) — resposta muito rápida
    pursuitCruise: 23,      // fecha depressa (perseguições curtas e rápidas)
    // Contraste de competência (o jogador tem de o SENTIR):
    responseReachM: 5000,   // cobertura compacta — só acode a ocorrências perto
    responseDelayS: 0,      // resposta imediata
    backupCount: 1,         // 1 reforço, mas chega depressa
    pursuitPersistent: false, // desiste se não fechar (curta e rápida)
    officersMin: 2,
    officersExtraChance: 0.5, // mais agentes a pé no cerco urbano
    vehicles: [
      { type: "carro", w: 6 },
      { type: "mota", w: 2 },
      { type: "carrinha", w: 1 },
    ],
  },
  GNR: {
    key: "GNR",
    label: "Guarda Nacional Republicana",
    color: "#22C55E",
    bodyColor: "#14532d",
    tint: "#86EFAC",
    terrainLabel: "rural",
    zoneRadius: 1250,       // m — posto territorial cobre uma área muito maior
    territorialRadius: 2600, // m — anel de estradas/periferia que a GNR ronda à
                             //     volta de qualquer cidade (cobertura ampla)
    patrolsPerZone: 1,      // menos patrulhas, mais terreno por viatura
    cruise: 10.5,           // m/s — cruzeiro de estrada nacional (~38 km/h)
    cruiseVar: 3.0,
    responseCruise: 14.5,   // m/s (~52 km/h) — resposta mais lenta a arrancar
    pursuitCruise: 20,      // interceção persistente (perseguições longas)
    responseReachM: 16000,  // cobertura vastíssima — acode a ocorrências longe
    responseDelayS: 4.5,    // tempo de resposta inicial superior
    backupCount: 2,         // chegam em maior número, mas mais tarde
    pursuitPersistent: true, // não desiste — interceta o veículo em fuga
    officersMin: 2,
    officersExtraChance: 0.2, // maioritariamente motorizada
    vehicles: [
      { type: "tt", w: 4 },        // todo-o-terreno — domina estradas e campo
      { type: "carro", w: 4 },
      { type: "mota", w: 2 },
      { type: "carrinha", w: 1 },
    ],
  },
};

// Rótulos pt-PT dos tipos de viatura (partilhados por todas as forças).
export const VEHICLE_TYPE_LABELS = {
  carro: "Carro-patrulha",
  mota: "Mota",
  carrinha: "Carrinha",
  tt: "Todo-o-terreno",
};

const forceCfg = (p) => FORCES[p?.force] || FORCES[DEFAULT_FORCE];

// Escolha ponderada de um tipo de viatura para uma força (determinística por rng).
function pickVehicleType(F, rng) {
  const opts = F.vehicles || [{ type: "carro", w: 1 }];
  const total = opts.reduce((a, o) => a + o.w, 0);
  let r = rng() * total;
  for (const o of opts) {
    r -= o.w;
    if (r <= 0) return o.type;
  }
  return opts[0].type;
}

// Regiões de competência por força. Um ponto dentro do raio `r` de uma região
// cai nessa força (a mais próxima ganha); fora de todas → DEFAULT_FORCE.
// Estrutura genérica (N forças): hoje só há regiões PSP (centros urbanos e
// capitais de distrito), com a GNR como omissão rural. Acrescentar regiões de
// outra força no futuro não exige mudar forceFor(). Espelho EXATO de
// POLICE_FORCE_REGIONS em backend/game_data.py — a classificação tem de ser
// idêntica dos dois lados.
const FORCE_REGIONS = [
  { force: "PSP", name: "Lisboa", lat: 38.7223, lng: -9.1393, r: 9500 },
  { force: "PSP", name: "Amadora", lat: 38.7597, lng: -9.2399, r: 3500 },
  { force: "PSP", name: "Cascais", lat: 38.6979, lng: -9.4215, r: 3500 },
  { force: "PSP", name: "Almada", lat: 38.68, lng: -9.1587, r: 3500 },
  { force: "PSP", name: "Porto", lat: 41.1496, lng: -8.6109, r: 7500 },
  { force: "PSP", name: "Vila Nova de Gaia", lat: 41.124, lng: -8.6118, r: 4500 },
  { force: "PSP", name: "Braga", lat: 41.5454, lng: -8.4265, r: 5000 },
  { force: "PSP", name: "Guimarães", lat: 41.4425, lng: -8.2918, r: 3500 },
  { force: "PSP", name: "Coimbra", lat: 40.2033, lng: -8.4103, r: 5000 },
  { force: "PSP", name: "Faro", lat: 37.0194, lng: -7.9304, r: 4000 },
  { force: "PSP", name: "Setúbal", lat: 38.5244, lng: -8.8882, r: 4500 },
  { force: "PSP", name: "Aveiro", lat: 40.6405, lng: -8.6538, r: 4000 },
  { force: "PSP", name: "Viseu", lat: 40.6566, lng: -7.9124, r: 3500 },
  { force: "PSP", name: "Leiria", lat: 39.7443, lng: -8.807, r: 3500 },
  { force: "PSP", name: "Évora", lat: 38.5714, lng: -7.9135, r: 3500 },
  { force: "PSP", name: "Santarém", lat: 39.2362, lng: -8.6868, r: 3000 },
  { force: "PSP", name: "Viana do Castelo", lat: 41.6946, lng: -8.8302, r: 3000 },
  { force: "PSP", name: "Vila Real", lat: 41.3006, lng: -7.7441, r: 3000 },
  { force: "PSP", name: "Bragança", lat: 41.8061, lng: -6.7567, r: 3000 },
  { force: "PSP", name: "Castelo Branco", lat: 39.8222, lng: -7.4931, r: 3000 },
  { force: "PSP", name: "Guarda", lat: 40.5373, lng: -7.2675, r: 3000 },
  { force: "PSP", name: "Portalegre", lat: 39.2967, lng: -7.4286, r: 2500 },
  { force: "PSP", name: "Beja", lat: 38.0151, lng: -7.8632, r: 3000 },
  { force: "PSP", name: "Funchal", lat: 32.6669, lng: -16.9241, r: 4500 },
  { force: "PSP", name: "Ponta Delgada", lat: 37.7412, lng: -25.6756, r: 3500 },
];

function forceFor(pt) {
  let best = null;
  let bd = Infinity;
  for (const c of FORCE_REGIONS) {
    const d = distMeters(pt, c);
    if (d <= c.r && d < bd) { bd = d; best = c; }
  }
  return best ? { force: best.force, city: best.name } : { force: DEFAULT_FORCE, city: null };
}

// ---------------------------------------------------------------------------
// Zonas de patrulhamento — DINÂMICAS: uma zona junto de cada ativo do jogador
// (Quartel-General + cada imóvel), onde quer que ele esteja no país. Ativos
// próximos partilham a mesma zona (merge). A força (PSP/GNR) e o raio vêm da
// localização real do ativo.
// ---------------------------------------------------------------------------
let ZONES = [];
let zonesSig = null;
let BOUNDS = { latMin: 38.688, latMax: 38.792, lngMin: -9.235, lngMax: -9.09 };

function assetsSignature(assets) {
  return (assets || [])
    .filter((a) => a && a.lat != null && a.lng != null)
    .map((a) => `${a.kind}:${a.lat.toFixed(4)},${a.lng.toFixed(4)}`)
    .sort()
    .join("|");
}

function buildZonesFromAssets(assets) {
  const zones = [];
  // Adiciona (ou funde com a mais próxima da MESMA força) uma zona. Ativos
  // encavalitados partilham a zona — as territoriais (GNR) fundem-se num raio
  // maior, refletindo a cobertura ampla de um posto sobre várias localidades.
  const pushZone = (a, force, radius, city, tag) => {
    const near = zones.find((z) => z.force === force &&
      distMeters(z, a) < Math.max(z.radius, radius) * 0.85);
    if (near) { near.weight += 1; return; }
    const coreName = a.name || (a.kind === "hq" ? "Quartel-General" : "Imóvel");
    zones.push({
      name: tag === "territorial" ? `Periferia${city ? " de " + city : ""}` : coreName,
      kind: a.kind,
      lat: a.lat,
      lng: a.lng,
      radius,
      force,
      city,
      tag,          // "core" (competência da zona) | "territorial" (periferia)
      weight: 1,
    });
  };
  for (const a of assets || []) {
    if (!a || a.lat == null || a.lng == null) continue;
    const cls = forceFor(a);
    const F = FORCES[cls.force];
    // Zona-núcleo: a força competente pela localização do ativo.
    pushZone(a, cls.force, F.zoneRadius, cls.city, "core");
    // Zona territorial: a força rural por omissão (GNR) patrulha SEMPRE o anel
    // de estradas/periferia à volta de uma base urbana. Sem isto, um jogador só
    // com bases na cidade nunca veria a GNR — mas ela ronda os acessos e a
    // periferia de qualquer centro urbano. Genérico: usa DEFAULT_FORCE, sem
    // hard-code a "GNR". Um ativo já em zona rural não precisa de companheira.
    if (cls.force !== DEFAULT_FORCE) {
      const G = FORCES[DEFAULT_FORCE];
      pushZone(a, DEFAULT_FORCE, G.territorialRadius || G.zoneRadius, cls.city, "territorial");
    }
  }
  return zones;
}

function computeBounds(zones) {
  if (!zones.length) return { latMin: 38.688, latMax: 38.792, lngMin: -9.235, lngMax: -9.09 };
  let latMin = Infinity, latMax = -Infinity, lngMin = Infinity, lngMax = -Infinity;
  for (const z of zones) {
    const dLat = (z.radius * 2.4) / 111320;
    const dLng = (z.radius * 2.4) / (111320 * Math.cos((z.lat * Math.PI) / 180));
    latMin = Math.min(latMin, z.lat - dLat);
    latMax = Math.max(latMax, z.lat + dLat);
    lngMin = Math.min(lngMin, z.lng - dLng);
    lngMax = Math.max(lngMax, z.lng + dLng);
  }
  return { latMin, latMax, lngMin, lngMax };
}

// Reconstrói as zonas quando os ativos mudam (compra de imóvel, outra conta).
// Patrulhas existentes são remapeadas para a zona mais próxima; as que ficam
// órfãs (outra cidade / força errada) saem do mapa.
function syncZones(ctx) {
  const sig = assetsSignature(ctx?.assets);
  if (sig === zonesSig) return false;
  zonesSig = sig;
  ZONES = buildZonesFromAssets(ctx?.assets || []);
  BOUNDS = computeBounds(ZONES);
  for (const p of sim.patrols) {
    if (!ZONES.length) { p._remove = true; continue; }
    // Remapeia para a zona mais próxima DA MESMA FORÇA (uma cidade tem a zona
    // PSP-núcleo e a GNR-territorial sobrepostas no centro; sem o filtro de
    // força a patrulha GNR seria erradamente atribuída à zona PSP e removida).
    let bi = -1;
    let bd = Infinity;
    ZONES.forEach((z, i) => {
      if (z.force !== p.force) return;
      const d = distMeters(p.pos, z);
      if (d < bd) { bd = d; bi = i; }
    });
    if (bi < 0 || bd > 5000) { p._remove = true; continue; }
    p.zoneIdx = bi;
    p.zone = ZONES[bi];
  }
  sim.patrols = sim.patrols.filter((p) => !p._remove);
  bump();
  return true;
}

export const PATROL_STATE_LABELS = {
  patrol: "Em patrulhamento",
  responding: "A responder à ocorrência",
  arriving: "A chegar ao local",
  onscene_assess: "A avaliar a situação",
  onscene_intervene: "Intervenção em curso",
  onscene_backup: "Reforço no local",
  pursuit: "Em perseguição",
  returning: "A regressar à zona",
  offduty: "A sair de serviço",
};

// ---------------------------------------------------------------------------
// Estado do módulo (singleton)
// ---------------------------------------------------------------------------
const sim = {
  inited: false,
  patrols: [],
  version: 0,          // muda quando a composição visível muda (frota/agentes)
  handled: new Map(),  // missionId -> { plan, patrolId, backupIds, done }
  missionGeo: new Map(),// missionId -> { parking } (rota/estacionamento da equipa)
  nextRouteAt: 0,      // throttle global de pedidos OSRM de patrulha
  nextId: 1,
  lastNowMs: 0,
  lastSaveAt: 0,
};

const SS_KEY = "lus:police:v2";

const bump = () => { sim.version++; };

// ---------------------------------------------------------------------------
// Persistência (mudança de página = singleton; refresh = sessionStorage)
// ---------------------------------------------------------------------------
function saveSnapshot(nowMs) {
  if (nowMs - sim.lastSaveAt < 4000) return;
  sim.lastSaveAt = nowMs;
  try {
    const patrols = sim.patrols.map((p) => ({
      id: p.id, seed: p.seed, zoneIdx: p.zoneIdx, officers: p.officers,
      lat: p.pos.lat, lng: p.pos.lng, bearing: p.bearing, vehicleType: p.vehicleType,
    }));
    const handled = [];
    for (const [mid, h] of sim.handled) if (h.done) handled.push(mid);
    sessionStorage.setItem(SS_KEY, JSON.stringify({ t: nowMs, sig: zonesSig, patrols, handled }));
  } catch (e) { /* storage cheio/indisponível — ignorar */ }
}

function loadSnapshot() {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.patrols)) return null;
    return data;
  } catch (e) { return null; }
}

// ---------------------------------------------------------------------------
// Criação de patrulhas
// ---------------------------------------------------------------------------
// Zona com maior défice de cobertura (PSP quer 2 viaturas/zona, GNR 1).
// Todas cobertas → reforços extra (calor) vão primeiro para zonas PSP,
// onde há "mais operações policiais".
function freeZoneIdx() {
  if (!ZONES.length) return 0;
  const counts = new Array(ZONES.length).fill(0);
  for (const p of sim.patrols) {
    if (p.state !== "offduty" && p.zoneIdx >= 0 && p.zoneIdx < ZONES.length) counts[p.zoneIdx]++;
  }
  let best = 0;
  let bestDef = -Infinity;
  ZONES.forEach((z, i) => {
    const def = FORCES[z.force].patrolsPerZone - counts[i];
    if (def > bestDef) { bestDef = def; best = i; }
  });
  if (bestDef > 0) return best;
  // Excedente de patrulhas: prefere as zonas da força de maior densidade
  // (mais presença onde a lei manda mais patrulhas por zona — hoje a PSP nos
  // centros urbanos, mas genérico para qualquer força que venha a ter a maior
  // patrolsPerZone).
  const maxDensity = Math.max(...ZONES.map((z) => FORCES[z.force]?.patrolsPerZone || 0));
  const dense = ZONES.map((z, i) => ({ z, i })).filter((x) => (FORCES[x.z.force]?.patrolsPerZone || 0) === maxDensity);
  const pool = dense.length ? dense : ZONES.map((z, i) => ({ z, i }));
  return pool[sim.patrols.length % pool.length].i;
}

function makePatrol({ zoneIdx, at, bearing, seed, officers, id, edgeSpawn }) {
  const zone = ZONES[zoneIdx] || ZONES[0] || { name: "—", lat: 38.7223, lng: -9.1393, radius: FORCES[DEFAULT_FORCE].zoneRadius, force: DEFAULT_FORCE };
  const F = FORCES[zone.force] || FORCES[DEFAULT_FORCE];
  const pid = id || `${zone.force}-${String(sim.nextId++).padStart(2, "0")}`;
  const s = seed ?? hashStr(pid + ":" + zoneIdx);
  const rng = mulberry32(s);
  const cruise = F.cruise + (rng() - 0.35) * F.cruiseVar;
  const p = {
    id: pid, seed: s, rng, zoneIdx, zone,
    force: zone.force,
    vehicleType: pickVehicleType(F, rng),
    officers: officers ?? (F.officersMin + (rng() < F.officersExtraChance ? 1 : 0)),
    pos: at || { lat: zone.lat, lng: zone.lng },
    bearing: bearing ?? rng() * 360,
    speed: 0,
    cruiseBase: clamp(cruise, 5.5, 14.5),
    state: edgeSpawn ? "returning" : "patrol",
    stateSince: 0,
    route: null,          // { latlngs, cum, total, dist, stopAt }
    routePending: false,
    pauseUntil: 0,
    lights: false,
    alert: null,          // { missionId, kind, target, backup, holdUntil }
    parking: null,        // manobra de encosto: { from, to, startSec, bearing }
    parkPos: null,
    parkBearing: null,
    deploy: null,         // coreografia dos agentes no local
    pursuit: null,        // { missionId, locked, lagM, blendFrom, blendT0 }
    spawnFade: 0,         // 0→1 no arranque (nunca "aparecer do nada")
  };
  return p;
}

// Ponto na periferia mais próximo de uma zona — patrulhas novas (subida de
// calor) entram a conduzir desde a periferia, nunca nascem no meio.
// Nota multi-cidade: com ativos em várias cidades os BOUNDS globais esticam
// (Lisboa+Porto = centenas de km); nesse caso a entrada é pela periferia
// LOCAL da zona (~2.5 raios do centro), nunca desde a outra ponta do país.
function edgePointNear(zone) {
  const cands = [
    { lat: BOUNDS.latMin, lng: zone.lng }, { lat: BOUNDS.latMax, lng: zone.lng },
    { lat: zone.lat, lng: BOUNDS.lngMin }, { lat: zone.lat, lng: BOUNDS.lngMax },
  ];
  let best = cands[0]; let bd = Infinity;
  for (const c of cands) {
    const d = distMeters(c, zone);
    if (d < bd) { bd = d; best = c; }
  }
  if (bd > zone.radius * 3) {
    return ringPoint(zone, bearingRad(zone, best), zone.radius * 2.5);
  }
  return best;
}

// ---------------------------------------------------------------------------
// Rotas — pedido com throttle global (patrulhamento) ou imediato (resposta)
// ---------------------------------------------------------------------------
function setRoute(p, info, endFrac = 1) {
  const cum = buildCumulative(info.latlngs);
  const total = cum[cum.length - 1] || 0;
  p.route = { latlngs: info.latlngs, cum, total, dist: 0, stopAt: total * clamp(endFrac, 0, 1) };
  p.routePending = false;
}

function requestRoute(p, to, { urgent = false, endFrac = 1, nowMs = 0 } = {}) {
  if (p.routePending) return;
  if (!urgent) {
    if (nowMs < sim.nextRouteAt) return; // volta a tentar no próximo tick
    sim.nextRouteAt = nowMs + POLICE_CONFIG.routeThrottleMs;
  }
  p.routePending = true;
  const from = { lat: p.pos.lat, lng: p.pos.lng };
  fetchRoute(from, to).then((info) => {
    // Estado pode ter mudado enquanto a rota chegava — só aplica se ainda faz sentido.
    if (!p.routePending) return;
    setRoute(p, info, endFrac);
  }).catch(() => { p.routePending = false; });
}

// Waypoint semi-aleatório de patrulhamento — maioritariamente dentro da zona,
// às vezes um desvio a um bairro vizinho, com regresso natural à zona.
function pickPatrolWaypoint(p) {
  const rng = p.rng;
  let center = p.zone;
  let radius = p.zone.radius;
  const distHome = distMeters(p.pos, p.zone);
  if (distHome > p.zone.radius * 1.6) {
    // Afastou-se demasiado — regressa à sua área.
    radius = p.zone.radius * 0.5;
  } else if (rng() < 0.16 && ZONES.length > 1) {
    // Desvio ocasional: zona vizinha (a mais próxima de 3 amostras) — a GNR
    // cobre as ligações entre zonas (estradas), a PSP raramente sai do centro.
    let best = null; let bd = Infinity;
    for (let k = 0; k < 3; k++) {
      const z = ZONES[Math.floor(rng() * ZONES.length)];
      const d = distMeters(p.zone, z);
      if (d > 1 && d < bd) { bd = d; best = z; }
    }
    // Zonas noutra cidade (>12 km) não são desvio plausível de patrulhamento.
    if (best && bd < 12000) { center = best; radius = best.radius * 0.6; }
  }
  const ang = rng() * Math.PI * 2;
  const dist = radius * (0.3 + 0.7 * rng());
  const pt = ringPoint(center, ang, dist);
  return {
    lat: clamp(pt.lat, BOUNDS.latMin, BOUNDS.latMax),
    lng: clamp(pt.lng, BOUNDS.lngMin, BOUNDS.lngMax),
  };
}

// ---------------------------------------------------------------------------
// Cinemática — integração por frame com aceleração/travagem/curvas
// ---------------------------------------------------------------------------
function driveStep(p, dt, cruise) {
  const r = p.route;
  if (!r || r.total <= 0) {
    p.speed = Math.max(0, p.speed - POLICE_CONFIG.brake * dt);
    return false;
  }
  const remaining = Math.max(0, r.stopAt - r.dist);
  // Velocidade máxima que ainda permite travar a tempo (v² = 2·a·d).
  const stopSpeed = Math.sqrt(2 * POLICE_CONFIG.brake * Math.max(0, remaining - 1.2));
  let vT = Math.min(cruise, stopSpeed);
  // Abrandamento em curva: rumo agora vs ~16m à frente.
  const f = clamp(r.dist / r.total, 0, 1);
  const b0 = routeBearingDeg(r.latlngs, r.cum, f, 1);
  const b1 = routeBearingDeg(r.latlngs, r.cum, clamp((r.dist + 16) / r.total, 0, 1), 1);
  if (b0 != null && b1 != null) {
    const dAng = Math.abs(((b1 - b0 + 540) % 360) - 180);
    if (dAng > 50) vT = Math.min(vT, 3.8);
    else if (dAng > 24) vT = Math.min(vT, 6.8);
  }
  if (p.speed < vT) p.speed = Math.min(vT, p.speed + POLICE_CONFIG.accel * dt);
  else p.speed = Math.max(vT, p.speed - POLICE_CONFIG.brake * dt);
  r.dist = Math.min(r.stopAt, r.dist + p.speed * dt);
  const ff = clamp(r.dist / r.total, 0, 1);
  const pt = pointOnRoute(r.latlngs, r.cum, ff);
  if (pt) p.pos = pt;
  const b = routeBearingDeg(r.latlngs, r.cum, ff, 1);
  if (b != null) p.bearing = ((b % 360) + 360) % 360;
  return r.dist >= r.stopAt - 0.5 && p.speed < 0.7;
}

// ---------------------------------------------------------------------------
// Director — decide respostas a operações (suspeita/interceção/perseguição)
// ---------------------------------------------------------------------------
function missionPlan(m, heat) {
  const rng = mulberry32(hashStr(String(m.id) + ":pol"));
  const risk = m.opportunity?.risk ?? 3;
  const vt = vehicleTimings(m);
  const W = Math.max(4, vt.finish - vt.arrive);
  if (m.outcome === "police") {
    return {
      kind: "intervene",
      alertAt: vt.arrive + Math.min(18, W * 0.12),
      holdUntil: vt.finish + 7,
      backup: risk >= POLICE_CONFIG.backupRisk || heat >= POLICE_CONFIG.backupHeat,
    };
  }
  const prob = clamp(
    POLICE_CONFIG.suspicionBase + risk * POLICE_CONFIG.suspicionPerRisk + heat * POLICE_CONFIG.suspicionPerHeat,
    0, POLICE_CONFIG.suspicionCap,
  );
  if (rng() < prob) {
    return { kind: "assess", alertAt: vt.arrive + W * (0.18 + rng() * 0.35), holdUntil: 0, backup: false };
  }
  return null;
}

// Força competente pela zona de uma missão: da etiqueta police_force gravada
// pelo servidor (autoritativa), ou classificada pela posição do alvo para
// missões anteriores à feature.
function missionForce(m) {
  return m?.opportunity?.police_force || forceFor(m.target).force;
}

// Patrulha livre mais próxima DENTRO do raio de resposta plausível — com
// ativos em várias cidades, uma viatura do Porto nunca "responde" a uma
// ocorrência em Lisboa (se ninguém está a alcance, não há resposta visível).
//
// Divisão de competências: quando `preferForce` é indicado, responde PRIMEIRO
// a força responsável pela zona; só se nenhuma patrulha dessa força estiver a
// alcance é que a outra força apoia (escalada). Assim uma ocorrência urbana
// chama a PSP e uma rural chama a GNR, como na realidade.
function nearestFreePatrol(target, opts = {}) {
  const { excludeId, excludeIds, maxDistM = 15000, preferForce = null } = opts;
  const pick = (forceFilter) => {
    let best = null; let bd = Infinity;
    for (const p of sim.patrols) {
      if (p.id === excludeId) continue;
      if (excludeIds && excludeIds.includes(p.id)) continue;
      if (p.state !== "patrol" && p.state !== "returning") continue;
      if (forceFilter && p.force !== forceFilter) continue;
      const d = distMeters(p.pos, target);
      if (d > maxDistM) continue;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  if (preferForce) return pick(preferForce) || pick(null);
  return pick(null);
}

function assignResponse(p, m, plan, backupRole, nowMs) {
  p.state = "responding";
  p.stateSince = nowMs / 1000;
  p.lights = true;
  p.pauseUntil = 0;
  p.parking = null;
  p.deploy = null;
  p.alert = {
    missionId: m.id,
    missionName: m.opportunity?.name || "Ocorrência",
    kind: backupRole ? "backup" : plan.kind,
    target: { lat: m.target.lat, lng: m.target.lng },
    holdUntil: plan.holdUntil,
    backup: plan.backup && !backupRole,
  };
  p.route = null;
  p.routePending = true;
  const from = { lat: p.pos.lat, lng: p.pos.lng };
  fetchRoute(from, p.alert.target).then((info) => {
    if (p.alert?.missionId !== m.id || !p.routePending) return;
    // Estacionamento credível reutilizando o motor das missões: recuo 25–50m
    // + encosto à berma, seed própria por patrulha+missão (variação procedural).
    const parking = buildParking({ id: `${p.id}:${m.id}`, target: p.alert.target, origin: from }, info);
    p.respParking = parking;
    setRoute(p, info, parking.parkFrac);
  }).catch(() => { p.routePending = false; });
  bump();
}

function director(nowMs, ctx) {
  const nowSec = nowMs / 1000;
  const missions = ctx.missions || [];
  const missionIds = new Set(missions.map((m) => m.id));

  for (const m of missions) {
    if (!m?.target || !m?.arrive_at) continue;
    let h = sim.handled.get(m.id);
    if (!h) {
      h = { plan: missionPlan(m, ctx.heat || 0), patrolId: null, backupIds: [], lastBackupAt: 0, pursuitId: null, done: false };
      sim.handled.set(m.id, h);
    }
    const vt = vehicleTimings(m);

    const zoneForce = missionForce(m);

    // ---- Perseguição no regresso (chase_active vem do servidor) ----
    if (m.chase_active && nowSec >= vt.finish && nowSec < vt.ret && !h.pursuitId) {
      const p = nearestFreePatrol(m.target, { preferForce: zoneForce });
      if (p) {
        h.pursuitId = p.id;
        p.state = "pursuit";
        p.stateSince = nowSec;
        p.lights = true;
        p.deploy = null;
        p.parking = null;
        p.pursuit = { missionId: m.id, missionName: m.opportunity?.name, locked: false, lagM: 0, lastRefetch: 0, blend: null, startSec: nowSec };
        p.route = null;
        p.routePending = false;
        bump();
      }
    }

    // ---- Resposta a suspeita/interceção ----
    const plan = h.plan;
    const zoneCfg = FORCES[zoneForce] || FORCES[DEFAULT_FORCE];
    // Competência sentida: a PSP responde de imediato mas só a curto alcance
    // (cobertura compacta); a GNR demora mais a arrancar mas acode de muito
    // mais longe (cobertura territorial vasta).
    const respDelay = zoneCfg.responseDelayS || 0;
    const respReach = zoneCfg.responseReachM ?? 15000;
    if (plan && !h.done && !h.patrolId && nowSec >= plan.alertAt + respDelay && nowSec < vt.finish - 4) {
      // A força responsável pela zona responde primeiro (escala para a outra
      // se não houver ninguém dessa força a alcance).
      const p = nearestFreePatrol(m.target, { preferForce: zoneForce, maxDistM: respReach });
      if (p) {
        h.patrolId = p.id;
        assignResponse(p, m, plan, false, nowMs);
      }
    }
    // ---- Reforços: vindos da sua posição real. A PSP manda 1 reforço rápido;
    // a GNR chega em maior número, mas escalonada (mais tarde) — cada patrulha
    // adicional entra com um intervalo, refletindo "mais efetivo, mais lento".
    if (plan && plan.backup && h.patrolId) {
      const primary = sim.patrols.find((x) => x.id === h.patrolId);
      const primCfg = FORCES[primary?.force] || FORCES[DEFAULT_FORCE];
      const wantBackup = primCfg.backupCount ?? 1;
      const backupGap = primCfg.responseDelayS ? 4.5 : 2.5; // GNR escalona mais
      if (primary && primary.state.startsWith("onscene") && nowSec < vt.finish &&
          h.backupIds.length < wantBackup && nowSec - h.lastBackupAt >= backupGap) {
        const p2 = nearestFreePatrol(m.target, {
          excludeIds: [h.patrolId, ...h.backupIds], preferForce: primary.force, maxDistM: respReach,
        });
        if (p2) {
          h.backupIds.push(p2.id);
          h.lastBackupAt = nowSec;
          assignResponse(p2, m, plan, true, nowMs);
        }
      }
    }
  }

  // Missões que desapareceram do estado → patrulhas afetas retiram/regressam.
  for (const p of sim.patrols) {
    if (p.alert && !missionIds.has(p.alert.missionId)) {
      if (p.deploy) expediteDeployment(p, nowSec);
      else breakOff(p, nowSec);
    }
    if (p.pursuit && !missionIds.has(p.pursuit.missionId)) breakOff(p, nowSec);
  }
  // Limpeza do handled para missões extintas.
  for (const mid of Array.from(sim.handled.keys())) {
    if (!missionIds.has(mid)) {
      const h = sim.handled.get(mid);
      if (h) { h.done = true; }
      if (sim.handled.size > 60) sim.handled.delete(mid);
    }
  }
}

function breakOff(p, nowSec) {
  p.alert = null;
  p.pursuit = null;
  p.deploy = null;
  p.parking = null;
  p.respParking = null;
  p.lights = false;
  p.route = null;
  p.routePending = false;
  p.state = "returning";
  p.stateSince = nowSec;
  bump();
}

// ---------------------------------------------------------------------------
// Desembarque/perímetro/embarque — coreografia dos agentes (reutiliza os
// primitivos das missões: walkPath, ringPoint, idleDrift, lookHeading)
// ---------------------------------------------------------------------------
function buildDeployment(p, nowSec) {
  const rng = mulberry32(hashStr(`${p.id}:${p.alert.missionId}:dep`));
  const target = p.alert.target;
  const park = p.parkPos;
  const kind = p.alert.kind;
  const approach = bearingRad(park, target);
  const street = approach + Math.PI;
  const n = clamp(p.officers, 1, 4);
  const dPT = Math.max(6, distMeters(park, target));
  const radScale = clamp(dPT / 26, 0.7, 1.4);
  const intervene = kind === "intervene";
  const walkSpeed = (intervene ? POLICE_CONFIG.officerRun : POLICE_CONFIG.officerWalk);

  // Cerco: um agente cobre a entrada, outro a retaguarda, outro aproxima-se
  // do alvo (intervenção) ou vigia um flanco (avaliação). Reforço: perímetro
  // mais largo, acessos opostos.
  const spread = kind === "backup" ? Math.PI * 0.9 : 0;
  const bearings = [
    street + spread + (rng() - 0.5) * 0.5,
    street + Math.PI + spread * 0.5 + (rng() - 0.5) * 0.7,
    street + (rng() < 0.5 ? 1 : -1) * 1.5 + (rng() - 0.5) * 0.4,
    street + (rng() < 0.5 ? 1 : -1) * 2.4 + (rng() - 0.5) * 0.4,
  ];
  const radii = [
    (kind === "backup" ? 12 : 7 + rng() * 3) * radScale,
    (8 + rng() * 3) * radScale,
    intervene ? 3.2 * radScale : (9 + rng() * 3) * radScale,
    (10 + rng() * 3) * radScale,
  ];

  const doorsOpenAt = nowSec + 0.5;
  const ops = [];
  let lastSpawn = doorsOpenAt;
  let lastArrive = nowSec;
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const spawnPt = ringPoint(park, approach + (side * Math.PI) / 2, 1.8);
    const station = ringPoint(target, bearings[i % bearings.length], Math.max(2.4, radii[i % radii.length]));
    const bulge = (rng() - 0.5) * 2 * clamp(dPT * 0.16, 2.5, 10);
    const pIn = walkPath(spawnPt, station, bulge);
    const pOut = walkPath(station, spawnPt, -bulge * 0.8);
    const spawnAt = doorsOpenAt + 0.35 + i * (0.8 + rng() * 0.45);
    const advanceAt = spawnAt + 0.5 + rng() * 0.7;
    const walkDur = clamp(pIn.length / (walkSpeed * (0.9 + rng() * 0.25)), 1.2, 30);
    lastSpawn = Math.max(lastSpawn, spawnAt);
    lastArrive = Math.max(lastArrive, advanceAt + walkDur);
    ops.push({
      spawnPt, station, pIn, pOut, spawnAt, advanceAt, walkDur,
      // agente 1 (retaguarda) vigia para fora; os restantes viram-se ao alvo
      faceBase: i === 1 ? toDeg(bearingRad(target, station)) : toDeg(bearingRad(station, target)),
      run: intervene,
      dw1: (2 * Math.PI) / (4.2 + rng() * 3.2), dp1: rng() * 6.28,
      dw2: (2 * Math.PI) / (6.5 + rng() * 3.5), dp2: rng() * 6.28,
      lookP: 2.8 + rng() * 2.8, lookPhase: rng() * 20, lookSeed: rng() * 97.3,
    });
  }

  const holdBase = kind === "assess"
    ? POLICE_CONFIG.assessDurMin + rng() * (POLICE_CONFIG.assessDurMax - POLICE_CONFIG.assessDurMin)
    : 10;
  let holdEnd = lastArrive + holdBase;
  if ((intervene || kind === "backup") && p.alert.holdUntil) holdEnd = Math.max(holdEnd, p.alert.holdUntil);

  let boardEndMax = holdEnd;
  ops.forEach((op, i) => {
    op.walkBackAt = holdEnd + i * (0.7 + rng() * 0.5);
    op.backDur = clamp(op.pOut.length / (POLICE_CONFIG.officerWalk * 1.15), 1, 26);
    op.boardAt = op.walkBackAt + op.backDur;
    op.boardEnd = op.boardAt + 0.6;
    boardEndMax = Math.max(boardEndMax, op.boardEnd);
  });
  // O veículo só parte depois de TODOS os agentes embarcarem (validação de
  // ocupantes) + portas fechadas.
  const departAt = boardEndMax + 1.3 + rng() * 1.4;

  // Comunicações: chegada ao local, pedido de reforços (se aplicável),
  // confirmação antes da retirada.
  const comms = [{ at: ops[0].advanceAt + ops[0].walkDur * 0.55, dur: 2.6, officer: 0, label: "No local" }];
  if (p.alert.backup) comms.push({ at: lastArrive + 2.5, dur: 3.4, officer: 0, label: "A pedir reforços", backup: true });
  comms.push({ at: Math.max(holdEnd - 2.4, lastArrive + 1), dur: 2.2, officer: n - 1, label: "Confirmação" });
  comms.sort((a, b) => a.at - b.at);

  return {
    ops, comms, target, park, kind,
    doorsOpenAt,
    doorsCloseExitAt: lastSpawn + 1.6,
    boardDoorsOpenAt: holdEnd - 0.4,
    doorsFinalCloseAt: boardEndMax + 0.7,
    holdEnd, departAt,
  };
}

// Missão terminou mais cedo → encurta a permanência e manda os agentes de
// volta já (recalcula a agenda de retirada a partir de agora).
function expediteDeployment(p, nowSec) {
  const dep = p.deploy;
  if (!dep || nowSec >= dep.holdEnd) return;
  const shift = dep.holdEnd - (nowSec + 1.2);
  if (shift <= 0) return;
  dep.holdEnd -= shift;
  dep.boardDoorsOpenAt -= shift;
  dep.doorsFinalCloseAt -= shift;
  dep.departAt -= shift;
  for (const op of dep.ops) {
    op.walkBackAt -= shift;
    op.boardAt -= shift;
    op.boardEnd -= shift;
  }
}

// Estado por frame de um agente (null = dentro do carro).
export function officerStateAt(dep, i, nowSec) {
  const op = dep.ops[i];
  if (!op || nowSec < op.spawnAt || nowSec >= op.boardEnd) return null;
  const inRamp = clamp((nowSec - op.spawnAt) / 0.6, 0, 1);
  const outRamp = clamp((op.boardEnd - nowSec) / 0.45, 0, 1);
  const alpha = Math.min(inRamp, outRamp);
  if (alpha <= 0.01) return null;
  const scale = 0.45 + 0.55 * alpha;
  let pos = null;
  let walking = false;
  let running = false;
  let heading = null;

  if (nowSec < op.advanceAt) {
    const d = idleDrift(op, nowSec, 0.35);
    pos = { lat: op.spawnPt.lat + d.n / 111320, lng: op.spawnPt.lng + d.e / (111320 * Math.cos((op.spawnPt.lat * Math.PI) / 180)) };
    heading = lookHeading(op, toDeg(bearingRad(op.spawnPt, dep.target)), nowSec, 60);
  } else if (nowSec < op.advanceAt + op.walkDur) {
    const t = clamp((nowSec - op.advanceAt) / op.walkDur, 0, 1);
    const f = smooth(t);
    pos = pathAt(op.pIn, f);
    walking = true;
    running = !!op.run;
    heading = pathHeading(op.pIn, f) ?? op.faceBase;
  } else if (nowSec < op.walkBackAt) {
    const d = idleDrift(op, nowSec, 0.5);
    pos = { lat: op.station.lat + d.n / 111320, lng: op.station.lng + d.e / (111320 * Math.cos((op.station.lat * Math.PI) / 180)) };
    heading = lookHeading(op, op.faceBase, nowSec, 55);
  } else if (nowSec < op.boardAt) {
    const t = clamp((nowSec - op.walkBackAt) / op.backDur, 0, 1);
    const f = smooth(t);
    pos = pathAt(op.pOut, f);
    walking = true;
    heading = pathHeading(op.pOut, f);
  } else {
    pos = op.spawnPt;
  }
  if (!pos) return null;
  return {
    lat: pos.lat, lng: pos.lng, alpha, scale, walking, running,
    heading: heading == null ? null : ((heading % 360) + 360) % 360,
  };
}

// Comunicação ativa num instante (ou null) — mesma semântica de commAt().
export function deployCommAt(dep, nowSec) {
  if (!dep?.comms) return null;
  for (const c of dep.comms) {
    if (nowSec >= c.at && nowSec < c.at + c.dur) return c;
    if (c.at > nowSec) break;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Perseguição — cola-se à rota real da equipa (rota OSRM já em cache) e segue
// atrás com um intervalo que encurta; nunca teletransporta (blend na entrada).
// ---------------------------------------------------------------------------
function missionGeoFor(m) {
  let g = sim.missionGeo.get(m.id);
  if (!g) {
    g = { parking: null, pending: true };
    sim.missionGeo.set(m.id, g);
    fetchRoute(m.origin, m.target).then((info) => {
      g.parking = buildParking(m, info); // mesma seed da MissionUnit → mesma geometria
      g.pending = false;
    }).catch(() => { g.pending = false; });
    if (sim.missionGeo.size > 40) {
      const first = sim.missionGeo.keys().next().value;
      sim.missionGeo.delete(first);
    }
  }
  return g;
}

function pursuitStep(p, m, nowMs, dt) {
  const nowSec = nowMs / 1000;
  const geo = missionGeoFor(m);
  const pose = geo.parking ? vehiclePoseAt(m, geo.parking, nowMs) : null;
  if (!pose || pose.phase === "done") { breakOff(p, nowSec); return; }
  const teamPos = { lat: pose.lat, lng: pose.lng };
  const gap = distMeters(p.pos, teamPos);

  if (!p.pursuit.locked) {
    // Contraste de força: a PSP faz perseguições curtas e rápidas — se não
    // fechar a interceção em ~15s (fugitivo já longe), abandona. A GNR é
    // persistente (pursuitPersistent) e nunca larga até intercetar.
    if (!forceCfg(p).pursuitPersistent &&
        nowSec - (p.pursuit.startSec || nowSec) > 15 && gap > POLICE_CONFIG.pursuitLockM * 1.4) {
      breakOff(p, nowSec);
      return;
    }
    // Fase de interceção: conduz até à posição atual da equipa, re-planeando
    // a rota quando ela foge do destino anterior.
    if (gap < POLICE_CONFIG.pursuitLockM && geo.parking) {
      p.pursuit.locked = true;
      p.pursuit.lagM = Math.max(POLICE_CONFIG.pursuitLagMinM, gap);
      p.pursuit.blend = { from: { ...p.pos }, t0: nowSec, dur: 1.6 };
      p.route = null;
      p.routePending = false;
      return;
    }
    const needRoute = !p.route && !p.routePending;
    const stale = p.route && (nowSec - (p.pursuit.lastRefetch || 0) > 9) &&
      distMeters(teamPos, pointOnRoute(p.route.latlngs, p.route.cum, 1) || teamPos) > 200;
    if (needRoute || stale) {
      p.pursuit.lastRefetch = nowSec;
      p.routePending = true;
      fetchRoute({ ...p.pos }, teamPos).then((info) => {
        if (p.state !== "pursuit" || !p.routePending) return;
        setRoute(p, info, 1);
      }).catch(() => { p.routePending = false; });
    }
    driveStep(p, dt, forceCfg(p).pursuitCruise);
    return;
  }

  // Colado à rota da equipa: mesma polyline, fração atrás com lag decrescente.
  const pk = geo.parking;
  p.pursuit.lagM = Math.max(POLICE_CONFIG.pursuitLagMinM, p.pursuit.lagM - 5 * dt);
  const total = pk.total || 1;
  const chaseFrac = clamp((pose.frac ?? 0) + p.pursuit.lagM / total, 0, pk.parkFrac ?? 1);
  const onRoute = pointOnRoute(pk.latlngs, pk.cum, chaseFrac);
  if (!onRoute) return;
  let target = onRoute;
  const blend = p.pursuit.blend;
  if (blend) {
    const bt = clamp((nowSec - blend.t0) / blend.dur, 0, 1);
    target = lerpPt(blend.from, onRoute, smooth(bt));
    if (bt >= 1) p.pursuit.blend = null;
  }
  p.pos = target;
  p.speed = forceCfg(p).pursuitCruise;
  const b = routeBearingDeg(pk.latlngs, pk.cum, chaseFrac, -1);
  if (b != null) p.bearing = ((b % 360) + 360) % 360;
}

// ---------------------------------------------------------------------------
// FSM por patrulha
// ---------------------------------------------------------------------------
function patrolStep(p, nowMs, dt, ctx) {
  const nowSec = nowMs / 1000;
  if (p.spawnFade < 1) p.spawnFade = Math.min(1, p.spawnFade + dt / 1.4);

  switch (p.state) {
    case "patrol":
    case "returning": {
      if (nowSec < p.pauseUntil) { p.speed = 0; return; }
      if (!p.route && !p.routePending) {
        const wp = p.state === "returning"
          ? ringPoint(p.zone, p.rng() * Math.PI * 2, p.zone.radius * (0.2 + 0.5 * p.rng()))
          : pickPatrolWaypoint(p);
        requestRoute(p, wp, { nowMs });
        return;
      }
      const arrived = driveStep(p, dt, p.cruiseBase * (p.state === "returning" ? 1.15 : 1));
      if (arrived) {
        p.route = null;
        if (p.state === "returning") {
          p.state = "patrol";
          p.stateSince = nowSec;
          p.lights = false;
          bump();
        }
        // Paragem ocasional na esquina (seeded) — patrulhamento não repetitivo.
        p.pauseUntil = p.rng() < 0.45 ? nowSec + 1.5 + p.rng() * 5.5 : 0;
      }
      return;
    }

    case "responding": {
      if (!p.route) { p.speed = Math.max(0, p.speed - POLICE_CONFIG.brake * dt); return; }
      const arrived = driveStep(p, dt, forceCfg(p).responseCruise);
      if (arrived && p.respParking) {
        // Manobra de encosto à berma (reutiliza a geometria de buildParking).
        p.state = "arriving";
        p.stateSince = nowSec;
        p.parking = {
          from: { ...p.pos },
          to: p.respParking.repark ? p.respParking.park2 : p.respParking.park,
          t0: nowSec,
          dur: POLICE_CONFIG.curbEaseDur,
          bearing: toDeg(p.respParking.streetBearingRad ?? 0),
        };
        bump();
      } else if (arrived) {
        breakOff(p, nowSec);
      }
      return;
    }

    case "arriving": {
      const pk = p.parking;
      if (!pk) { breakOff(p, nowSec); return; }
      const t = clamp((nowSec - pk.t0) / pk.dur, 0, 1);
      p.pos = lerpPt(pk.from, pk.to, smooth(t));
      p.speed = 0;
      p.bearing = pk.bearing;
      if (t >= 1) {
        p.parkPos = pk.to;
        p.parkBearing = pk.bearing;
        p.deploy = buildDeployment(p, nowSec);
        p.state = p.alert.kind === "intervene" ? "onscene_intervene" : p.alert.kind === "backup" ? "onscene_backup" : "onscene_assess";
        p.stateSince = nowSec;
        if (p.alert.kind === "assess") p.lights = false; // avaliação discreta
        bump();
      }
      return;
    }

    case "onscene_assess":
    case "onscene_intervene":
    case "onscene_backup": {
      // Veículo imóvel no estacionamento; agentes avaliados por frame no layer.
      p.pos = p.parkPos || p.pos;
      p.speed = 0;
      if (p.parkBearing != null) p.bearing = p.parkBearing;
      if (p.deploy && nowSec >= p.deploy.departAt) {
        const h = sim.handled.get(p.alert?.missionId);
        if (h && p.alert.kind !== "backup") h.done = true;
        breakOff(p, nowSec);
      }
      return;
    }

    case "pursuit": {
      const m = (ctx.missions || []).find((x) => x.id === p.pursuit?.missionId);
      if (!m || !m.chase_active) { breakOff(p, nowSec); return; }
      pursuitStep(p, m, nowMs, dt);
      return;
    }

    case "offduty": {
      if (!p.route && !p.routePending) {
        requestRoute(p, edgePointNear(p.zone), { nowMs });
        return;
      }
      const arrived = driveStep(p, dt, p.cruiseBase * 1.2);
      if (arrived) p._remove = true;
      return;
    }

    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Frota — nº desejado deriva das zonas (PSP 2/zona, GNR 1/zona) e escala com
// o calor; entradas pela periferia
// ---------------------------------------------------------------------------
export function desiredPatrolCount(heat) {
  if (!ZONES.length) return 0;
  const base = ZONES.reduce((n, z) => n + FORCES[z.force].patrolsPerZone, 0);
  const cap = Math.min(POLICE_CONFIG.maxPatrols, base + 4);
  return clamp(base + Math.floor((heat || 0) / POLICE_CONFIG.heatPerExtraPatrol), Math.min(base, cap), cap);
}

function reconcileFleet(nowMs, ctx) {
  const want = desiredPatrolCount(ctx.heat || 0);
  const active = sim.patrols.filter((p) => p.state !== "offduty");
  if (active.length < want && ZONES.length) {
    const zoneIdx = freeZoneIdx();
    const zone = ZONES[zoneIdx];
    const p = makePatrol({ zoneIdx, at: edgePointNear(zone), edgeSpawn: true });
    p.stateSince = nowMs / 1000;
    sim.patrols.push(p);
    bump();
  } else if (active.length > want) {
    // Retira a patrulha livre mais periférica — conduz até à borda e sai.
    const candidates = active.filter((p) => p.state === "patrol");
    if (candidates.length) {
      const p = candidates[candidates.length - 1];
      p.state = "offduty";
      p.route = null;
      p.routePending = false;
      p.lights = false;
      bump();
    }
  }
  const before = sim.patrols.length;
  sim.patrols = sim.patrols.filter((p) => !p._remove);
  if (sim.patrols.length !== before) bump();
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------
export function ensurePoliceSim(ctx) {
  if (sim.inited) return;
  sim.inited = true;
  syncZones(ctx);
  const snap = loadSnapshot();
  const want = desiredPatrolCount(ctx?.heat || 0);
  // Snapshot só é válido se as zonas forem as MESMAS (mesma conta/ativos) —
  // caso contrário as patrulhas renasceriam na cidade errada.
  if (snap?.patrols?.length && snap.sig === zonesSig && ZONES.length) {
    for (const s of snap.patrols.slice(0, POLICE_CONFIG.maxPatrols)) {
      const p = makePatrol({
        id: s.id, seed: s.seed, zoneIdx: clamp(s.zoneIdx, 0, ZONES.length - 1),
        at: { lat: s.lat, lng: s.lng }, bearing: s.bearing, officers: s.officers,
      });
      if (s.vehicleType) p.vehicleType = s.vehicleType;
      p.spawnFade = 1; // já existiam — sem fade
      sim.patrols.push(p);
      const num = parseInt(String(s.id).replace(/\D/g, ""), 10);
      if (!Number.isNaN(num)) sim.nextId = Math.max(sim.nextId, num + 1);
    }
    for (const mid of snap.handled || []) sim.handled.set(mid, { plan: null, done: true });
  }
  while (sim.patrols.length < want && ZONES.length) {
    const zoneIdx = freeZoneIdx();
    const zone = ZONES[zoneIdx];
    const rng = mulberry32(hashStr("spawn:" + zoneIdx + ":" + sim.patrols.length));
    // Arranque inicial: nascem espalhadas dentro da sua zona (mapa a carregar),
    // com fade-in suave.
    const at = ringPoint(zone, rng() * Math.PI * 2, zone.radius * (0.2 + 0.6 * rng()));
    sim.patrols.push(makePatrol({ zoneIdx, at }));
  }
  bump();
}

// Tick global — devolve true quando a composição visível mudou (re-render React).
export function policeTick(nowMs, dt, ctx) {
  if (!sim.inited) ensurePoliceSim(ctx);
  const v0 = sim.version;
  syncZones(ctx);
  reconcileFleet(nowMs, ctx);
  director(nowMs, ctx);
  for (const p of sim.patrols) patrolStep(p, nowMs, dt, ctx);
  saveSnapshot(nowMs);
  sim.lastNowMs = nowMs;
  return sim.version !== v0;
}

export function getPatrols() {
  return sim.patrols;
}

// Zonas de patrulhamento atuais (para desenhar os perímetros no mapa).
export function getPatrolZones() {
  return ZONES;
}

export function getPoliceVersion() {
  return sim.version;
}

export function patrolStateLabel(p) {
  if (p.state.startsWith("onscene")) return PATROL_STATE_LABELS[p.state];
  return PATROL_STATE_LABELS[p.state] || p.state;
}
