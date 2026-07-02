import { Crosshair, Car, Package, Truck, Banknote, HandCoins, Swords, VenetianMask, Terminal, Crown, Star } from "lucide-react";

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
};

export const SPEC_LABELS = {
  assalto: "Assalto",
  logistica: "Logística",
  tecnica: "Técnica",
  influencia: "Influência",
  especial: "Especial",
};

export const ROLE_LABELS = {
  musculo: "Músculo",
  condutor: "Condutor",
  hacker: "Hacker",
  negociador: "Negociador",
};

export const EMP_STATUS_LABELS = {
  idle: "Disponível",
  on_mission: "Em missão",
  training: "Em formação",
};

export const EMP_STATUS_COLORS = {
  idle: "#34D399",
  on_mission: "#EF4444",
  training: "#22D3EE",
};

export const FUEL_LABELS = { gasolina: "Gasolina", gasoleo: "Gasóleo" };

export const ATTR_LABELS = { forca: "FOR", destreza: "DES", qi: "QI", carisma: "CAR" };

export const SPEC_ATTR = { assalto: "forca", logistica: "destreza", tecnica: "qi", influencia: "carisma" };

export function effectiveSpeed(v) {
  if (v.condition >= 50) return v.speed;
  return v.speed * (0.6 + (0.4 * v.condition) / 50);
}

export function chanceColor(c) {
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

export function propertyBenefit(pt, level = 1) {
  const parts = [];
  if (pt.cap_employees) parts.push(`+${pt.cap_employees * level} funcionários`);
  if (pt.cap_vehicles) parts.push(`+${pt.cap_vehicles * level} veículos`);
  if (pt.dirty_per_h) parts.push(`+${pt.dirty_per_h * level} €/h sujos`);
  if (pt.launder_per_h) parts.push(`lava ${pt.launder_per_h * level} €/h`);
  if (pt.heat_per_h) parts.push(`+${(pt.heat_per_h * level).toFixed(1)} calor/h`);
  if (pt.bonus_pct) parts.push(`+${Math.round(pt.bonus_pct * level * 100)}% ${pt.bonus_label}`);
  if (pt.repair_discount_pct) parts.push(`-${Math.round(pt.repair_discount_pct * level * 100)}% reparações`);
  return parts.join(" · ");
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
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " €";
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

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Algo correu mal. Tenta novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
