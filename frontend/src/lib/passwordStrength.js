/**
 * Avaliação de força de palavras-passe do Lusorae.
 * Política (igual à do servidor): mínimo 8 caracteres, 1 minúscula,
 * 1 maiúscula e 1 número. A pontuação 0-4 é informativa e premeia
 * comprimento e símbolos extra.
 */

export const PASSWORD_REQUIREMENTS = [
  { key: "length", label: "Mínimo 8 caracteres", test: (p) => p.length >= 8 },
  { key: "lower", label: "Uma letra minúscula (a-z)", test: (p) => /[a-z]/.test(p) },
  { key: "upper", label: "Uma letra maiúscula (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { key: "digit", label: "Um número (0-9)", test: (p) => /[0-9]/.test(p) },
];

const COMMON_PATTERNS = [
  "password", "palavrapasse", "12345678", "123456789", "qwerty",
  "abcdefgh", "lusorae", "11111111", "00000000", "iloveyou",
];

const LABELS = ["Vazia", "Fraca", "Razoável", "Boa", "Excelente"];
const COLORS = ["bg-zinc-700", "bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"];
const TEXT_COLORS = ["text-zinc-500", "text-red-400", "text-amber-400", "text-emerald-400", "text-emerald-300"];

export function evaluatePassword(password) {
  const p = password || "";
  const requirements = PASSWORD_REQUIREMENTS.map((r) => ({
    key: r.key,
    label: r.label,
    met: r.test(p),
  }));
  const meetsPolicy = requirements.every((r) => r.met);

  let score = 0;
  if (p.length > 0) score = 1;
  if (meetsPolicy) score = 2;
  if (meetsPolicy && (p.length >= 10 || /[^A-Za-z0-9]/.test(p))) score = 3;
  if (meetsPolicy && p.length >= 12 && /[^A-Za-z0-9]/.test(p)) score = 4;

  // Padrões demasiado comuns nunca passam de "Razoável"
  const lowered = p.toLowerCase();
  if (score > 2 && COMMON_PATTERNS.some((c) => lowered.includes(c))) score = 2;

  return {
    score,
    label: LABELS[score],
    barColor: COLORS[score],
    textColor: TEXT_COLORS[score],
    requirements,
    meetsPolicy,
  };
}
