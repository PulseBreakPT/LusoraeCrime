import { Crosshair, Car, Package, Truck, Banknote, HandCoins, Swords, VenetianMask, Terminal, Crown, Star, Zap, Eye, Target, Landmark, Globe, CreditCard } from "lucide-react";

// Cor única para "precisa da tua atenção" (badges/dots de notificação) — o
// mesmo laranja já usado no resto do site (heatStatus "Alerta", feridos, etc.).
export const NOTIFY_COLOR = "#F97316";

// Preferências de exibição (Definições > Interface) — estado global simples em
// vez de prop-drilling, porque fmtMoney/fmtDuration são chamadas de dezenas de
// sítios diferentes em toda a interface.
const DISPLAY_PREFS_KEY = "lusorae.ui.displayPrefs";
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
  roubo_joalharia: Crosshair,
  assalto_licorista: Car,
  roubo_carga: Swords,
  assalto_penhores: Target,
  assalto_blindado: Crosshair,
  emboscada_rival: Car,
  assalto_casino: Swords,
  sequestro_relampago: Target,
  assalto_museu: Crosshair,
  guerra_territorio: Car,

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
  roubo_obra_arte: Star,
  operacao_encoberta: Crown,
  resgate_refem: VenetianMask,
  leilao_clandestino: Star,
  venda_armamento: Crown,
  fuga_prisao: VenetianMask,
  assassinato_contrato: Star,
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

export const DIFFICULTY_COLORS = { facil: "#34D399", normal: "#22D3EE", dificil: "#F59E0B", elite: "#C084FC", lendaria: "#F43F5E" };

export const CHAPTER_LABELS = {
  1: "Capítulo 1 — Começo",
  2: "Capítulo 2 — Expansão",
  3: "Capítulo 3 — Organização",
  4: "Capítulo 4 — Domínio",
  5: "Capítulo 5 — Consolidação",
  6: "Capítulo 6 — Legado",
};

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

export function parseActivityMessage(message) {
  const React = require('react');
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
    while ((m = regex.exec(message)) !== null) {
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
      parts.push(message.substring(lastIdx, match.start));
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

  if (lastIdx < message.length) {
    parts.push(message.substring(lastIdx));
  }

  return parts.length > 0 ? parts : message;
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

export function teamsReadiness(state, now = Date.now()) {
  let ready = 0, busy = 0;
  const teams = state?.teams || [];
  teams.forEach((t) => {
    if (t.status !== "idle") { busy += 1; return; }
    if (t.available_at && Date.parse(t.available_at) > now) return;
    const members = (state.employees || []).filter((e) => e.team_id === t.id);
    const active = members.filter((e) => e.status === "idle" && e.fatigue < 90);
    const vehicle = (state.vehicles || []).find((v) => v.id === t.vehicle_id);
    const ok = active.length > 0 && vehicle && vehicle.condition >= 30 && vehicle.fuel_l >= vehicle.tank_l * 0.12;
    if (ok) ready += 1;
  });
  return { ready, busy, total: teams.length };
}

// Existe pelo menos uma equipa capaz de despachar para esta oportunidade agora
// (membros suficientes para o risco, veículo em condições, compatível se exigir
// um modelo específico)? Usado por "Ocultar missões impossíveis" (Definições).
export function opportunityReachable(state, opp) {
  const teams = state?.teams || [];
  const now = Date.now();
  return teams.some((t) => {
    if (t.status !== "idle") return false;
    if (t.available_at && Date.parse(t.available_at) > now) return false;
    const members = (state.employees || []).filter((e) => e.team_id === t.id);
    const ready = members.filter((e) => e.status === "idle" && e.fatigue < 90);
    if (ready.length < (opp.min_members || 1)) return false;
    const vehicle = (state.vehicles || []).find((v) => v.id === t.vehicle_id);
    if (!vehicle || vehicle.condition < 20 || vehicle.fuel_l < vehicle.tank_l * 0.05) return false;
    if (vehicle.refueling_until && Date.parse(vehicle.refueling_until) > now) return false;
    if (opp.required_models?.length > 0 && !opp.required_models.includes(vehicle.model_key)) return false;
    return true;
  });
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

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Algo correu mal. Tenta novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
