import { Crosshair, Car, Package, Truck, Banknote, HandCoins, Swords, VenetianMask, Terminal, Crown, Star, Zap, Eye, Target, Landmark, Globe, CreditCard, Skull, Gem } from "lucide-react";

// Cor única para "precisa da tua atenção" (badges/dots de notificação) — o
// mesmo laranja já usado no resto do site (heatStatus "Alerta", feridos, etc.).
export const NOTIFY_COLOR = "#F97316";

// Preferências de exibição (Definições > Interface) — estado global simples em
// vez de prop-drilling, porque fmtMoney/fmtDuration são chamadas de dezenas de
// sítios diferentes em toda a interface.
const DISPLAY_PREFS_KEY = "submundo.ui.displayPrefs";
let displayPrefs = { compactNumbers: false, showSeconds: true };
try {
  const raw = window.localStorage.getItem(DISPLAY_PREFS_KEY);
  if (raw) displayPrefs = { ...displayPrefs, ...JSON.parse(raw) };
} catch (e) {
  // armazenamento indisponível — usa os valores por omissão
}

export function getDisplayPrefs() {
  return displayPrefs;
}

export function setDisplayPrefs(next) {
  displayPrefs = { ...displayPrefs, ...next };
  try {
    window.localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(displayPrefs));
  } catch (e) {
    // ignora silenciosamente
  }
}

// Compras acima deste valor pedem confirmação em dois passos antes de gastar.
export const LARGE_PURCHASE_THRESHOLD = 20000;

export const CATEGORY_COLORS = {
  assalto: "#EF4444",
  logistica: "#F59E0B",
  tecnica: "#22D3EE",
  influencia: "#34D399",
  especial: "#FFFFFF",
};

export const TYPE_ICONS = {
  assalto: Crosshair,
  roubo: Car,
  contrabando: Package,
  transporte: Truck,
  lavagem: Banknote,
  cobranca: HandCoins,
  ataque_territorio: Swords,
  infiltracao: VenetianMask,
  hack: Terminal,
  operacao_vip: Crown,
  missao_especial: Star,
  entrega_expressa: Zap,
  vigilancia_digital: Eye,
  assalto_armado: Target,
  suborno_oficial: Landmark,
  rota_internacional: Globe,
  ciberataque_bancario: CreditCard,

  // Assalto
  roubo_joalharia: Gem,
  assalto_licorista: Crosshair,
  roubo_carga: Truck,
  assalto_penhores: Target,
  assalto_blindado: Crosshair,
  emboscada_rival: Target,
  assalto_casino: Crosshair,
  sequestro_relampago: VenetianMask,
  assalto_museu: Crosshair,
  guerra_territorio: Swords,

  // Logística
  entrega_local: Package,
  recolha_mercadoria: Truck,
  transporte_armas: Zap,
  rota_costeira: Globe,
  contrabando_tabaco: Package,
  frota_fantasma: Truck,
  rota_alfandega: Zap,
  carga_diplomatica: Globe,
  rede_distribuicao: Package,
  porto_franco: Truck,

  // Técnica
  phishing_bancario: Terminal,
  clonagem_cartoes: Eye,
  hack_semaforos: CreditCard,
  fraude_criptomoedas: Terminal,
  invasao_servidor: Eye,
  ciberespionagem: CreditCard,
  ataque_ddos: Terminal,
  roubo_dados: Eye,
  sabotagem_industrial: CreditCard,
  guerra_cibernetica: Terminal,

  // Influência
  protecao_comercio: HandCoins,
  boato_rua: Banknote,
  suborno_funcionario: Landmark,
  chantagem_politico: HandCoins,
  lavagem_casino: Banknote,
  infiltracao_sindicato: Landmark,
  acordo_autarca: HandCoins,
  campanha_difamacao: Banknote,
  controlo_imprensa: Landmark,
  golpe_estado_local: HandCoins,

  // Especial
  roubo_obra_arte: Gem,
  operacao_encoberta: Crown,
  resgate_refem: VenetianMask,
  leilao_clandestino: Star,
  venda_armamento: Crown,
  fuga_prisao: VenetianMask,
  assassinato_contrato: Skull,
  golpe_banco_central: Crown,
  trafico_influencia_internacional: VenetianMask,
  operacao_fantasma: Star,
};

export const SPEC_LABELS = {
  assalto: "Assalto",
  logistica: "Logística",
  tecnica: "Técnica",
  influencia: "Influência",
  especial: "Especial",
};

export const EMP_STATUS_LABELS = {
  idle: "Disponível",
  on_mission: "Em operação",
  training: "Em formação",
  resting: "Em descanso",
  injured: "Ferido",
  arrested: "Preso",
  absent: "Fora de serviço",
};

export const EMP_STATUS_COLORS = {
  idle: "#34D399",
  on_mission: "#22D3EE",
  training: "#60A5FA",
  resting: "#A78BFA",
  injured: "#F97316",
  arrested: "#EF4444",
  absent: "#F59E0B",
};

export const RARITY_LABELS = { comum: "Comum", raro: "Raro", elite: "Elite", lendario: "Lendário" };

export const RARITY_COLORS = { comum: "#A1A1AA", raro: "#22D3EE", elite: "#C084FC", lendario: "#F59E0B" };

export const RANK_LABELS = {
  recruta: "Recruta",
  membro: "Membro",
  especialista: "Especialista",
  veterano: "Veterano",
  tenente: "Tenente",
  chefe_equipa: "Chefe de Equipa",
  braco_direito: "Braço-Direito",
};

export const FUEL_LABELS = { gasolina: "Gasolina", gasoleo: "Gasóleo" };

export const ATTR_LABELS = {
  forca: "FOR", inteligencia: "INT", discricao: "DIS", conducao: "CND", tiro: "TIR",
  hack: "HCK", negociacao: "NEG", sangue_frio: "SFR", resistencia: "RES",
};

export function goodBarColor(v) {
  if (v >= 60) return "#34D399";
  if (v >= 30) return "#F59E0B";
  return "#EF4444";
}

export const QUEST_TYPE_LABELS = {
  principal: "História",
  diaria: "Diária",
  semanal: "Semanal",
  dinamica: "Sugerida",
  evento: "Evento",
  decisao: "Decisão",
};

export const QUEST_STATUS_LABELS = {
  locked: "Bloqueada",
  active: "Ativa",
  completed: "Concluída",
  claimed: "Reclamada",
  expired: "Expirada",
  failed: "Falhada",
};

export const QUEST_STATUS_COLORS = {
  locked: "#71717A",
  active: "#22D3EE",
  completed: "#34D399",
  claimed: "#8E8E93",
  expired: "#F59E0B",
  failed: "#EF4444",
};

export const DIFFICULTY_LABELS = { facil: "Fácil", normal: "Normal", dificil: "Difícil", elite: "Elite", lendaria: "Lendária" };

// SSS v3 — tiers adaptativos do sistema de missões (quest_perf.tier)
export const QUEST_TIER_LABELS = { 0: "Iniciado", 1: "Profissional", 2: "Veterano", 3: "Lenda" };
export const QUEST_TIER_COLORS = { 0: "#A1A1AA", 1: "#22D3EE", 2: "#C084FC", 3: "#F59E0B" };

export const DIFFICULTY_COLORS = { facil: "#34D399", normal: "#22D3EE", dificil: "#F59E0B", elite: "#C084FC", lendaria: "#F43F5E" };

export const CHAPTER_LABELS = {
  1: "Capítulo 1 — Começo",
  2: "Capítulo 2 — Expansão",
  3: "Capítulo 3 — Organização",
  4: "Capítulo 4 — Domínio",
  5: "Capítulo 5 — Consolidação",
  6: "Capítulo 6 — Legado",
};

// Limiar de "oportunidade a expirar" (pino urgente no mapa + rótulo da legenda
// + lista de operações) — fonte única, antes hardcoded/duplicado em LiveMap.
export const OPP_URGENT_SECONDS = 120;

export function effectiveSpeed(v) {
  if (v.condition >= 50) return v.speed;
  return v.speed * (0.6 + (0.4 * v.condition) / 50);
}

export function chanceColor(c) {
  // 0% é impossível, não "mau" — cor neutra distinta do vermelho (que
  // significa "possível mas arriscado"), para nunca ser confundida com sucesso.
  if (c == null || c <= 0) return "#71717A";
  if (c >= 0.75) return "#34D399";
  if (c >= 0.5) return "#F59E0B";
  return "#EF4444";
}

