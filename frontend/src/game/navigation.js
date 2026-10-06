export const GAME_AREAS = [
  { id:"opscenter", label:"Central", hint:"Prontidão, reforços, cobertura e regras operacionais", group:"operations", shortcut:null, minLevel:1, aliases:["central","despacho","coordenação","coordenacao","reforços","reforcos"] },
  { id:"operations", label:"Operações", hint:"O que posso fazer agora e qual compensa?", group:"operations", shortcut:"1", minLevel:1, aliases:["oportunidades","despacho","operações","operacoes"] },
  { id:"quests", label:"Objetivos", hint:"O que devo fazer a seguir e o que desbloqueio?", group:"operations", shortcut:"2", minLevel:1, aliases:["missões","missoes","contratos","objetivos"] },
  { id:"mastermind", label:"Golpes", hint:"Grandes golpes, preparação e mercado clandestino", group:"operations", shortcut:null, minLevel:10, aliases:["mastermind","grandes golpes","golpes"] },
  { id:"teams", label:"Equipas", hint:"Composição, prontidão, veículos e despacho", group:"organization", shortcut:"4", minLevel:1, aliases:["crew","equipas"] },
  { id:"employees", label:"Operacionais", hint:"Efetivo, formação, saúde e salários", group:"organization", shortcut:"5", minLevel:1, aliases:["funcionários","funcionarios","rh","operacionais"] },
  { id:"fleet", label:"Frota", hint:"Veículos, combustível e manutenção", group:"organization", shortcut:"6", minLevel:1, aliases:["veículos","veiculos","carros","frota"] },
  { id:"weapons", label:"Armamento", hint:"Inventário, atribuição e manutenção", group:"organization", shortcut:"8", minLevel:1, aliases:["armas","arsenal","armamento"] },
  { id:"empire", label:"Império", hint:"Dinheiro, polícia, economia e expansão", group:"empire", shortcut:"3", minLevel:1, aliases:["tesouraria","economia","império","imperio"] },
  { id:"properties", label:"Imóveis", hint:"Propriedades, rendimento e capacidade", group:"empire", shortcut:"7", minLevel:1, aliases:["propriedades","imoveis","imóveis"] },
  { id:"hq", label:"Quartel-General", hint:"Base, estratégia, melhorias e desempenho", group:"empire", shortcut:null, minLevel:1, aliases:["qg","quartel general","base"] },
  { id:"organization", label:"Organização", hint:"Recursos, territórios, políticas e inteligência", group:"menu", shortcut:null, minLevel:10, aliases:["organizacao","organização","recursos","territórios","territorios"] },
  { id:"city", label:"Cidade", hint:"Estado vivo da cidade, eventos e rede local", group:"menu", shortcut:null, minLevel:5, aliases:["cidade viva","cidade","eventos urbanos"] },
  { id:"intel", label:"Relatórios", hint:"O que aconteceu, porquê e o que exige atenção", group:"menu", shortcut:null, minLevel:1, aliases:["relatorios","relatórios","histórico","historico","intel"] },
  { id:"shop", label:"Loja", hint:"Recursos e extras da organização", group:"menu", shortcut:"9", minLevel:1, aliases:["loja","compras"] },
  { id:"settings", label:"Definições", hint:"Interface, jogabilidade, dados e notificações", group:"menu", shortcut:null, minLevel:1, aliases:["configurações","configuracoes","settings","definições","definicoes"] },
];

export const GAME_PANEL_IDS = GAME_AREAS.map((area) => area.id);
export const GAME_PANEL_SET = new Set(GAME_PANEL_IDS);
export const GAME_PANEL_SHORTCUTS = Object.fromEntries(
  GAME_AREAS.filter((area) => area.shortcut).map((area) => [area.shortcut, area.id])
);
export const GAME_AREA_BY_ID = Object.fromEntries(GAME_AREAS.map((area) => [area.id, area]));

export const gameArea = (id) => GAME_AREA_BY_ID[id] || null;
export const areaLabel = (id) => GAME_AREA_BY_ID[id]?.label || id;
export const gameAreaUnlocked = (id, level = 1) =>
  Number(level || 1) >= Number(GAME_AREA_BY_ID[id]?.minLevel || 1);
export const gameAreaSearchText = (area) =>
  [area.id, area.label, area.hint, ...(area.aliases || [])].join(" ");
