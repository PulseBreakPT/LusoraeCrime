export const GAME_AREAS = [
  { id:"foryou", label:"Para ti", hint:"Próximos passos, oportunidades relevantes e desbloqueios", group:"operations", shortcut:null, minLevel:1, aliases:["para ti","recomendado","recomendações","recomendacoes","agora","continuar"] },
  { id:"opscenter", label:"Central", hint:"Prontidão, reforços, cobertura e regras operacionais", group:"operations", shortcut:null, minLevel:1, aliases:["central","despacho","coordenação","coordenacao","reforços","reforcos"] },
  { id:"operations", label:"Operações", hint:"O que posso fazer agora e qual compensa?", group:"operations", shortcut:"1", minLevel:1, aliases:["oportunidades","despacho","operações","operacoes"] },
  { id:"quests", label:"Objetivos", hint:"O que devo fazer a seguir e o que desbloqueio?", group:"operations", shortcut:"2", minLevel:1, aliases:["missões","missoes","contratos","objetivos"] },
  { id:"mastermind", label:"Golpes", hint:"Grandes golpes, preparação e execução", group:"operations", shortcut:null, minLevel:10, aliases:["mastermind","grandes golpes","golpes"] },

  { id:"teams", label:"Equipas", hint:"Composição, prontidão, veículos e despacho", group:"crew", shortcut:"4", minLevel:1, aliases:["crew","equipas"] },
  { id:"employees", label:"Operacionais", hint:"Efetivo, formação, saúde e salários", group:"crew", shortcut:"5", minLevel:1, aliases:["funcionários","funcionarios","rh","operacionais"] },
  { id:"fleet", label:"Frota", hint:"Veículos, combustível e manutenção", group:"crew", shortcut:"6", minLevel:1, aliases:["veículos","veiculos","carros","frota"] },
  { id:"weapons", label:"Armamento", hint:"Inventário, atribuição e manutenção", group:"crew", shortcut:"8", minLevel:1, aliases:["armas","arsenal","armamento"] },
  { id:"warehouse", label:"Armazém", hint:"Consumíveis, stock e logística da organização", group:"crew", shortcut:null, minLevel:10, aliases:["armazem","armazém","stock","consumíveis","consumiveis","logística","logistica"] },

  { id:"empire", label:"Finanças", hint:"Dinheiro, lavagem, polícia e tesouraria", group:"empire", shortcut:"3", minLevel:1, aliases:["tesouraria","economia","finanças","financas","império","imperio"] },
  { id:"properties", label:"Imóveis", hint:"Propriedades, rendimento e capacidade", group:"empire", shortcut:"7", minLevel:1, aliases:["propriedades","imoveis","imóveis"] },
  { id:"businesses", label:"Negócios", hint:"Rede empresarial, rendimentos e expansão", group:"empire", shortcut:null, minLevel:5, aliases:["negócios","negocios","empresas","fachadas"] },
  { id:"territory", label:"Território", hint:"Controlo, defesa, influência e expansão territorial", group:"empire", shortcut:null, minLevel:10, aliases:["território","territorio","territórios","territorios","zonas"] },
  { id:"hq", label:"QG", hint:"Base, estratégia, melhorias e prioridades", group:"empire", shortcut:null, minLevel:1, aliases:["qg","quartel general","quartel-general","base"] },

  { id:"world", label:"Mundo", hint:"Pulso urbano, notícias, rivais e rede social", group:"world", shortcut:null, minLevel:5, aliases:["cidade","cidade viva","mundo","notícias","noticias","rivais","social","rede"] },

  { id:"intel", label:"Relatórios", hint:"Histórico, desempenho, recomendações e atenção", group:"utility", shortcut:null, minLevel:1, aliases:["relatorios","relatórios","histórico","historico","intel","desempenho"] },
  { id:"shop", label:"Loja", hint:"Extras e recursos meta da organização", group:"utility", shortcut:"9", minLevel:1, aliases:["loja","compras"] },
  { id:"settings", label:"Definições", hint:"Interface, jogabilidade, dados e notificações", group:"utility", shortcut:null, minLevel:1, aliases:["configurações","configuracoes","settings","definições","definicoes"] },
];

// Saves/eventos antigos podem continuar a referir destinos removidos da UI.
// Canonicalizamos esses ids para uma única fonte de verdade sem voltar a
// expor ecrãs duplicados na navegação ou pesquisa.
export const LEGACY_PANEL_ALIASES = Object.freeze({
  management: "hq",
  organization: "hq",
  city: "world",
});

export const canonicalGamePanel = (id) => LEGACY_PANEL_ALIASES[id] || id;

export const GAME_PANEL_IDS = GAME_AREAS.map((area) => area.id);
export const GAME_PANEL_SET = new Set(GAME_PANEL_IDS);
export const GAME_PANEL_SHORTCUTS = Object.fromEntries(
  GAME_AREAS.filter((area) => area.shortcut && !area.hidden).map((area) => [area.shortcut, area.id])
);
export const GAME_AREA_BY_ID = Object.fromEntries(GAME_AREAS.map((area) => [area.id, area]));

export const gameArea = (id) => GAME_AREA_BY_ID[id] || null;
export const areaLabel = (id) => GAME_AREA_BY_ID[id]?.label || id;
export const gameAreaUnlocked = (id, level = 1) =>
  Number(level || 1) >= Number(GAME_AREA_BY_ID[id]?.minLevel || 1);
export const gameAreaSearchText = (area) =>
  [area.id, area.label, area.hint, ...(area.aliases || [])].join(" ");
