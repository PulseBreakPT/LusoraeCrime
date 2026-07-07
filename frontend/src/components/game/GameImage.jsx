import { useState } from "react";
import { bannerImage } from "../../lib/images";

// Imagem que degrada suavemente para um fallback (normalmente um ícone) quando a
// URL externa não carrega — garante que nenhuma foto removida ou serviço em baixo
// mostra o glifo de "imagem partida". Faz também um fade-in ao carregar.
//
// Uso: <GameImage src={vehicleImage(key)} alt="..." className="h-full w-full object-cover"
//                 fallback={<Car size={20} className="text-zinc-600" />} />
export const GameImage = ({ src, alt = "", className = "", fallback = null, onLoadedChange }) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) return fallback;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => { setFailed(true); onLoadedChange && onLoadedChange(false); }}
      onLoad={() => { setLoaded(true); onLoadedChange && onLoadedChange(true); }}
      className={className}
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.35s ease" }}
    />
  );
};

// Banner de topo full-bleed para os cabeçalhos dos painéis principais. Assume
// que o pai é um SheetContent com padding p-6 (usa margens negativas para
// chegar às bordas). Degrada para nada se a imagem falhar — o gradiente para a
// cor de fundo garante que o cabeçalho por baixo continua legível.
export const PanelBanner = ({ panelKey, className = "" }) => (
  <div className={`relative -mx-6 -mt-6 mb-2 h-20 overflow-hidden ${className}`}>
    <GameImage src={bannerImage(panelKey)} alt="" className="h-full w-full object-cover opacity-40" fallback={null} />
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
  </div>
);

// Caixa quadrada/retangular com imagem "cover" e um ícone de fallback centrado,
// para as miniaturas de catálogo (veículos/armas/imóveis). O ícone aparece atrás
// da imagem, por isso continua visível durante o carregamento e se a foto falhar.
export const Thumb = ({ src, alt = "", icon: Icon, className = "", iconColor = "#52525b", iconSize = 20 }) => (
  <div className={`relative shrink-0 overflow-hidden rounded-md bg-black/40 ${className}`}>
    <div className="absolute inset-0 flex items-center justify-center">
      {Icon && <Icon size={iconSize} style={{ color: iconColor }} />}
    </div>
    <GameImage src={src} alt={alt} className="relative h-full w-full object-cover" fallback={null} />
  </div>
);
