import { useId } from "react";

// Emblemas táticos SVG por especialização de equipa (game_data.TEAM_SPECS) —
// viewBox 96x44, mesmo tratamento metálico das silhuetas de armas
// (WeaponGlyph): gradiente vertical claro→escuro, traços escuros de detalhe
// e linha de acento tracejada na base com a cor do tier. Se surgir uma
// especialização nova no backend sem emblema, cai no fallback do assalto.
const EMBLEMS = {
  // Crew de Assalto — retícula de mira + chevrons de avanço.
  assalto: (grad) => (
    <>
      <circle cx="30" cy="22" r="13" fill="none" stroke={grad} strokeWidth="2.6" />
      <circle cx="30" cy="22" r="4" fill={grad} />
      <path d="M30 4 v6 M30 34 v6 M12 22 h6 M42 22 h6" stroke={grad} strokeWidth="2" strokeLinecap="round" />
      <path d="M56 11 L67 22 L56 33" fill="none" stroke={grad} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M68 11 L79 22 L68 33" fill="none" stroke={grad} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.65" />
      <circle cx="30" cy="22" r="8" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="0.9" />
    </>
  ),
  // Rede Logística — camião de carga em marcha + linhas de velocidade.
  logistica: (grad) => (
    <>
      <path d="M10 15 h12 M6 21 h16 M10 27 h12" stroke={grad} strokeWidth="2.4" strokeLinecap="round" />
      <rect x="28" y="11" width="34" height="17" rx="2" fill={grad} />
      <path d="M62 15 h11 l7 7.5 v5.5 h-18 z" fill={grad} />
      <circle cx="38" cy="31.5" r="4.2" fill={grad} stroke="rgba(0,0,0,0.55)" strokeWidth="0.8" />
      <circle cx="68" cy="31.5" r="4.2" fill={grad} stroke="rgba(0,0,0,0.55)" strokeWidth="0.8" />
      <circle cx="38" cy="31.5" r="1.5" fill="rgba(0,0,0,0.5)" />
      <circle cx="68" cy="31.5" r="1.5" fill="rgba(0,0,0,0.5)" />
      <path d="M32 16 h26 M32 21 h26" stroke="rgba(0,0,0,0.4)" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M64.5 17 h7 l4.5 5 h-11.5 z" fill="rgba(0,0,0,0.4)" />
    </>
  ),
  // Célula Técnica — microchip com pistas e nós de rede.
  tecnica: (grad) => (
    <>
      <rect x="32" y="11" width="24" height="22" rx="2.5" fill={grad} />
      <rect x="38.5" y="17.5" width="11" height="9" rx="1" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.1" />
      <path d="M25 15.5 h7 M25 22 h7 M25 28.5 h7" stroke={grad} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M37 6 v5 M44 6 v5 M51 6 v5 M37 33 v5 M44 33 v5 M51 33 v5" stroke={grad} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M56 15.5 h14 M56 28.5 h10" stroke={grad} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="74" cy="15.5" r="2.6" fill={grad} />
      <circle cx="70" cy="28.5" r="2.6" fill={grad} />
      <path d="M74 18 v6 a2 2 0 0 1 -2 2 h-1" fill="none" stroke="rgba(0,0,0,0.0)" strokeWidth="0" />
    </>
  ),
  // Unidade de Influência — coroa com base cravejada + anéis de aliança.
  influencia: (grad) => (
    <>
      <path d="M22 27.5 L22 13.5 L31 21 L38 9.5 L45 21 L54 13.5 L54 27.5 Z" fill={grad} />
      <rect x="22" y="29.5" width="32" height="4" rx="1" fill={grad} />
      <circle cx="29" cy="31.5" r="1.2" fill="rgba(0,0,0,0.5)" />
      <circle cx="38" cy="31.5" r="1.2" fill="rgba(0,0,0,0.5)" />
      <circle cx="47" cy="31.5" r="1.2" fill="rgba(0,0,0,0.5)" />
      <circle cx="68" cy="20" r="7" fill="none" stroke={grad} strokeWidth="2.4" />
      <circle cx="78" cy="26" r="7" fill="none" stroke={grad} strokeWidth="2.4" opacity="0.7" />
      <path d="M26 17 L31 21 M50 17 L45 21" stroke="rgba(0,0,0,0.35)" strokeWidth="0.9" strokeLinecap="round" />
    </>
  ),
};

// `emblemColor` (da loja — Team.emblem_key) tinge o emblema mantendo a sombra
// inferior fixa; sem emblema comprado, cai no metálico cinzento por omissão.
export const TeamGlyph = ({ spec, accent = "#A1A1AA", emblemColor, className = "" }) => {
  const uid = useId().replace(/[:]/g, "");
  const draw = EMBLEMS[spec] || EMBLEMS.assalto;
  const grad = `url(#tg-${uid})`;
  return (
    <svg viewBox="0 0 96 44" className={`sub-team-glyph ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`tg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={emblemColor || "#E4E4E7"} stopOpacity="0.95" />
          <stop offset="0.42" stopColor={emblemColor || "#A1A1AA"} stopOpacity="0.88" />
          <stop offset="0.58" stopColor="#52525B" stopOpacity="0.92" />
          <stop offset="1" stopColor="#27272A" stopOpacity="0.96" />
        </linearGradient>
      </defs>
      {draw(grad)}
      <path d="M8 41 H88" stroke={accent} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  );
};