export function pctSigned(v) {
  const p = Math.round(v * 100);
  return `${p > 0 ? "+" : ""}${p}%`;
}

// Classificação qualitativa da probabilidade final (para o cabeçalho do
// preview de despacho) — banda mais fina que chanceColor (que só distingue
// 3 cores para o número agregado); aqui cada banda tem também um rótulo.
export function chanceQualityLabel(c) {
  if (c == null || c <= 0) return { label: "Impossível", color: "#71717A" };
  if (c >= 0.85) return { label: "Excelente", color: "#34D399" };
  if (c >= 0.65) return { label: "Boa", color: "#22D3EE" };
  if (c >= 0.45) return { label: "Média", color: "#F59E0B" };
  if (c >= 0.25) return { label: "Baixa", color: "#FB923C" };
  return { label: "Crítica", color: "#EF4444" };
}

// Rótulos das categorias em que o backend agrupa cada modificador de chance
// (chance_breakdown, engine.py) — usados para organizar o accordion de
// detalhes do preview de despacho. Uma categoria nova no backend só precisa
// de uma entrada aqui para ganhar um cabeçalho legível.
export const MODIFIER_CATEGORY_LABELS = {
  equipa: "Equipa",
  moral: "Moral e Lealdade",
  especializacoes: "Especializações",
  talentos: "Talentos",
  veiculos: "Veículos",
  armamento: "Armas e Equipamento",
  organizacao: "Quartel-General",
  mundo: "Modificadores do Mundo",
  missao: "Condições da Missão",
  outros: "Outros Bónus e Penalizações",
};

export function fatigueColor(f) {
  if (f >= 70) return "#EF4444";
  if (f >= 40) return "#F59E0B";
  return "#34D399";
}

// Banda de estado geral em vez da percentagem nua — mais rápido de ler de relance.
export function conditionBand(v) {
  if (v >= 80) return { label: "Excelente", color: "#34D399" };
  if (v >= 50) return { label: "Bom", color: "#22D3EE" };
  if (v >= 30) return { label: "Razoável", color: "#F59E0B" };
  return { label: "Mau", color: "#EF4444" };
}

