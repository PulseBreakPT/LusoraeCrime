import { useId } from "react";

// Emblemas SVG por tipo de imóvel do catálogo (game_data.PROPERTY_TYPES) —
// viewBox 96x44, mesmo tratamento metálico dos emblemas de equipa
// (TeamGlyph): gradiente vertical claro→escuro, detalhes escuros e linha de
// acento tracejada na base com a cor do tier. Tipos novos sem emblema caem
// no fallback do esconderijo.
const GLYPHS = {
  // Esconderijo — casa discreta de janela tapada.
  esconderijo: (grad) => (
    <>
      <path d="M28 20 L48 7 L68 20 v18 h-40 z" fill={grad} />
      <path d="M24 21 L48 5.4 L72 21" fill="none" stroke={grad} strokeWidth="3" strokeLinecap="round" />
      <rect x="42.6" y="26" width="10.8" height="12" fill="rgba(0,0,0,0.5)" />
      <path d="M32 24 h6 M32 27.5 h6 M58 24 h6 M58 27.5 h6" stroke="rgba(0,0,0,0.45)" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  // Garagem — portão de lâminas.
  garagem: (grad) => (
    <>
      <path d="M24 18 L48 8 L72 18 v20 h-48 z" fill={grad} />
      <rect x="31" y="20" width="34" height="18" fill="rgba(0,0,0,0.5)" />
      <path d="M33 24 h30 M33 28 h30 M33 32 h30" stroke={grad} strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  // Empresa de Fachada — torre de escritórios limpa.
  empresa_legal: (grad) => (
    <>
      <rect x="34" y="7" width="28" height="31" rx="1.4" fill={grad} />
      <path d="M39 12 h5 M39 17 h5 M39 22 h5 M39 27 h5 M52 12 h5 M52 17 h5 M52 22 h5 M52 27 h5" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round" />
      <rect x="44" y="31" width="8" height="7" fill="rgba(0,0,0,0.5)" />
      <path d="M26 38 h44" stroke={grad} strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  // Armazém — nave de telhado serrado.
  armazem: (grad) => (
    <>
      <path d="M20 38 v-18 l14 -8 v8 l14 -8 v8 l14 -8 v26 z" fill={grad} />
      <rect x="26" y="27" width="12" height="11" fill="rgba(0,0,0,0.5)" />
      <path d="M48 27 h16 M48 31 h16" stroke="rgba(0,0,0,0.45)" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  // Laboratório — balão de ensaio em ebulição.
  laboratorio: (grad) => (
    <>
      <path d="M43 7 h10 v10 l10 16 q2 4 -2.6 4 h-24.8 q-4.6 0 -2.6 -4 l10 -16 z" fill={grad} />
      <path d="M40 26 h16" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="45" cy="31" r="1.6" fill="rgba(0,0,0,0.5)" />
      <circle cx="51" cy="33" r="1.2" fill="rgba(0,0,0,0.5)" />
      <path d="M66 12 q3 -3 0 -6 M72 16 q3 -3 0 -6" stroke={grad} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M41 7 h14" stroke={grad} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  // Oficina — chave de bocas sobre o portão.
  oficina: (grad) => (
    <>
      <path d="M22 20 L48 10 L74 20 v18 h-52 z" fill={grad} />
      <rect x="30" y="24" width="22" height="14" fill="rgba(0,0,0,0.5)" />
      <path d="M58 25 a6 6 0 1 0 6 9.5 l6 -1 l-2 -5.5 l-5.5 0.5 a6 6 0 0 0 -4.5 -3.5 z" fill="rgba(0,0,0,0.55)" />
      <path d="M33 28 h16 M33 32 h16" stroke={grad} strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  // Porto Clandestino — grua e contentor.
  porto_clandestino: (grad) => (
    <>
      <path d="M30 38 v-26 l24 8 M30 16 h34" fill="none" stroke={grad} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 16 v6" stroke={grad} strokeWidth="2" />
      <rect x="52" y="22" width="16" height="10" fill={grad} />
      <path d="M56 23.5 v7 M60 23.5 v7 M64 23.5 v7" stroke="rgba(0,0,0,0.45)" strokeWidth="1.4" />
      <path d="M20 38 h56 M24 41 q6 -3 12 0 q6 3 12 0 q6 -3 12 0 q6 3 12 0" stroke={grad} strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  // Posto de Vigilância — torre com antena e olho.
  posto_vigilancia: (grad) => (
    <>
      <path d="M40 38 l4 -20 h8 l4 20 z" fill={grad} />
      <rect x="38" y="12" width="20" height="7" rx="1.4" fill={grad} />
      <path d="M48 12 v-6 M44 6 h8" stroke={grad} strokeWidth="2" strokeLinecap="round" />
      <circle cx="48" cy="15.5" r="1.8" fill="rgba(0,0,0,0.55)" />
      <path d="M64 14 a10 10 0 0 1 4 8 M68 10 a15 15 0 0 1 6 12" fill="none" stroke={grad} strokeWidth="2" strokeLinecap="round" />
      <path d="M42 26 h12 M41 31 h14" stroke="rgba(0,0,0,0.45)" strokeWidth="1.4" />
    </>
  ),
  // Escritório de Advocacia — fachada clássica de colunas.
  escritorio_advocacia: (grad) => (
    <>
      <path d="M26 18 L48 8 L70 18 z" fill={grad} />
      <path d="M30 20 v14 M39 20 v14 M48 20 v14 M57 20 v14 M66 20 v14" stroke={grad} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M26 37 h44" stroke={grad} strokeWidth="3" strokeLinecap="round" />
      <path d="M30 20 v14 M48 20 v14 M66 20 v14" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
    </>
  ),
  // Arsenal — bunker de porta blindada.
  arsenal: (grad) => (
    <>
      <path d="M24 38 v-14 q0 -12 24 -12 q24 0 24 12 v14 z" fill={grad} />
      <rect x="42" y="24" width="12" height="14" rx="1" fill="rgba(0,0,0,0.55)" />
      <circle cx="48" cy="30" r="2.4" fill="none" stroke={grad} strokeWidth="1.4" />
      <path d="M30 22 h6 M60 22 h6" stroke="rgba(0,0,0,0.45)" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // Casa de Câmbio — edifício com cifrão.
  casa_cambio: (grad) => (
    <>
      <rect x="30" y="12" width="36" height="26" rx="1.6" fill={grad} />
      <path d="M26 12 h44" stroke={grad} strokeWidth="3" strokeLinecap="round" />
      <path d="M53 20 q-1.6 -2.4 -5 -2.4 q-4.4 0 -4.4 3.2 q0 2.6 4.4 3.2 q5 0.6 5 3.6 q0 3.4 -5 3.4 q-3.6 0 -5.2 -2.4 M48 15 v20" fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="2" strokeLinecap="round" />
      <path d="M34 17 v17 M62 17 v17" stroke="rgba(0,0,0,0.3)" strokeWidth="1.4" />
    </>
  ),
  // Centro Logístico — nave grande com contentores empilhados.
  centro_logistico: (grad) => (
    <>
      <path d="M16 38 v-16 l20 -9 l20 9 v16 z" fill={grad} />
      <rect x="24" y="27" width="14" height="11" fill="rgba(0,0,0,0.5)" />
      <rect x="60" y="28" width="11" height="10" fill={grad} />
      <rect x="72" y="28" width="11" height="10" fill={grad} />
      <rect x="66" y="18" width="11" height="9" fill={grad} />
      <path d="M63 30 v6 M75 30 v6 M69 20 v5" stroke="rgba(0,0,0,0.45)" strokeWidth="1.4" />
    </>
  ),
};

export const PropertyGlyph = ({ typeKey, accent = "#A1A1AA", className = "" }) => {
  const uid = useId().replace(/[:]/g, "");
  const draw = GLYPHS[typeKey] || GLYPHS.esconderijo;
  const grad = `url(#pg-${uid})`;
  return (
    <svg viewBox="0 0 96 44" className={`sub-doss-glyph ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`pg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E4E4E7" stopOpacity="0.95" />
          <stop offset="0.42" stopColor="#A1A1AA" stopOpacity="0.88" />
          <stop offset="0.58" stopColor="#52525B" stopOpacity="0.92" />
          <stop offset="1" stopColor="#27272A" stopOpacity="0.96" />
        </linearGradient>
      </defs>
      {draw(grad)}
      <path d="M8 41 H88" stroke={accent} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  );
};
