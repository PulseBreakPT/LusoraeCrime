import { useId } from "react";

// Silhuetas SVG desenhadas à mão para cada modelo de arma do catálogo
// (game_data.WEAPON_MODELS) — perfil lateral, virado à direita, viewBox
// 120x44. Três camadas: `fills` (corpo metálico com gradiente), `metal`
// (traços grossos metálicos, ex.: bípode), `dark` (detalhes finos escuros,
// ex.: estrias do silenciador). Se surgir um modelo novo no backend sem
// silhueta, cai no fallback da pistola.
const GLYPHS = {
  faca_taser: {
    fills: [
      "M10 18.5 h16 v10 h-16 a5 5 0 0 1 0 -10 z",
      "M26 15.5 h4.5 v16 h-4.5 z",
      "M30.5 19 L98 19 L112 22.5 L96 28 L30.5 28 z",
    ],
    dark: ["M34 22 H92", "M13 21 v5", "M17 21 v5", "M21 21 v5"],
  },
  pistola: {
    fills: [
      "M24 13 h56 a2 2 0 0 1 2 2 v5 a2 2 0 0 1 -2 2 h-56 z",
      "M82 15 h8 v5.5 h-8 z",
      "M27 10.5 h3 v2.5 h-3 z",
      "M76 10.5 h3 v2.5 h-3 z",
      "M36 22 h44 v4.5 h-44 z",
      "M52 26.5 q0 7.5 8 7.5 h3 v-3 h-3 q-4.5 0 -4.5 -4.5 z",
      "M24 22 L40 22 L36 39 L23 39 Z",
    ],
    dark: ["M30 17.5 h46", "M27 36 l8 0"],
  },
  pistola_silenciada: {
    fills: [
      "M20 14 h54 a2 2 0 0 1 2 2 v4.5 a2 2 0 0 1 -2 2 h-54 z",
      "M76 14.8 h31 a3.4 3.4 0 0 1 3.4 3.4 a3.4 3.4 0 0 1 -3.4 3.4 h-31 z",
      "M23 11.5 h3 v2.5 h-3 z",
      "M32 22.5 h42 v4 h-42 z",
      "M48 26.5 q0 7 7.5 7 h3 v-3 h-3 q-4 0 -4 -4 z",
      "M20 22.5 L36 22.5 L32 39.5 L19 39.5 Z",
    ],
    dark: ["M82 15.8 V21", "M88 15.8 V21", "M94 15.8 V21", "M100 15.8 V21", "M26 18.2 h44"],
  },
  espingarda: {
    fills: [
      "M4 16.5 L22 14.5 L22 27.5 L9 29.5 Q4 28.5 4 23.5 Z",
      "M22 15 h26 v10.5 h-26 z",
      "M48 16.5 h64 v4 h-64 z",
      "M48 21 h44 v2.5 h-44 z",
      "M56 23.5 h20 a2 2 0 0 1 2 2 v2 a2 2 0 0 1 -2 2 h-20 a2 2 0 0 1 -2 -2 v-2 a2 2 0 0 1 2 -2 z",
      "M34 25.5 q0.5 6 6.5 6 h2 v-2.5 h-2 q-3.5 0 -4 -3.5 z",
      "M108 14.5 h2.5 v2 h-2.5 z",
    ],
    dark: ["M60 25.7 h12", "M8 20 L18 18.6"],
  },
  cacadeira_serrada: {
    fills: [
      "M12 17 L26 16 L28 27 L18 33 Q11 33.5 11 27 Z",
      "M26 14.5 h18 v11.5 h-18 z",
      "M44 15 h42 v4.5 h-42 z",
      "M44 20.5 h42 v4.5 h-42 z",
      "M28 11.5 l4 0 l1.5 3 h-5.5 z",
      "M32 26 q0.5 6.5 7 6.5 h2 v-2.5 h-2 q-4 0 -4.5 -4 z",
    ],
    dark: ["M86 15 V25", "M48 17.2 h34", "M48 22.7 h34"],
  },
  submetralhadora: {
    fills: [
      "M8 16.5 h18 v2.5 h-18 z",
      "M8 16.5 h2.5 v12 h-2.5 z",
      "M9 28.5 L26 21 L26 23.8 L10.8 30.5 Z",
      "M26 13.5 h50 v11 h-50 z",
      "M76 15.5 h18 v4.5 h-18 z",
      "M88 11 h2.8 v4.5 h-2.8 z",
      "M46 24.5 L58 24.5 L54.5 41.5 L42.5 41.5 Z",
      "M62 24.5 L72 24.5 L69.5 36 L60 36 Z",
    ],
    dark: ["M56 16.5 h12", "M30 20 h12"],
  },
  rifle_assalto: {
    fills: [
      "M4 15.5 L20 16 L20 26 L11 29.5 Q4 29.5 4 23 Z",
      "M20 14 h50 v10.5 h-50 z",
      "M24 10 h10 v4 h-10 z",
      "M70 16.5 h36 v4 h-36 z",
      "M88 9.5 h3 v9 h-3 z",
      "M106 15.5 h5 v6 h-5 z",
      "M70 21.5 h20 v2.8 h-20 z",
      "M26 24.5 L36 24.5 L33 36.5 L24.5 36.5 Z",
      "M42 24.5 L56 24.5 Q56 33 62 38 L52 40.5 Q44 34 42 24.5 Z",
      "M37 24.5 q0.5 5.5 5 5.5 h1.5 v-2.3 h-1.5 q-2.5 0 -3 -3.2 z",
    ],
    dark: ["M24 18.5 h42", "M46 27.5 q1.5 6 5.5 9.5"],
  },
  rifle_precisao: {
    fills: [
      "M4 17.5 L24 16 L24 27 L14 30.5 Q4 30 4 23.5 Z",
      "M7 13.5 L20 13 L20 17 L7 17.5 Z",
      "M24 17 h40 v8.5 h-40 z",
      "M64 18.8 h44 v3.4 h-44 z",
      "M108 17.8 h5 v5.4 h-5 z",
      "M33 9 h20 v4.5 h-20 z",
      "M53 8 h6 v6.5 h-6 z",
      "M28 8.5 h5 v5.5 h-5 z",
      "M36 13.5 h3 v3.5 h-3 z",
      "M48 13.5 h3 v3.5 h-3 z",
      "M38 25.5 h11 v5.5 h-11 z",
      "M27 25.5 L35 25.5 L32 35 L25.5 35 Z",
      "M58 17 l4 -3 l1.5 1.8 l-4 3 z",
    ],
    dark: ["M28 21 h32", "M109.5 18.6 v3.8", "M111.5 18.6 v3.8"],
  },
  metralhadora_ligeira: {
    fills: [
      "M4 14.5 L20 15 L20 27 L9 29.5 Q4 28 4 21.5 Z",
      "M20 12.5 h52 v13.5 h-52 z",
      "M34 7.5 h18 v3 h-18 z",
      "M36 10.5 h3 v2 h-3 z",
      "M47 10.5 h3 v2 h-3 z",
      "M72 15.5 h34 v5.5 h-34 z",
      "M106 14.5 h6 v7.5 h-6 z",
      "M34 26 h22 v13.5 h-22 z",
      "M60 26 L68 26 L66 36.5 L58 36.5 Z",
    ],
    metal: ["M80 21 L73 39", "M82 21 L91 39"],
    dark: ["M34 29.5 h22", "M24 17 h44", "M76 18.2 h26"],
  },
};

