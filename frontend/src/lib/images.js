// ============================================================================
// Registo central de imagens do jogo.
//
// Todas as imagens são carregadas de serviços externos (mesmo padrão do fundo
// do ecrã de login, que já usa images.unsplash.com em produção). CADA consumidor
// destas URLs deve usar o componente <GameImage> (components/game/GameImage.jsx),
// que faz fallback para um ícone se a imagem não carregar — por isso uma foto
// removida ou um serviço em baixo nunca mostra o símbolo de imagem partida:
// degrada suavemente para a interface só-com-ícones que já existia.
//
// Estratégia por tipo (escolhida para nunca depender de IDs de foto inventados):
//  - Catálogos de objetos (veículos, armas, imóveis) e distritos → fotos reais
//    por palavra-chave (loremflickr), estáveis por item via "lock".
//  - Retratos de operacionais → avatares DiceBear, únicos e determinísticos por
//    id do funcionário (feitos precisamente para isto).
//  - Banners dos painéis → o padrão Unsplash de Lisboa já comprovado no login.
//
// Para trocar a fonte de imagens no futuro, basta editar os helpers abaixo — os
// componentes só chamam estas funções, nunca constroem URLs diretamente.
// ============================================================================

// Hash estável de uma string para um inteiro positivo (usado como "lock" do
// loremflickr, para que cada chave receba sempre a mesma foto).
function seedFrom(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Foto real por palavra-chave, determinística (mesma foto para a mesma chave).
function keywordPhoto(keywords, lockKey, w = 480, h = 320) {
  const kw = encodeURIComponent(keywords);
  return `https://loremflickr.com/${w}/${h}/${kw}?lock=${seedFrom(lockKey)}`;
}

// Foto específica do Unsplash (padrão idêntico ao fundo do login).
function unsplash(id, w = 1200) {
  return `https://images.unsplash.com/photo-${id}?crop=entropy&cs=srgb&fm=jpg&q=80&w=${w}`;
}

// ---------------- Veículos ----------------
const VEHICLE_KEYWORDS = {
  usado: "sedan,car",
  moto: "motorcycle",
  van: "cargo,van",
  desportivo: "sports,car",
  suv_blindado: "suv,car",
  supercarro: "supercar",
  carrinha_entrega: "delivery,van",
  berlina_blindada: "luxury,sedan",
  buggy_todo_terreno: "offroad,buggy",
  limousine: "limousine",
  carro_furtivo: "black,car",
};

// ---------------- Armas ----------------
const WEAPON_KEYWORDS = {
  faca_taser: "combat,knife",
  pistola: "pistol,handgun",
  espingarda: "shotgun",
  submetralhadora: "submachine,gun",
  rifle_assalto: "assault,rifle",
  rifle_precisao: "sniper,rifle",
};

// ---------------- Imóveis ----------------
const PROPERTY_KEYWORDS = {
  esconderijo: "warehouse,hideout",
  garagem: "garage,cars",
  empresa_legal: "office,building",
  armazem: "warehouse,storage",
  laboratorio: "laboratory,chemistry",
  oficina: "auto,workshop",
  porto_clandestino: "harbor,port",
  posto_vigilancia: "surveillance,cctv",
  escritorio_advocacia: "law,office",
  arsenal: "armory,weapons",
  casa_cambio: "money,exchange",
  centro_logistico: "logistics,warehouse",
};

// ---------------- Banners de painéis ----------------
// Cada painel principal tem um banner temático próprio (foto real por
// palavra-chave), para não repetir a mesma imagem em todo o lado. A foto de
// Lisboa à noite (a mesma já usada no ecrã de login, comprovada em produção)
// serve de fundo genérico por omissão.
const LISBON_NIGHT = "1731234361187-4702894e725a";
const PANEL_BANNER_KEYWORDS = {
  empire: "lisbon,skyline,night",
  hq: "command,center,dark",
  weapons: "weapons,arsenal",
  fleet: "cars,garage",
  properties: "lisbon,buildings",
  employees: "crew,people",
  teams: "team,group",
};

// ---------------- API pública ----------------

export function vehicleImage(modelKey, w = 480, h = 300) {
  return keywordPhoto(VEHICLE_KEYWORDS[modelKey] || "car", `vehicle:${modelKey}`, w, h);
}

export function weaponImage(modelKey, w = 480, h = 300) {
  return keywordPhoto(WEAPON_KEYWORDS[modelKey] || "gun", `weapon:${modelKey}`, w, h);
}

export function propertyImage(typeKey, w = 480, h = 300) {
  return keywordPhoto(PROPERTY_KEYWORDS[typeKey] || "building", `property:${typeKey}`, w, h);
}

export function districtImage(name, w = 480, h = 300) {
  return keywordPhoto(`lisbon,${name}`, `district:${name}`, w, h);
}

// Avatar único e determinístico por operacional (DiceBear). O "seed" deve ser
// o id do funcionário para não mudar entre sessões; a especialização escolhe
// uma paleta consistente por função.
export function employeeAvatar(seed, spec) {
  const styleBySpec = {
    assalto: "adventurer",
    logistica: "adventurer",
    tecnica: "bottts",
    influencia: "personas",
    suporte: "adventurer",
  };
  const style = styleBySpec[spec] || "adventurer";
  const s = encodeURIComponent(String(seed || "op"));
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${s}&backgroundColor=1e1e28,26262f`;
}

export function bannerImage(panelKey, w = 900, h = 200) {
  const kw = PANEL_BANNER_KEYWORDS[panelKey];
  if (!kw) return unsplash(LISBON_NIGHT, w);
  return keywordPhoto(kw, `banner:${panelKey}`, w, h);
}