// Normaliza para pesquisa: minúsculas e sem acentos, para "carro" encontrar "Carão".
export function normalizeSearch(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matchesSearch(query, ...fields) {
  const q = normalizeSearch(query).trim();
  if (!q) return true;
  return fields.some((f) => normalizeSearch(f).includes(q));
}

export function propertyBenefit(pt, level = 1) {
  const parts = [];
  if (pt.cap_employees) parts.push(`+${pt.cap_employees * level} operacionais`);
  if (pt.cap_vehicles) parts.push(`+${pt.cap_vehicles * level} veículos`);
  if (pt.dirty_per_h) parts.push(`+${pt.dirty_per_h * level} €/h sujos`);
  if (pt.launder_per_h) parts.push(`lava ${pt.launder_per_h * level} €/h`);
  if (pt.heat_per_h) parts.push(`+${(pt.heat_per_h * level).toFixed(1)} calor/h`);
  if (pt.bonus_pct) parts.push(`+${Math.round(pt.bonus_pct * level * 100)}% ${pt.bonus_label}`);
  if (pt.repair_discount_pct) parts.push(`-${Math.round(pt.repair_discount_pct * level * 100)}% reparações`);
  return parts.join(" · ");
}

// Resumo legível das estatísticas de um modelo de arma (mirror de propertyBenefit).
export function weaponBenefit(wm) {
  if (!wm) return "";
  const parts = [];
  if (wm.power) parts.push(`Potência ${wm.power}`);
  if (wm.accuracy) parts.push(`Precisão ${wm.accuracy}`);
  if (wm.range) parts.push(`Alcance ${wm.range}`);
  if (wm.use_speed) parts.push(`Velocidade ${wm.use_speed}`);
  if (wm.magazine_capacity) parts.push(`Carregador ${wm.magazine_capacity}`);
  return parts.join(" · ");
}

// Compatibilidade suave: um funcionário que não cumpra requires_attr continua
// a poder equipar a arma, mas com menos eficácia — usado só para o aviso na
// interface, nunca para bloquear a atribuição.
export function weaponCompatibility(emp, wm) {
  const reqs = wm?.requires_attr || {};
  const keys = Object.keys(reqs);
  if (keys.length === 0) return { compatible: true, missing: [] };
  const attrs = emp?.attrs || {};
  const missing = keys.filter((k) => (attrs[k] || 0) < reqs[k]);
  return { compatible: missing.length === 0, missing };
}

// ---------------- QI das Armas (SSS v5) — espelho EXATO do motor ----------------
// Todas as fórmulas abaixo replicam engine.py (weapon_combat_score,
// weapon_condition_factor, weapon_jam_risk, _weapon_skill_factor,
// weapon_compatibility_factor, weapon_effective_score) usando as constantes
// expostas em /catalog (weapon_meta + weapon_category_weights) — o que o
// jogador vê no arsenal é a MESMA régua que a chance de missão usa.

export const WEAPON_TIERS = {
  rua: { label: "Rua", color: "#A1A1AA" },
  profissional: { label: "Profissional", color: "#22D3EE" },
  militar: { label: "Militar", color: "#C084FC" },
  pesado: { label: "Pesado", color: "#F59E0B" },
};

export function weaponTier(wm) {
  const lvl = wm?.min_level || 1;
  const key = lvl >= 6 ? "pesado" : lvl >= 4 ? "militar" : lvl >= 2 ? "profissional" : "rua";
  return { key, ...WEAPON_TIERS[key] };
}

// As 6 dimensões do score de combate — a mesma decomposição que
// WEAPON_CATEGORY_WEIGHTS pondera por categoria de operação.
export const WEAPON_STATS = [
  { key: "power", label: "Potência", tip: "Poder de fogo bruto — decisivo em assaltos e operações especiais." },
  { key: "accuracy", label: "Precisão", tip: "Probabilidade de acertar à primeira — vale ouro em operações técnicas e de influência." },
  { key: "range", label: "Alcance", tip: "Distância útil — operações técnicas e especiais valorizam ataque à distância." },
  { key: "lightness", label: "Leveza", tip: "Inverso do peso — armas leves movem-se depressa e escondem-se melhor." },
  { key: "use_speed", label: "Velocidade", tip: "Rapidez de uso/cadência — crítica quando a operação corre mal." },
  { key: "magazine", label: "Carregador", tip: "Capacidade de munições (escala até 30) — sustenta operações longas." },
];

export function weaponStatValue(wm, key) {
  if (!wm) return 0;
  if (key === "lightness") return Math.max(0, 100 - (wm.weight || 0));
  if (key === "magazine") return Math.min(100, Math.round(((wm.magazine_capacity || 0) / 30) * 100));
  return Math.min(100, wm[key] || 0);
}

// Espelho de engine.weapon_combat_score: score 0-1 ponderado pela categoria.
export function weaponCombatScore(wm, category, categoryWeights) {
  const all = categoryWeights || {};
  const weights = all[category] || all["logistica"] || {};
  if (!wm || !Object.keys(weights).length) return 0;
  const power = (wm.power || 0) / 100;
  const accuracy = (wm.accuracy || 0) / 100;
  const rng = (wm.range || 0) / 100;
  const lightness = 1 - Math.min(1, (wm.weight || 0) / 100);
  const speed = (wm.use_speed || 0) / 100;
  const magazine = Math.min(1, (wm.magazine_capacity || 0) / 30);
  return (
    power * (weights.power || 0) + accuracy * (weights.accuracy || 0)
    + rng * (weights.range || 0) + lightness * (weights.lightness || 0)
    + speed * (weights.speed || 0) + magazine * (weights.magazine || 0)
  );
}

// Espelho de engine.weapon_condition_factor: linear até ao joelho
// (condition_soft_knee), quadrática abaixo — a 20% a arma é quase sucata.
export function weaponConditionFactor(condition, meta) {
  const knee = ((meta && meta.condition_soft_knee) ?? 40) / 100;
  const c = Math.max(0, Math.min(100, condition ?? 100)) / 100;
  if (c >= knee || knee <= 0) return c;
  return c * (c / knee);
}

// Espelho de engine.weapon_jam_risk: fiabilidade do modelo + défice de
// condição abaixo do limiar. Armas sem mecanismo (faca/taser) nunca encravam.
export function weaponJamRisk(wm, condition, meta) {
  if (!wm) return 0;
  if ((wm.magazine_capacity || 0) < 2 && !wm.loud) return 0;
  const m = meta || {};
  const rel = Math.max(0, Math.min(100, wm.reliability ?? 100)) / 100;
  let risk = (1 - rel) * (m.jam_reliability_weight ?? 0.4);
  const cond = Math.max(0, Math.min(100, condition ?? 100));
  const thr = m.jam_condition_threshold ?? 60;
  if (cond < thr) risk += ((thr - cond) / thr) * (m.jam_condition_weight ?? 0.25);
  return Math.max(0, Math.min(m.jam_max ?? 0.35, risk));
}

// Espelho de engine._weapon_skill_factor: a arma certa na mão errada rende
// pouco — eficácia escala com o atributo relevante do portador.
export function weaponSkillInfo(emp, wm, meta) {
  const m = meta || {};
  const floor = m.skill_floor ?? 0.55;
  const cap = m.skill_attr_cap ?? 8;
  const reqs = wm?.requires_attr || {};
  const attr = Object.keys(reqs)[0] || (wm?.loud ? "tiro" : "discricao");
  const value = (emp?.attrs || {})[attr] ?? 2;
  const factor = floor + (1 - floor) * Math.min(1, value / cap);
  return { attr, value, factor };
}

// Espelho de engine.weapon_compatibility_factor: sinal suave, nunca bloqueio.
export function weaponCompatFactor(emp, wm, meta) {
  const reqs = wm?.requires_attr || {};
  const keys = Object.keys(reqs);
  if (!keys.length) return 1;
  const attrs = emp?.attrs || {};
  let shortfall = 0;
  keys.forEach((k) => {
    const v = attrs[k] || 0;
    if (v < reqs[k]) shortfall += (reqs[k] - v) / Math.max(1, reqs[k]);
  });
  if (shortfall <= 0) return 1;
  return Math.max((meta && meta.compatibility_min_factor) ?? 0.4, 1 - shortfall * 0.3);
}

// Espelho de engine.weapon_effective_score: qualidade do modelo × adequação
// best_for × condição × fiabilidade × compatibilidade × habilidade + proficiência.
export function weaponEffectiveScore(emp, weaponDoc, wm, category, catalog) {
  if (!wm) return 0;
  const meta = catalog?.weapon_meta || {};
  const score = weaponCombatScore(wm, category, catalog?.weapon_category_weights);
  const bestForMult = (wm.best_for || []).includes(category) ? 1.3 : 0.7;
  const condition = weaponConditionFactor(weaponDoc?.condition ?? 100, meta);
  const reliability = (wm.reliability ?? 100) / 100;
  const compat = weaponCompatFactor(emp, wm, meta);
  const skill = weaponSkillInfo(emp, wm, meta).factor;
  const profMax = meta.proficiency_max ?? 100;
  const prof = (emp?.weapon_proficiency || {})[wm.category] || 0;
  const profBonus = Math.sqrt(Math.max(0, prof) / profMax) * (meta.proficiency_bonus_max_pct ?? 0.08);
  return score * bestForMult * condition * reliability * compat * skill * (meta.combat_score_scale ?? 0.15) + profBonus;
}

// Desgaste base de condição por missão deste modelo (antes do risco da
// operação): wear_per_mission × durability_wear_ref / durability.
export function weaponWearPerMission(wm, meta) {
  const m = meta || {};
  const base = m.wear_per_mission ?? 3;
  const ref = m.durability_wear_ref ?? 70;
  return base * (ref / Math.max(1, wm?.durability || ref));
}

// Adequação 0-1 por categoria de operação (score de combate × multiplicador
// best_for) — para as 5 mini-barras "adequação por operação" dos cartões.
export const WEAPON_OP_CATEGORIES = ["assalto", "tecnica", "especial", "influencia", "logistica"];

export function weaponAdequacy(wm, catalog) {
  return WEAPON_OP_CATEGORIES.map((cat) => {
    const best = (wm?.best_for || []).includes(cat);
    const score = weaponCombatScore(wm, cat, catalog?.weapon_category_weights) * (best ? 1.3 : 0.7);
    return { category: cat, label: SPEC_LABELS[cat] || cat, score: Math.max(0, Math.min(1, score)), best };
  });
}

// ============ QI das Equipas (SSS v4) — espelhos EXATOS do engine.py ============
// Todas as fórmulas replicam os modificadores do motor com as réguas expostas
// em catalog.team_meta — a UI mostra os MESMOS números que a chance de missão usa.

export const TEAM_TIERS = {
  recruta: { label: "Recruta", color: "#A1A1AA" },
  operacional: { label: "Operacional", color: "#22D3EE" },
  veterana: { label: "Veterana", color: "#C084FC" },
  lendaria: { label: "Lendária", color: "#F59E0B" },
};

// Tier da unidade pela experiência real: os degraus alinham com as rampas do
// motor (8 ops = entrosamento máximo em prática, 25 = mestria de categoria).
export function teamTier(missionsDone) {
  const n = missionsDone || 0;
  const key = n >= 60 ? "lendaria" : n >= 25 ? "veterana" : n >= 8 ? "operacional" : "recruta";
  return { key, ...TEAM_TIERS[key] };
}

// Espelho de engine.mod_team_momentum: série de vitórias dá bónus capado,
// série de falhas penaliza; só conta a partir de |streak| >= 2.
export function teamMomentum(streak, meta) {
  const m = meta || {};
  const s = streak || 0;
  if (s >= 2) {
    return { state: "hot", streak: s, pct: Math.min(m.momentum_bonus_max ?? 0.06, (m.momentum_bonus_per_win ?? 0.012) * s) };
  }
  if (s <= -2) {
    return { state: "cold", streak: s, pct: -Math.min(m.momentum_penalty_max ?? 0.06, (m.momentum_penalty_per_loss ?? 0.02) * -s) };
  }
  return { state: "neutral", streak: s, pct: 0 };
}

// Espelho de engine.mod_team_coordination: 50% tempo de plantel estável +
// 50% operações feitas com este plantel; mudar membros reinicia ambos.
export function teamCoordination(team, meta, nowMs) {
  const m = meta || {};
  const rampS = m.coordination_ramp_s ?? 21600;
  const rampMissions = m.coordination_ramp_missions ?? 8;
  let timeFrac = 0;
  if (team?.roster_stable_since) {
    const stableS = Math.max(0, (nowMs - Date.parse(team.roster_stable_since)) / 1000);
    timeFrac = Math.min(1, stableS / rampS);
  }
  const missions = team?.roster_missions || 0;
  const missionFrac = Math.min(1, missions / rampMissions);
  const max = m.coordination_bonus_max ?? 0.05;
  const pct = max * (0.5 * timeFrac + 0.5 * missionFrac);
  return { timeFrac, missionFrac, missions, rampMissions, pct, max };
}

// Espelho de engine.mod_team_familiarity: a equipa aprende por categoria —
// curva sqrt (ganhos rápidos no início, mestria lenta), só conta a partir
// da 3.ª operação, capada na mestria.
export function teamFamiliarity(count, meta) {
  const m = meta || {};
  const min = m.familiarity_min_missions ?? 3;
  const ramp = m.familiarity_ramp_missions ?? 25;
  const max = m.familiarity_bonus_max ?? 0.05;
  const c = count || 0;
  const frac = Math.min(1, c / ramp);
  const active = c >= min;
  return { count: c, frac, pct: active ? max * Math.sqrt(frac) : 0, mastery: c >= ramp, active, min, ramp, max };
}

// Ordem fixa das 5 categorias de operação para a fila de familiaridade.
export const TEAM_OP_CATEGORIES = ["assalto", "logistica", "tecnica", "influencia", "especial"];

// Papéis a bordo (SSS v4) — espelho da deteção do dispatch (_prepare_dispatch):
// líder por patente (clutch save = clutch_max × sangue-frio/10), médico e
// advogado por role_key, condutor pelo melhor atributo de condução (reduz
// viagem e melhora a fuga), estratega por inteligência >= limiar.
export function teamRoles(members, meta, ranks) {
  const m = meta || {};
  const list = members || [];
  const rankList = ranks && ranks.length ? ranks : ["recruta", "membro", "especialista", "veterano", "tenente", "chefe_equipa", "braco_direito"];
  const leaderIdx = rankList.indexOf(m.leader_min_rank || "chefe_equipa");
  const leaders = leaderIdx >= 0 ? list.filter((e) => rankList.indexOf(e.rank) >= leaderIdx) : [];
  const leaderCool = leaders.reduce((a, e) => Math.max(a, (e.attrs || {}).sangue_frio || 0), 0);
  const clutchPct = (m.clutch_save_max ?? 0.18) * Math.max(0, Math.min(1, leaderCool / 10));
  const bestDriver = list.reduce((a, e) => Math.max(a, (e.attrs || {}).conducao || 0), 0);
  const dBase = m.driver_attr_baseline ?? 5;
  const driverActive = bestDriver > dBase;
  const travelPct = driverActive
    ? Math.min(m.driver_travel_reduction_max ?? 0.12, (bestDriver - dBase) * (m.driver_travel_reduction_per_point ?? 0.024))
    : 0;
  const escapePct = driverActive
    ? Math.min(m.driver_escape_bonus_max ?? 0.06, (bestDriver - dBase) * (m.driver_escape_bonus_per_point ?? 0.012))
    : 0;
  const bestInt = list.reduce((a, e) => Math.max(a, (e.attrs || {}).inteligencia || 0), 0);
  return {
    leader: { present: leaders.length > 0, cool: leaderCool, clutchPct },
    medic: { present: list.some((e) => e.role_key === "medico") },
    lawyer: { present: list.some((e) => e.role_key === "advogado") },
    driver: { value: bestDriver, active: driverActive, travelPct, escapePct },
    strategist: { present: bestInt >= (m.strategist_min_int ?? 7), intel: bestInt },
  };
}

// Espelho de engine.mod_team_synergy: cobertura dos atributos-chave da
// categoria pelos melhores membros (60%) + diversidade de papéis (40%),
// centrada num baseline — só composições complementares ganham.
export function teamSynergy(members, category, meta) {
  const list = members || [];
  if (list.length < 2) return null;
  const m = meta || {};
  const catAttrs = (m.category_attrs || {})[category];
  const bestOf = (k) => list.reduce((mx, e) => Math.max(mx, (e.attrs || {})[k] ?? 2), 0);
  let coverage;
  if (catAttrs && catAttrs.length) {
    coverage = catAttrs.reduce((a, k) => a + bestOf(k), 0) / (catAttrs.length * 10);
  } else {
    const best = ["forca", "inteligencia", "discricao", "conducao", "tiro", "hack", "negociacao", "sangue_frio", "resistencia"]
      .map(bestOf).sort((a, b) => b - a);
    coverage = (best[0] + best[1] + best[2]) / 30;
  }
  const diversity = new Set(list.map((e) => e.role_key)).size / list.length;
  const raw = 0.6 * coverage + 0.4 * diversity - (m.synergy_baseline ?? 0.62);
  const pct = Math.max(-1, Math.min(1, raw / (m.synergy_spread ?? 0.38))) * (m.synergy_max ?? 0.03);
  return { coverage, diversity, pct };
}

export function parseActivityMessage(message) {
  const React = require('react');
  const safeMessage = typeof message === 'string' ? message : String(message ?? '');
  const parts = [];
  let lastIdx = 0;

  const dirtyMoneyRegex = /(\d+(?:,\d{3})*)\s*€\s*sujos/g;
  const cleanMoneyRegex = /(\d+(?:,\d{3})*)\s*€\s*limpos/g;

  // NOTA: todas as regexes usadas com exec() em while TÊM de ter a flag /g —
  // sem ela o lastIndex nunca avança e o while bloqueia a página para sempre.
  const resourcePatterns = [
    { regex: /(?:destacada para|para|em)\s+([^—\n.]+?)(?:\s+em\s+|—|$|\n)/g, isResource: true },
    { regex: /(?:pago a|pagou a|recrutado por|adquirido por|comprado em|vendido por|melhorado para|reparado por|abastecer|desbloqueou|subiu|promovido a|tratado na|libertado|despedido|iniciou|foram desperdiçados|apanhou|recrutado|apanhou|encaminhado para|saiu)\s+([A-Z][^—\n.€]+?)(?=[—.\n€]|$)/g, isResource: true },
  ];

  let matches = [];

  const execAll = (regex, onMatch) => {
    let m;
    while ((m = regex.exec(safeMessage)) !== null) {
      onMatch(m);
      // Guarda contra matches vazios (e regexes sem /g): avança sempre
      if (m.index === regex.lastIndex) regex.lastIndex++;
    }
  };

  execAll(dirtyMoneyRegex, (m) =>
    matches.push({ start: m.index, end: m.index + m[0].length, type: 'dirty', text: m[0] })
  );
  execAll(cleanMoneyRegex, (m) =>
    matches.push({ start: m.index, end: m.index + m[0].length, type: 'clean', text: m[0] })
  );
  resourcePatterns.forEach(({ regex }) => {
    execAll(regex, (m) => {
      if (m[1] && m[1].length > 1 && m[1].length < 60) {
        const resourceStart = m.index + m[0].indexOf(m[1]);
        const resourceEnd = resourceStart + m[1].length;
        matches.push({ start: resourceStart, end: resourceEnd, type: 'resource', text: m[1].trim() });
      }
    });
  });

  matches.sort((a, b) => a.start - b.start);

  matches = matches.filter((m, i) => {
    if (i === 0) return true;
    const prev = matches[i - 1];
    return m.start >= prev.end;
  });

  matches.forEach((match) => {
    if (match.start > lastIdx) {
      parts.push(safeMessage.substring(lastIdx, match.start));
    }

    if (match.type === 'dirty') {
      parts.push(
        React.createElement('span', { key: `dirty-${match.start}`, style: { color: '#EF4444', fontWeight: '600' } }, match.text)
      );
    } else if (match.type === 'clean') {
      parts.push(
        React.createElement('span', { key: `clean-${match.start}`, style: { color: '#34D399', fontWeight: '600' } }, match.text)
      );
    } else if (match.type === 'resource') {
      parts.push(
        React.createElement('span', { key: `resource-${match.start}`, style: { textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.3)', textDecorationThickness: '1px', textUnderlineOffset: '2px' } }, match.text)
      );
    }

    lastIdx = match.end;
  });

  if (lastIdx < safeMessage.length) {
    parts.push(safeMessage.substring(lastIdx));
  }

  return parts.length > 0 ? parts : safeMessage;
}


export const STATUS_LABELS = {
  idle: "Na base",
  en_route: "A caminho",
  operating: "Em operação",
  returning: "A regressar",
};

export const STATUS_COLORS = {
  idle: "#8E8E93",
  en_route: "#22D3EE",
  operating: "#EF4444",
  returning: "#F59E0B",
};

export function fmtMoney(n) {
  const val = Math.round(n || 0);
  if (displayPrefs.compactNumbers) {
    return new Intl.NumberFormat("pt-PT", { notation: "compact", maximumFractionDigits: 1 }).format(val) + " €";
  }
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(val) + " €";
}

// Formato ultra-curto para HUDs estreitos (mobile): 75 000 → "75k €",
// 5 400 → "5,4k €", 1 250 000 → "1,25M €". Nunca trunca com reticências.
export function fmtMoneyShort(n) {
  const val = Math.round(n || 0);
  const sign = val < 0 ? "-" : "";
  const abs = Math.abs(val);
  const trim = (x, d) => x.toFixed(d).replace(".", ",").replace(/,?0+$/, "");
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000, 2)}M €`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000, 1)}k €`;
  return `${sign}${abs} €`;
}

export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function fmtDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (!displayPrefs.showSeconds) {
    if (s >= 3600) {
      const h = Math.floor(s / 3600);
      const m = Math.round((s % 3600) / 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const m = Math.max(1, Math.round(s / 60));
    return `${m}m`;
  }
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

const lerp = (a, b, t) => a + (b - a) * t;

export function missionPosition(mission, nowMs) {
  const depart = Date.parse(mission.depart_at);
  const arrive = Date.parse(mission.arrive_at);
  const finish = Date.parse(mission.finish_at);
  const ret = Date.parse(mission.return_at);
  const o = mission.origin;
  const tg = mission.target;
  if (nowMs <= arrive) {
    const t = Math.min(1, Math.max(0, (nowMs - depart) / Math.max(1, arrive - depart)));
    return { lat: lerp(o.lat, tg.lat, t), lng: lerp(o.lng, tg.lng, t), phase: "en_route" };
  }
  if (nowMs <= finish) return { lat: tg.lat, lng: tg.lng, phase: "operating" };
  if (nowMs <= ret) {
    const t = Math.min(1, Math.max(0, (nowMs - finish) / Math.max(1, ret - finish)));
    return { lat: lerp(tg.lat, o.lat, t), lng: lerp(tg.lng, o.lng, t), phase: "returning" };
  }
  return { lat: o.lat, lng: o.lng, phase: "done" };
}

export const ATTR_FULL = {
  forca: "Força", inteligencia: "Inteligência", discricao: "Discrição", conducao: "Condução",
  tiro: "Tiro", hack: "Hacking", negociacao: "Negociação", sangue_frio: "Sangue-frio", resistencia: "Resistência",
};

// O calor é sempre um indicador de perigo — ícone e texto ficam a vermelho
// em qualquer nível, em vez de "esconder" o risco com verde/âmbar quando baixo.
export function heatStatus(h) {
  // Escala de cor progressiva (calmo→crítico) em vez de vermelho fixo em
  // todos os níveis — o jogador deve ver de relance se está seguro ou não.
  if (h >= 90) return { label: "Crítico", color: "#EF4444", desc: "Polícia em alerta máximo — operações bloqueadas até subornares ou o calor baixar." };
  if (h >= 70) return { label: "Alerta", color: "#F97316", desc: "Risco de rusga aos laboratórios e interceções frequentes." };
  if (h >= 40) return { label: "Vigiado", color: "#F59E0B", desc: "A polícia está atenta — probabilidade de sucesso reduzida." };
  return { label: "Calmo", color: "#34D399", desc: "Radar limpo — momento ideal para operar." };
}

export function vehicleRangeKm(v) {
  if (!v || !v.cons) return 0;
  return (v.fuel_l / v.cons) * 100;
}

export function refuelCostOf(v, fuelPrices) {
  return Math.ceil((v.tank_l - v.fuel_l) * (fuelPrices?.[v.fuel_type] || 0));
}

export function repairCostOf(v) {
  return Math.max(50, Math.round((100 - v.condition) * v.price * 0.002));
}

export function sellValueOf(v) {
  return Math.round(v.price * 0.4 * (v.condition / 100));
}

export function passiveRates(state, catalog, now = Date.now()) {
  const pt = catalog?.property_types || {};
  let dirtyPerH = 0, launderPerH = 0, heatPerH = 0;
  (state?.properties || []).forEach((p) => {
    const t = pt[p.type_key];
    if (!t) return;
    if (p.upgrading_until && Date.parse(p.upgrading_until) > now) return;
    const factor = (p.condition ?? 100) / 100;
    dirtyPerH += (t.dirty_per_h || 0) * p.level * factor;
    launderPerH += (t.launder_per_h || 0) * p.level * factor;
    heatPerH += (t.heat_per_h || 0) * p.level * factor;
  });
  return { dirtyPerH, launderPerH, heatPerH };
}

// Veredicto ÚNICO de prontidão de uma equipa — fonte de verdade partilhada por
// OpportunityCard, TeamsPanel e opportunityReachable (antes eram três
// implementações divergentes que se contradiziam).
//   • opp = null → verificações operacionais genéricas ("a equipa consegue
//     operar de todo?"): estado, reorganização, membros, veículo, condição,
//     transferência, abastecimento, lugares e combustível mínimo.
//   • opp definido → acrescenta o específico da operação: min_members,
//     required_models, e combustível para a distância real (ida-e-volta).
// `now` DEVE ser serverNow() do chamador (nunca Date.now() nas verificações de
// tempo — evita a deriva do relógio). `catalog` é opcional (só a verificação de
// lugares depende dele). Devolve { ok, reason, members, eta, vehicle, fuelNeeded }.
// Base operacional atual de um veículo — espelho de resolve_mission_origin
// (backend/engine.py): a origem para ETA/distância é a propriedade onde o
// veículo está baseado (vehicle.property_id), caindo no QG quando não tem base.
// Sem isto, o cliente calculava tudo a partir do QG e divergia do servidor.
export function resolveVehicleOrigin(state, vehicle) {
  const pid = vehicle?.property_id;
  if (pid) {
    const p = (state?.properties || []).find((x) => String(x.id) === String(pid));
    if (p && p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng, property_id: pid };
  }
  const hq = state?.player?.hq;
  return { lat: hq?.lat, lng: hq?.lng, property_id: null };
}

export function teamReadiness(state, catalog, team, { opp = null, now = Date.now() } = {}) {
  if (!team) return { ok: false, reason: "Sem equipa" };
  if (team.status !== "idle") return { ok: false, reason: STATUS_LABELS[team.status] || "Em operação" };
  if (team.available_at && Date.parse(team.available_at) > now) {
    return { ok: false, reorg: true, reason: "A reorganizar-se" };
  }
  const members = (state?.employees || []).filter((e) => e.team_id === team.id);
  if (members.length === 0) return { ok: false, reason: "Sem membros" };
  const ready = members.filter((e) => e.status === "idle" && e.fatigue < 90);
  if (ready.length === 0) return { ok: false, reason: "Membros indisponíveis" };
  if (opp && ready.length < (opp.min_members || 1)) {
    return { ok: false, reason: `Mín. ${opp.min_members} membros` };
  }
  const vehicle = (state?.vehicles || []).find((v) => v.id === team.vehicle_id);
  if (!vehicle) return { ok: false, reason: "Sem veículo" };
  if (vehicle.transfer && Date.parse(vehicle.transfer.ends_at) > now) {
    return { ok: false, reason: "Veículo indisponível" };
  }
  if (vehicle.condition < 30) return { ok: false, reason: "Veículo avariado" };
  if (vehicle.refueling_until && Date.parse(vehicle.refueling_until) > now) {
    return { ok: false, reason: "A abastecer" };
  }
  const seats = catalog?.vehicle_models?.[vehicle.model_key]?.seats;
  if (seats != null && ready.length > seats) return { ok: false, reason: `Poucos lugares (${seats})` };
  if (opp) {
    if (opp.required_models?.length > 0 && !opp.required_models.includes(vehicle.model_key)) {
      return { ok: false, reason: "Veículo não adequado" };
    }
    // Distância/ETA/combustível medidos a partir da BASE do veículo (como o
    // servidor), não sempre do QG.
    const origin = resolveVehicleOrigin(state, vehicle);
    const distM = origin.lat != null ? haversineM(origin.lat, origin.lng, opp.lat, opp.lng) : 0;
    const fuelNeeded = ((2 * distM) / 1000) * (vehicle.cons / 100);
    if (vehicle.fuel_l < fuelNeeded) return { ok: false, reason: "Sem combustível" };
    return { ok: true, members: ready.length, eta: Math.max(20, distM / effectiveSpeed(vehicle)), vehicle, fuelNeeded, distM, origin };
  }
  // Genérico (sem operação alvo): combustível mínimo operacional.
  if (vehicle.fuel_l < vehicle.tank_l * 0.12) return { ok: false, reason: "Combustível baixo" };
  return { ok: true, members: ready.length, vehicle };
}

export function teamsReadiness(state, now = Date.now(), catalog = null) {
  let ready = 0, busy = 0;
  const teams = state?.teams || [];
  teams.forEach((t) => {
    if (t.status !== "idle") { busy += 1; return; }
    if (teamReadiness(state, catalog, t, { now }).ok) ready += 1;
  });
  return { ready, busy, total: teams.length };
}

// Existe pelo menos uma equipa capaz de despachar para esta oportunidade agora?
// Usado por "Ocultar missões impossíveis" e pelo filtro "só alcançáveis".
// Reutiliza o veredicto unificado (mesma definição do cartão de despacho).
export function opportunityReachable(state, opp, now = Date.now(), catalog = null) {
  return (state?.teams || []).some((t) => teamReadiness(state, catalog, t, { opp, now }).ok);
}

export function orgAlerts(state) {
  const emps = state?.employees || [];
  const vehs = state?.vehicles || [];
  const teams = state?.teams || [];
  const injured = emps.filter((e) => e.status === "injured").length;
  const arrested = emps.filter((e) => e.status === "arrested").length;
  const exhausted = emps.filter((e) => e.status === "idle" && e.fatigue >= 70).length;
  // "Prestes a ficar exausto" — ainda opera, mas aproxima-se do limiar de 70%.
  const nearExhausted = emps.filter((e) => e.status === "idle" && e.fatigue >= 55 && e.fatigue < 70).length;
  const betrayal = emps.filter((e) => (e.betrayal_risk || 0) >= 25).length;
  const lowFuel = vehs.filter((v) => v.fuel_l < v.tank_l * 0.25).length;
  const damaged = vehs.filter((v) => v.condition < 30).length;
  // "Perto de avariar" — ainda opera (≥30%), mas já vale a pena reparar antes que bloqueie.
  const nearBreakdown = vehs.filter((v) => v.condition >= 30 && v.condition < 45).length;
  const teamsNoVehicle = teams.filter((t) => !t.vehicle_id).length;
  const teamsNoMembers = teams.filter((t) => emps.every((e) => e.team_id !== t.id)).length;
  const raidRisk = (state?.player?.heat || 0) >= 70 && (state?.properties || []).some((p) => p.type_key === "laboratorio");
  const claimable = (state?.quests || []).filter((q) => q.status === "completed").length;
  const payrollS = state?.player?.next_payroll_at ? (Date.parse(state.player.next_payroll_at) - Date.now()) / 1000 : null;
  const payrollDueSoon = payrollS != null && payrollS <= 300 && (state?.salary_total || 0) > 0;
  // Distinto de "payrollDueSoon" (lembrete de tempo): isto sinaliza que o
  // dinheiro não chega mesmo, independentemente de quando o ciclo acontece —
  // é a condição que faz o efetivo perder lealdade e abandonar a organização.
  const payrollShort = (state?.salary_total || 0) > 0 && (state?.player?.clean_money || 0) < state.salary_total;
  // Cofre de dinheiro sujo quase cheio: a produção passiva dos laboratórios
  // acima do limite é desperdiçada — o jogador está a perder dinheiro real
  // sem nenhum aviso visível a não ser este.
  const dirtyCap = state?.caps?.dirty_money?.max || 0;
  const dirtyNearCap = dirtyCap > 0 && (state?.player?.dirty_money || 0) >= dirtyCap * 0.9;
  const hr = injured + arrested + exhausted + betrayal;
  const fleet = lowFuel + damaged;
  const teamsIssues = teamsNoVehicle + teamsNoMembers;
  return {
    injured, arrested, exhausted, nearExhausted, betrayal, lowFuel, damaged, nearBreakdown,
    teamsNoVehicle, teamsNoMembers, raidRisk, claimable, payrollDueSoon, payrollShort, dirtyNearCap,
    hr, fleet, teams: teamsIssues,
    total: hr + fleet + teamsIssues + nearExhausted + nearBreakdown + (payrollDueSoon ? 1 : 0) + (payrollShort ? 1 : 0) + (raidRisk ? 1 : 0) + (dirtyNearCap ? 1 : 0),
  };
}

// ---------------- Quartel-General ----------------

// Tier de benefícios cumulativos de um nível de HQ (hq_level_benefits vem do
// catálogo, indexado por nível — índice 0 é o nível 1).
export function hqBenefitsAt(catalog, level) {
  const tiers = catalog?.hq_level_benefits || [];
  const max = catalog?.hq_max_level || tiers.length || 1;
  const idx = Math.min(Math.max(level, 1), max) - 1;
  return tiers[idx] || null;
}

// Texto legível dos benefícios cumulativos de um tier (mirror de propertyBenefit).
export function hqBenefitDesc(tier) {
  if (!tier) return "";
  const parts = [];
  if (tier.cap_employees) parts.push(`+${tier.cap_employees} operacionais`);
  if (tier.cap_vehicles) parts.push(`+${tier.cap_vehicles} veículos`);
  if (tier.passive_income_pct) parts.push(`+${Math.round(tier.passive_income_pct * 100)}% produção/lavagem passiva`);
  if (tier.heat_reduction_pct) parts.push(`-${Math.round(tier.heat_reduction_pct * 100)}% calor das propriedades`);
  return parts.join(" · ") || "Sem bónus adicional.";
}

// Painel de situação do Quartel-General — reaproveita orgAlerts (não
// reimplementa a deteção de problemas) e acrescenta duas heurísticas próprias
// do HQ: melhoria recomendada e oportunidades de expansão (propriedades por
// comprar). Devolve cartões {id, severity, label, navigate} para a UI.
export function hqSituationItems(state, catalog) {
  const alerts = orgAlerts(state);
  const items = [];
  const push = (id, severity, label, navigate) => items.push({ id, severity, label, navigate });

  if (alerts.claimable > 0) push("claimable", "info", `${alerts.claimable} recompensa(s) de missão por reclamar`, "quests");
  if (alerts.teams > 0) push("teams", "warn", `${alerts.teams} equipa(s) indisponível(is) (sem veículo ou membros)`, "teams");
  if (alerts.fleet > 0) push("fleet", "warn", `${alerts.fleet} veículo(s) avariado(s) ou sem combustível`, "fleet");
  if (alerts.hr > 0) push("hr", "danger", `${alerts.hr} operacional(is) ferido(s), preso(s), exausto(s) ou desleal(is)`, "employees");
  if (alerts.payrollShort) push("payroll", "danger", "Fundos insuficientes para os salários", "employees");
  else if (alerts.payrollDueSoon) push("payroll-soon", "info", "Salários por pagar em breve", "employees");
  if (alerts.dirtyNearCap) push("dirtycap", "warn", "Cofre de dinheiro sujo quase cheio — produção a ser desperdiçada", "empire");
  if (alerts.raidRisk) push("raid", "danger", "Risco de rusga policial aos laboratórios", "properties");

  const hq = state?.player?.hq;
  const catalogHq = catalog?.hq_level_benefits;
  if (hq && catalogHq && hq.level < (catalog?.hq_max_level || catalogHq.length)) {
    const nextTier = catalogHq[hq.level]; // índice = nível-alvo (hq.level+1) - 1 = hq.level
    const upgrading = hq.upgrading_until && Date.parse(hq.upgrading_until) > Date.now();
    if (!upgrading && nextTier?.upgrade_cost != null && (state?.player?.clean_money || 0) >= nextTier.upgrade_cost) {
      push("hq-upgrade", "opportunity", `Podes melhorar o Quartel-General para o nível ${hq.level + 1} (${fmtMoney(nextTier.upgrade_cost)})`, "hq");
    }
  }

  const ownedTypes = new Set((state?.properties || []).map((p) => p.type_key));
  const buyableCount = Object.entries(catalog?.property_types || {}).filter(
    ([key, pt]) => !ownedTypes.has(key) && (state?.player?.level || 1) >= pt.min_level && (state?.player?.clean_money || 0) >= pt.price
  ).length;
  if (buyableCount > 0) push("expansion", "opportunity", `${buyableCount} propriedade(s) novas disponíveis para comprar`, "properties");

  return items;
}

// Pesos por prioridade — cada chave é o id de um cartão de hqSituationItems.
// Prioridades não listadas explicitamente usam peso 1 (neutro).
const HQ_PRIORITY_WEIGHTS = {
  lucro: { expansion: 3, "hq-upgrade": 2, dirtycap: 3 },
  custos: { payroll: 3, hr: 2, fleet: 2 },
  velocidade: { fleet: 3, teams: 3, hr: 2 },
  reputacao: { claimable: 3, teams: 2, expansion: 2 },
  complexidade: { teams: 2, hr: 2, expansion: 2, "hq-upgrade": 2 },
};

// Dicas do "consultor" do Quartel-General — pondera o painel de situação de
// acordo com a prioridade global ativa. Motor determinístico por regras (não
// chama nenhum serviço de IA externo); a versão do Intel não tem noção de
// prioridade, esta tem.
export function hqAdvisorTips(state, catalog) {
  const priority = state?.player?.priorities?.active || "equilibrio";
  const weights = HQ_PRIORITY_WEIGHTS[priority] || {};
  const severityRank = { danger: 3, warn: 2, opportunity: 1, info: 0 };
  return hqSituationItems(state, catalog)
    .map((it) => ({ ...it, score: weights[it.id] ?? 1 }))
    .sort((a, b) => (severityRank[b.severity] - severityRank[a.severity]) || (b.score - a.score));
}

// KPIs de desempenho do Quartel-General — deriva de state.player.stats
// (contadores já mantidos pelo backend) e state.history (últimas missões
// concluídas), sem precisar de nenhum endpoint novo.
export function hqPerformanceMetrics(state) {
  const stats = state?.player?.stats || {};
  const missionsTotal = stats.missions_total || 0;
  const successRate = missionsTotal > 0 ? (stats.missions_success || 0) / missionsTotal : null;

  const history = state?.history || [];
  const durations = history
    .filter((m) => m.depart_at && m.return_at)
    .map((m) => (Date.parse(m.return_at) - Date.parse(m.depart_at)) / 1000)
    .filter((s) => Number.isFinite(s) && s >= 0);
  const avgDurationS = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const vehicles = state?.vehicles || [];
  const fleetUtilization = vehicles.length ? vehicles.filter((v) => v.team_id).length / vehicles.length : null;

  const netProfit = (stats.earned_clean || 0) + Math.round((stats.laundered_total || 0) * 0.9) - (stats.fines_paid || 0);

  const byCategory = stats.by_category || {};
  const successByCategory = stats.success_by_category || {};
  const categoryBreakdown = Object.entries(byCategory).map(([category, total]) => ({
    category, total, success: successByCategory[category] || 0,
    rate: total > 0 ? (successByCategory[category] || 0) / total : 0,
  }));

  return { successRate, avgDurationS, fleetUtilization, netProfit, missionsTotal, categoryBreakdown };
}

// Classifica um evento do registo de atividade ("Últimos Registos") para o
// painel a abrir ao clicar (nunca a Central de Inteligência por defeito) E
// para a cor do marcador — a mesma análise de conteúdo alimenta as duas
// decisões, para nunca divergirem. O "kind" guardado no backend é por vezes
// genérico (ex.: "police" cobre rusgas, traições, perseguições E subornos;
// "team" cobre tanto a equipa em si como ações individuais de um
// operacional), por isso desambiguamos sempre pelo conteúdo da mensagem.
// Devolve { panel, tab?, color } — "tab" só vem preenchido quando o evento
// aponta para uma decisão/alerta pendente que deve abrir já na aba certa.
//
// Paleta (com significado consistente em todo o jogo):
//   #34D399 esmeralda — sucesso, dinheiro recebido, resolução positiva
//   #F59E0B âmbar     — aviso financeiro, contratempo leve
//   #EF4444 vermelho  — ação policial grave (prisão, rusga, interceção)
//   #F97316 laranja   — incidente não-policial (ferimento, avaria)
//   #F43F5E rosa      — ameaça interna (traição, deslealdade, abandono)
//   #22D3EE ciano     — logística/operações em curso (despacho, combustível)
//   #A78BFA violeta   — imóveis
//   #FBBF24 dourado   — progressão e missões (nível, talento, decisão)
//   #60A5FA azul-céu  — informação neutra do sistema
//   #8E8E93 cinzento  — atividade rotineira da equipa
export function classifyEvent(kind, message) {
  const msg = message || "";

  if (/^DECISÃO:/.test(msg) || /^EVENTO:/.test(msg)) return { panel: "quests", tab: "alertas", color: "#FBBF24" };
  if (/missões diárias|missões semanais|missão sugerida/i.test(msg)) {
    return { panel: "quests", color: "#FBBF24" };
  }

  switch (kind) {
    case "team": {
      // Progressão de carreira de um operacional — dourado, como uma conquista.
      if (/desbloqueou o talento|subiu para o nível/i.test(msg)) return { panel: "employees", color: "#FBBF24" };
      // Movimentação/composição da própria equipa (não de um operacional).
      if (/está pronta|formada por|regressou à base|a caminho de/i.test(msg)) return { panel: "teams", color: "#8E8E93" };
      // Faltou ao trabalho por moral baixa — negativo, mas leve.
      if (/faltou ao trabalho/i.test(msg)) return { panel: "employees", color: "#F59E0B" };
      // Restantes: ações de gestão de um operacional (treino, descanso,
      // promoção, bónus, cura, libertação, despedimento, recrutamento) —
      // sempre iniciadas pelo jogador, por isso esmeralda.
      return { panel: "employees", color: "#34D399" };
    }
    case "dispatch":
      return { panel: "teams", color: "#22D3EE" };
    case "vehicle": {
      if (/avaria inesperada/i.test(msg)) return { panel: "fleet", color: "#F97316" };
      if (/abastecer|depósito cheio/i.test(msg)) return { panel: "fleet", color: "#22D3EE" };
      return { panel: "fleet", color: "#34D399" };
    }
    case "weapon":
      return { panel: "weapons", color: "#34D399" };
    case "shop":
      return { panel: "shop", color: "#38BDF8" };
    case "property":
      return { panel: "properties", color: "#A78BFA" };
    case "launder":
      return { panel: "empire", color: "#34D399" };
    case "police": {
      if (/durante/i.test(msg)) return { panel: "teams", color: /PRESO/.test(msg) ? "#EF4444" : "#F97316" };
      if (/RUSGA|POLÍCIA APANHOU/i.test(msg)) return { panel: /RUSGA/i.test(msg) ? "properties" : "teams", color: "#EF4444" };
      if (/dinheiro sujo|desperdiçad/i.test(msg)) return { panel: "empire", color: "#F59E0B" };
      if (/salári/i.test(msg)) return { panel: "employees", color: "#F59E0B" };
      if (/abandonou a organização|roubou|vendeu informação|sabotou/i.test(msg)) return { panel: "employees", color: "#F43F5E" };
      if (/suborno/i.test(msg)) return { panel: "empire", color: "#34D399" };
      return { panel: "teams", color: "#EF4444" };
    }
    case "success":
      if (/despistou/i.test(msg)) return { panel: "teams", color: "#34D399" };
      return { panel: "quests", color: "#FBBF24" };
    case "system": {
      if (/ciclo salarial pago/i.test(msg)) return { panel: "employees", color: "#F59E0B" };
      if (/sem pessoal e sem fundos/i.test(msg)) return { panel: "employees", color: "#34D399" };
      return { panel: "intel", color: "#60A5FA" };
    }
    case "intel":
    default:
      return { panel: "intel", color: "#FBBF24" };
  }
}


const focusPrefixByEntity = {
  employee: "employee-card",
  team: "team-card",
  vehicle: "vehicle-card",
  weapon: "weapon-card",
  property: "property-card",
  quest: "quest-card",
};

const questTabFor = (quest) => {
  if (quest?.type === "principal") return "historia";
  if (quest?.type === "diaria") return "diarias";
  if (quest?.type === "semanal") return "semanais";
  return "alertas";
};

const longestNamedMatch = (message, items, labels) => {
  const haystack = String(message || "").toLocaleLowerCase("pt-PT");
  return [...(items || [])]
    .map((item) => ({
      item,
      names: labels(item)
        .filter(Boolean)
        .map((name) => String(name).trim())
        .filter((name) => name.length >= 2),
    }))
    .map((entry) => ({
      ...entry,
      hit: entry.names
        .filter((name) => haystack.includes(name.toLocaleLowerCase("pt-PT")))
        .sort((a, b) => b.length - a.length)[0],
    }))
    .filter((entry) => entry.hit)
    .sort((a, b) => b.hit.length - a.hit.length)[0]?.item || null;
};

// Enriches classifyEvent with the concrete object that originated the event.
// Newer events may carry explicit target metadata; legacy events fall back to
// exact entity-name matching so old notifications also become actionable.
export function resolveEventNavigation(state, event) {
  const base = classifyEvent(event?.kind, event?.message);
  if (!state || !event) return base;

  const direct = event.target || (
    event.target_type && event.target_id
      ? { type: event.target_type, id: event.target_id }
      : null
  );
  if (direct?.test_id) return { ...base, focusTestId: direct.test_id };
  if (direct?.type && direct?.id && focusPrefixByEntity[direct.type]) {
    return {
      ...base,
      focusTestId: `${focusPrefixByEntity[direct.type]}-${direct.id}`,
      ...(direct.type === "quest"
        ? { tab: questTabFor((state.quests || []).find((q) => q.id === direct.id || q.quest_key === direct.id)) }
        : {}),
    };
  }

  const msg = event.message || "";
  let item = null;

  if (base.panel === "employees") {
    item = longestNamedMatch(msg, state.employees, (e) => [e.name]);
    if (item) return { ...base, focusTestId: `employee-card-${item.id}` };
    if (/salári|fecho semanal|reserva salarial/i.test(msg)) {
      return { ...base, focusTestId: "employee-payroll-card" };
    }
  }

  if (base.panel === "teams") {
    item = longestNamedMatch(msg, state.teams, (t) => [t.name]);
    if (item) return { ...base, focusTestId: `team-card-${item.id}` };
  }

  if (base.panel === "fleet") {
    item = longestNamedMatch(msg, state.vehicles, (v) => [
      v.name,
      state.catalog?.vehicle_models?.[v.model_key]?.name,
    ]);
    if (item) return { ...base, focusTestId: `vehicle-card-${item.id}` };
  }

  if (base.panel === "weapons") {
    item = longestNamedMatch(msg, state.weapons, (w) => [w.name]);
    if (item) return { ...base, focusTestId: `weapon-card-${item.id}` };
  }

  if (base.panel === "properties") {
    item = longestNamedMatch(msg, state.properties, (p) => [p.name, p.district]);
    if (item) return { ...base, focusTestId: `property-card-${item.id}` };
  }

  if (base.panel === "quests") {
    item = longestNamedMatch(msg, state.quests, (q) => [
      q.title,
      q.name,
      q.quest_key,
    ]);
    if (!item && /^DECISÃO:|^EVENTO:/i.test(msg)) {
      item = [...(state.quests || [])]
        .filter((q) => ["dinamica", "evento", "decisao"].includes(q.type))
        .sort((a, b) => Date.parse(b.activated_at || 0) - Date.parse(a.activated_at || 0))[0];
    }
    if (item) {
      return {
        ...base,
        tab: questTabFor(item),
        focusTestId: `quest-card-${item.id || item.quest_key}`,
      };
    }
  }

  if (base.panel === "empire") {
    if (/suborno|calor|polícia/i.test(msg)) return { ...base, focusTestId: "bribe-police-button" };
    if (/dinheiro sujo|lavagem|lavado|lavar/i.test(msg)) return { ...base, focusTestId: "launder-amount-input" };
  }

  return base;
}

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Algo correu mal. Tenta novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

// ============ QI da Frota (SSS v6) — espelhos EXATOS do engine.py ============
// Réguas expostas em catalog.fleet_meta/vehicle_category_weights — a UI mostra
// os MESMOS números que a chance de missão e a física de viagem usam.

export const VEHICLE_TIERS = {
  rua: { label: "Rua", color: "#A1A1AA" },
  profissional: { label: "Profissional", color: "#22D3EE" },
  executiva: { label: "Executiva", color: "#C084FC" },
  elite: { label: "Elite", color: "#F59E0B" },
};

export function vehicleTier(vm) {
  const lvl = vm?.min_level || 1;
  const key = lvl >= 5 ? "elite" : lvl >= 4 ? "executiva" : lvl >= 2 ? "profissional" : "rua";
  return { key, ...VEHICLE_TIERS[key] };
}

// Espelho de engine.vehicle_mission_score: velocidade+discrição ponderadas
// pela categoria (VEHICLE_CATEGORY_WEIGHTS) — nenhum veículo é "sempre melhor".
export function vehicleMissionScore(vm, category, weights) {
  const all = weights || {};
  const w = all[category] || all["logistica"] || {};
  const denom = (w.speed || 0) + (w.discretion || 0);
  if (!vm || denom <= 0) return 0;
  const speed = Math.min(1, (vm.speed || 0) / 26);
  const discretion = (vm.discretion ?? 50) / 100;
  return (speed * (w.speed || 0) + discretion * (w.discretion || 0)) / denom;
}

// Adequação 0-1 por categoria de operação (score do motor × realce best_for)
// para as 5 mini-barras dos cartões — mesma leitura visual das armas.
export function vehicleAdequacy(vm, catalog) {
  return TEAM_OP_CATEGORIES.map((cat) => {
    const best = (vm?.best_for || []).includes(cat);
    const raw = vehicleMissionScore(vm, cat, catalog?.vehicle_category_weights);
    const score = best ? Math.min(1, raw * 1.25) : (vm?.best_for?.length ? raw * 0.85 : raw);
    return { category: cat, label: SPEC_LABELS[cat] || cat, score: Math.max(0, Math.min(1, score)), best };
  });
}

// Espelho de engine.effective_speed: curva contínua da condição
// (floor + span × (condição/100)^exp) — um veículo a 65% já se ressente.
export function vehicleSpeedFactor(condition, meta) {
  const floor = meta?.speed_floor ?? 0.6;
  const exp = meta?.speed_curve_exp ?? 0.9;
  const c = Math.max(0, Math.min(100, condition ?? 100)) / 100;
  return floor + (1 - floor) * Math.pow(c, exp);
}

// ============ QI do Património (SSS v6) — espelhos do motor passivo ============

export const PROPERTY_TIERS = {
  bairro: { label: "Bairro", color: "#A1A1AA" },
  cidade: { label: "Cidade", color: "#22D3EE" },
  sindicato: { label: "Sindicato", color: "#C084FC" },
  imperial: { label: "Imperial", color: "#F59E0B" },
};

export function propertyTier(pt) {
  const lvl = pt?.min_level || 1;
  const key = lvl >= 4 ? "imperial" : lvl >= 3 ? "sindicato" : lvl >= 2 ? "cidade" : "bairro";
  return { key, ...PROPERTY_TIERS[key] };
}

// Espelho de engine.property_stack_ranks/mult: a 1.ª unidade de cada tipo
// (pela data de compra) rende o bónus cheio, as seguintes rendem menos.
export function propertyStackRank(properties, prop) {
  const same = (properties || [])
    .filter((p) => p.type_key === prop.type_key)
    .sort((a, b) => String(a.bought_at || "").localeCompare(String(b.bought_at || "")));
  const idx = same.findIndex((p) => p.id === prop.id);
  return idx < 0 ? 0 : idx;
}

export function propertyStackMult(rank, meta) {
  const arr = meta?.stack_diminish || [1.0, 0.7, 0.5];
  return arr[Math.min(rank, arr.length - 1)];
}

export function propertyUpgradeCost(pt, level, meta) {
  return Math.round((pt?.price || 0) * (meta?.upgrade_cost_pct ?? 0.6) * (level + 1));
}

// Custo fixo semanal do imóvel. O fecho acontece à segunda-feira às 20:00.
export function propertyMaintPerWeek(pt, level, meta) {
  const weekly = meta?.maintenance_pct_per_week
    ?? ((meta?.maintenance_pct_per_day ?? 0.00008) * 7);
  return (pt?.price || 0) * (level || 1) * weekly;
}

// Alias legado para componentes antigos; devolve o equivalente diário teórico.
export function propertyMaintPerDay(pt, level, meta) {
  return propertyMaintPerWeek(pt, level, meta) / 7;
}

// Payback em horas de subir 1 nível (lavagem passiva devolve 82%).
export function propertyUpgradePaybackH(pt, condition, cost) {
  const rate = (pt?.dirty_per_h || 0) + (pt?.launder_per_h || 0) * 0.82;
  const gain = rate * Math.max(0, Math.min(100, condition ?? 100)) / 100;
  return gain > 0 ? cost / gain : null;
}

// ============ QI do Efetivo (SSS v6) — aptidão por categoria ============
// Espelho da régua de team_effectiveness: atributo relevante ponderado
// (1.º atributo 60%, 2.º 40%) × match de especialização (×1.25 no motor).
export function employeeAdequacy(emp, catalog) {
  const catAttrs = catalog?.team_meta?.category_attrs || {};
  return TEAM_OP_CATEGORIES.map((cat) => {
    const aks = catAttrs[cat] || [];
    const attrs = emp?.attrs || {};
    let attr;
    if (aks.length === 2) attr = (attrs[aks[0]] ?? 2) * 0.6 + (attrs[aks[1]] ?? 2) * 0.4;
    else if (aks.length) attr = aks.reduce((a, k) => a + (attrs[k] ?? 2), 0) / aks.length;
    else {
      const vs = Object.values(attrs);
      attr = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 2;
    }
    const best = emp?.spec === cat;
    const score = Math.max(0, Math.min(1, (attr / 10) * (best || cat === "especial" ? 1.15 : 1)));
    return { category: cat, label: SPEC_LABELS[cat] || cat, score, best, attrs: aks };
  });
}

// ============ QI dos Contratos (SSS v6) — decomposição do multiplicador ============
// Espelho de quests.compute_quest_mult com as réguas de catalog.quest_meta —
// decompõe o reward_mult que o backend envia nos seus fatores.
export function questMultBreakdown(player, q, meta) {
  const m = meta || {};
  const level = Math.max(1, player?.level || 1);
  const lvl = 1 + (m.level_money_slope ?? 0.15) * (level - 1);
  const diff = (m.difficulty_mults || {})[q?.difficulty] ?? 1;
  const tierN = player?.quest_perf?.tier || 0;
  const tier = 1 + (m.tier_bonus ?? 0.08) * tierN;
  const streakCount = player?.quest_streak?.count || 0;
  const streakApplies = (q?.type === "diaria" || q?.type === "semanal") && streakCount > 0;
  const streak = streakApplies
    ? 1 + Math.min(m.streak_bonus_max ?? 0.4, (m.streak_bonus ?? 0.04) * streakCount)
    : 1;
  return {
    level: lvl, difficulty: diff, tier, tierN, streak, streakCount,
    speedBonus: m.speed_bonus ?? 0.1, cap: m.total_mult_cap ?? 4,
  };
}