export const WeaponGlyph = ({ modelKey, accent = "#A1A1AA", className = "" }) => {
  const uid = useId().replace(/[:]/g, "");
  const g = GLYPHS[modelKey] || GLYPHS.pistola;
  return (
    <svg viewBox="0 0 120 44" className={`lus-weapon-glyph ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`wg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E4E4E7" stopOpacity="0.95" />
          <stop offset="0.42" stopColor="#A1A1AA" stopOpacity="0.88" />
          <stop offset="0.58" stopColor="#52525B" stopOpacity="0.92" />
          <stop offset="1" stopColor="#27272A" stopOpacity="0.96" />
        </linearGradient>
      </defs>
      {g.fills.map((d, i) => (
        <path key={i} d={d} fill={`url(#wg-${uid})`} stroke="rgba(0,0,0,0.55)" strokeWidth="0.6" strokeLinejoin="round" />
      ))}
      {(g.metal || []).map((d, i) => (
        <path key={`m${i}`} d={d} fill="none" stroke={`url(#wg-${uid})`} strokeWidth="2" strokeLinecap="round" />
      ))}
      {(g.dark || []).map((d, i) => (
        <path key={`d${i}`} d={d} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="0.9" strokeLinecap="round" />
      ))}
      <path d="M8 41 H112" stroke={accent} strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  );
};
