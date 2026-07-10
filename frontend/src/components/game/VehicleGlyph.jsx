import { useId } from "react";

// Silhuetas SVG desenhadas à mão para cada modelo de veículo do catálogo
// (game_data.VEHICLE_MODELS) — perfil lateral, virado à direita, viewBox
// 120x44, mesmo tratamento metálico das silhuetas de armas (WeaponGlyph):
// gradiente vertical claro→escuro no corpo, detalhes escuros (janelas,
// grelhas) e rodas com aro escuro. Se surgir um modelo novo no backend sem
// silhueta, cai no fallback do sedan usado.
const wheel = (cx, r = 5.6) => (
  <>
    <circle cx={cx} cy="33.5" r={r} fill="#18181B" stroke="#3F3F46" strokeWidth="1.4" />
    <circle cx={cx} cy="33.5" r={r * 0.42} fill="#52525B" />
  </>
);

const GLYPHS = {
  // Sedan Usado — três volumes clássicos, honesto e anónimo.
  usado: (grad) => (
    <>
      <path d="M10 32 v-6 q0 -3 5 -3.5 l14 -1.5 l10 -8 q2 -1.6 5 -1.6 h22 q3 0 5 2 l8 7.6 l16 2 q5 0.8 5.6 4 l0.8 5 z" fill={grad} />
      <path d="M42 19.5 l8 -6.4 q1 -0.8 2.6 -0.8 h9.4 v7.2 z M66 19.5 v-7.2 h8.4 q1.6 0 2.8 1.2 l6 6 z" fill="rgba(0,0,0,0.5)" />
      <path d="M13 26.5 h6" stroke="rgba(0,0,0,0.35)" strokeWidth="1.4" strokeLinecap="round" />
      {wheel(32)}
      {wheel(88)}
    </>
  ),
  // Moto Rápida — duas rodas, quadro exposto e guiador.
  moto: (grad) => (
    <>
      <path d="M40 22 l14 -2 l16 1 l8 6 l-6 4 l-20 0 z" fill={grad} />
      <path d="M52 20 l-4 -8 h8 l3 7 z" fill={grad} />
      <path d="M84 14 l4 -3 M84 14 l-6 13" stroke={grad} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M44 21 l-10 11 M60 21 l14 6" stroke="rgba(0,0,0,0.45)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="30" cy="32" r="7.4" fill="none" stroke={grad} strokeWidth="3" />
      <circle cx="88" cy="32" r="7.4" fill="none" stroke={grad} strokeWidth="3" />
    </>
  ),
  // Van Reforçada — caixa alta de trabalho.
  van: (grad) => (
    <>
      <path d="M12 32 v-19 q0 -3 3 -3 h58 q3 0 5 2 l12 10 l14 2.4 q4 0.8 4.6 4 l0.6 3.6 z" fill={grad} />
      <path d="M76 13 l9.4 8 h-13 v-8 z" fill="rgba(0,0,0,0.5)" />
      <path d="M18 15 h48 M18 21 h48" stroke="rgba(0,0,0,0.28)" strokeWidth="1.2" />
      {wheel(30)}
      {wheel(92)}
    </>
  ),
  // Desportivo — coupé baixo e agressivo.
  desportivo: (grad) => (
    <>
      <path d="M8 32 l2 -5 q1 -2.4 5 -3 l20 -2.6 l12 -7 q2.4 -1.4 5.4 -1.4 h14 q3.4 0 6 1.8 l10 6.6 l22 3 q5 0.8 6 4.2 l1 3.4 z" fill={grad} />
      <path d="M48 19.8 l10 -5.6 h8 l8.6 5.6 z" fill="rgba(0,0,0,0.5)" />
      <path d="M104 24 h8" stroke="rgba(0,0,0,0.4)" strokeWidth="1.6" strokeLinecap="round" />
      {wheel(32, 5.2)}
      {wheel(90, 5.2)}
    </>
  ),
  // SUV Blindado — alto, quadrado, presença.
  suv_blindado: (grad) => (
    <>
      <path d="M10 32 v-9 q0 -3 4 -3.6 l8 -1.2 l8 -8.6 q1.6 -1.6 4.4 -1.6 h42 q3 0 4.6 1.8 l7.4 8.4 l14 1.6 q4 0.6 4.6 3.8 l1 8.4 z" fill={grad} />
      <path d="M34 17.6 l6 -6.6 h14 v6.6 z M58 17.6 v-6.6 h16 q1.4 0 2.4 1.2 l4.6 5.4 z" fill="rgba(0,0,0,0.5)" />
      <path d="M12 25 h8 M100 25 h8" stroke="rgba(0,0,0,0.35)" strokeWidth="1.8" strokeLinecap="round" />
      {wheel(32, 6.2)}
      {wheel(88, 6.2)}
    </>
  ),
  // Supercarro — cunha rasteira.
  supercarro: (grad) => (
    <>
      <path d="M6 32 l3 -3.6 q1.4 -1.8 4.6 -2.4 l26 -4 l16 -7.4 q2.6 -1.2 5.6 -1.2 h8 q3.6 0 6.4 2 l8 5.6 l24 4.6 q4.6 1 5.4 3.6 l0.8 2.8 z" fill={grad} />
      <path d="M56 19.2 l12 -5.2 h4.6 l7 4.8 z" fill="rgba(0,0,0,0.5)" />
      <path d="M100 20 l12 -2.4" stroke={grad} strokeWidth="2.2" strokeLinecap="round" />
      {wheel(30, 5)}
      {wheel(92, 5)}
    </>
  ),
  // Carrinha de Entregas — cabina + caixa de carga.
  carrinha_entrega: (grad) => (
    <>
      <path d="M40 30 v-19 q0 -2.6 2.6 -2.6 h52 q2.6 0 2.6 2.6 v19 z" fill={grad} />
      <path d="M12 32 v-12 q0 -2.6 2.6 -2.6 h10 l7 -6.4 q1.4 -1.2 3.2 -1.2 h3.2 v22.2 z" fill={grad} />
      <path d="M18 18.6 l5.4 -5 h6.6 v5 z" fill="rgba(0,0,0,0.5)" />
      <path d="M46 13 h44 M46 17.6 h44" stroke="rgba(0,0,0,0.28)" strokeWidth="1.1" />
      {wheel(26)}
      {wheel(84)}
    </>
  ),
  // Berlina Blindada — sedan longo de vidros escuros.
  berlina_blindada: (grad) => (
    <>
      <path d="M8 32 v-6 q0 -3 5 -3.4 l16 -1.6 l9 -8 q2 -1.8 5 -1.8 h30 q3 0 5 1.8 l9 7.6 l18 2 q5 0.6 5.6 3.8 l0.8 5.6 z" fill={grad} />
      <path d="M40 20.4 l7.4 -6.6 q1 -0.9 2.4 -0.9 h12.2 v7.5 z M66 20.4 v-7.5 h11 q1.6 0 2.8 1.1 l7 6.4 z" fill="rgba(0,0,0,0.62)" />
      <path d="M10 27 h7 M102 27 h7" stroke="rgba(0,0,0,0.35)" strokeWidth="1.6" strokeLinecap="round" />
      {wheel(31)}
      {wheel(90)}
    </>
  ),
  // Buggy Todo-o-Terreno — rollcage aberto e rodas grandes.
  buggy_todo_terreno: (grad) => (
    <>
      <path d="M16 30 l6 -8 h60 l14 8 z" fill={grad} />
      <path d="M36 22 l8 -12 h22 l10 12" fill="none" stroke={grad} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 22 v-11 M64 22 v-11" stroke="rgba(0,0,0,0.4)" strokeWidth="1.8" />
      {wheel(30, 7.2)}
      {wheel(88, 7.2)}
    </>
  ),
  // Limousine — comprimento é estatuto.
  limousine: (grad) => (
    <>
      <path d="M4 32 v-5 q0 -2.8 4.6 -3.2 l12 -1.2 l8 -7 q2 -1.8 5 -1.8 h56 q3 0 4.8 1.6 l7 6.6 l9 1.4 q4.6 0.8 5.2 3.8 l0.8 4.8 z" fill={grad} />
      <path d="M32 20.6 l6.4 -5.8 q1 -0.9 2.4 -0.9 h7.6 v6.7 z M52 20.6 v-6.7 h12 v6.7 z M68 20.6 v-6.7 h12 v6.7 z M84 20.6 v-6.7 h6.6 q1.4 0 2.4 1 l5.4 5.7 z" fill="rgba(0,0,0,0.62)" />
      {wheel(26)}
      {wheel(96)}
    </>
  ),
  // Carro Furtivo — coupé liso, sem arestas que reflitam.
  carro_furtivo: (grad) => (
    <>
      <path d="M8 32 q0 -6 8 -7.4 l18 -3 l14 -8 q2.4 -1.4 5.4 -1.4 h12 q3 0 5.6 1.6 l12 7.6 l20 3.2 q7 1.2 7.6 5.4 l0.3 2 z" fill={grad} />
      <path d="M50 20 l11 -6.4 h7 l9.6 6.2 z" fill="rgba(0,0,0,0.55)" />
      <path d="M20 25.6 q28 -4 80 0" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      {wheel(32, 5.2)}
      {wheel(90, 5.2)}
    </>
  ),
};
GLYPHS.moto_rapida = GLYPHS.moto;

export const VehicleGlyph = ({ modelKey, accent = "#A1A1AA", className = "" }) => {
  const uid = useId().replace(/[:]/g, "");
  const draw = GLYPHS[modelKey] || GLYPHS.usado;
  const grad = `url(#vg-${uid})`;
  return (
    <svg viewBox="0 0 120 44" className={`lus-doss-glyph ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`vg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E4E4E7" stopOpacity="0.95" />
          <stop offset="0.42" stopColor="#A1A1AA" stopOpacity="0.88" />
          <stop offset="0.58" stopColor="#52525B" stopOpacity="0.92" />
          <stop offset="1" stopColor="#27272A" stopOpacity="0.96" />
        </linearGradient>
      </defs>
      {draw(grad)}
      <path d="M10 41 H110" stroke={accent} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  );
};
