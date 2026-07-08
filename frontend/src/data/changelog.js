// Changelog do Lusorae — histórico real de desenvolvimento (Temporada 0)
// Tipos: novo | melhorado | corrigido | equilibrio

export const CHANGE_TYPES = {
  novo: { label: "Novo", color: "emerald" },
  melhorado: { label: "Melhorado", color: "sky" },
  corrigido: { label: "Corrigido", color: "amber" },
  equilibrio: { label: "Equilíbrio", color: "violet" },
};

export const CHANGELOG = [
  {
    version: "1.0.0",
    date: "08/07/2026",
    title: "Autenticação 2.0 & Transparência",
    tagline: "Registo com termos, palavras-passe fortes, bloqueio inteligente e páginas legais completas.",
    current: true,
    changes: [
      { type: "novo", text: "Página de Termos e Condições e Política de Privacidade (RGPD) integradas no jogo." },
      { type: "novo", text: "Changelog público com todo o histórico da Temporada 0." },
      { type: "novo", text: "Registo passa a exigir aceitação explícita dos Termos e da Política de Privacidade, com data e versão guardadas na conta." },
      { type: "novo", text: "Medidor de força da palavra-passe em tempo real e botão mostrar/ocultar no registo e no login." },
      { type: "melhorado", text: "Ecrã de entrada redesenhado: validação inline por campo, mensagens de erro claras e novo visual premium." },
      { type: "melhorado", text: "Bloqueio de login inteligente: avisa quantas tentativas restam e quanto tempo falta quando a conta está bloqueada." },
      { type: "melhorado", text: "Palavras-passe novas exigem no mínimo 8 caracteres com letras e números." },
    ],
  },
  {
    version: "0.9.0",
    date: "07/07/2026",
    title: "Inteligência Operacional",
    tagline: "Probabilidades transparentes, bases operacionais no mapa e logística visível.",
    changes: [
      { type: "novo", text: "Propriedades tornam-se bases operacionais com colocação manual no mapa de Lisboa." },
      { type: "novo", text: "Veículos em transferência entre bases aparecem a mover-se no mapa em tempo real." },
      { type: "melhorado", text: "Cálculo de probabilidade de sucesso reformulado num sistema modular por categoria (equipa, veículo, armamento, calor, distância)." },
      { type: "melhorado", text: "Preview de probabilidade progressivo: resumo imediato, detalhes completos a pedido." },
      { type: "melhorado", text: "Botões de compra e ação com custo uniformizados em todo o jogo." },
      { type: "corrigido", text: "Despacho bloqueado quando o veículo da equipa ainda está em trânsito." },
    ],
  },
  {
    version: "0.8.0",
    date: "06/07/2026",
    title: "Som, Aço e Estratégia",
    tagline: "Áudio noir, QG estratégico, armamento completo e economia recalibrada.",
    changes: [
      { type: "novo", text: "Sistema de áudio completo: música noir ambiente, sirenes de perseguição e efeitos temáticos." },
      { type: "novo", text: "Quartel-General transformado em centro estratégico com progressão por níveis." },
      { type: "novo", text: "Sistema completo de armas e equipamento operacional para as equipas." },
      { type: "novo", text: "Cofre de dinheiro sujo e marcos de recompensa visíveis na interface." },
      { type: "melhorado", text: "Identidade 100% PT-PT: painel Recursos Humanos renomeado para Operacionais e glossário canónico em todo o jogo." },
      { type: "melhorado", text: "Decisões de eventos expõem o custo de cada opção e desativam as impagáveis antes do clique." },
      { type: "melhorado", text: "Cor dinâmica verde/vermelho consolidada em todos os botões de compra e confirmação." },
      { type: "melhorado", text: "Feedback de missões consciente do resultado, com avisos de bloqueio policial." },
      { type: "equilibrio", text: "Sistema de recompensas dinâmicas com balanceamento por dificuldade." },
      { type: "equilibrio", text: "Economia centralizada com simulador de validação — fórmulas críticas corrigidas e testadas." },
      { type: "equilibrio", text: "Ciclo salarial alargado e lógica de calor policial afinada." },
      { type: "corrigido", text: "19 quests impossíveis de completar e talentos-fantasma nas perseguições." },
      { type: "corrigido", text: "Soft-lock eliminado: a organização nunca fica sem operacionais nem sem forma de recuperar (bailout de emergência calibrado)." },
      { type: "corrigido", text: "Erros críticos de despacho (duration_s, UnboundLocalError) e constantes duplicadas na base de dados do jogo." },
    ],
  },
  {
    version: "0.7.0",
    date: "05/07/2026",
    title: "Fiabilidade Total",
    tagline: "Painel de administração, arranque inteligente e proteção de progresso.",
    changes: [
      { type: "novo", text: "Painel administrativo completo: gestão de utilizadores, servidor e atribuição/remoção de administradores." },
      { type: "novo", text: "Feedback háptico em ações-chave no telemóvel." },
      { type: "novo", text: "Cada registo de atividade é clicável e abre o painel Intel correspondente." },
      { type: "melhorado", text: "Sistema de arranque V2: barra de progresso 0-100% com fases nomeadas e diagnóstico de erros." },
      { type: "melhorado", text: "Login otimizado: queries em paralelo, backoff exponencial e polling adaptável." },
      { type: "melhorado", text: "Feed de atividade com estilo inteligente: dinheiro colorido e recursos sublinhados." },
      { type: "corrigido", text: "Loading infinito no arranque — sequência de boot e sincronização de rotas protegidas reescritas." },
      { type: "corrigido", text: "Salvaguardas contra perda de progresso durante redeploy ou reinício do servidor." },
      { type: "corrigido", text: "Ecrã 'A ligar à rede...' preso para sempre em caso de falha de ligação." },
    ],
  },
  {
    version: "0.6.0",
    date: "04/07/2026",
    title: "A Grande Expansão",
    tagline: "O triplo do conteúdo: missões, operacionais, veículos, imóveis e quests.",
    changes: [
      { type: "novo", text: "+50 missões, +10 operacionais, +5 veículos, +5 imóveis e +50 quests." },
      { type: "novo", text: "8 categorias de regras de jogo: economia, progressão, viagem, imprevistos, manutenção e qualidade de vida." },
      { type: "novo", text: "Módulo de Definições completo: conta, interface, jogabilidade, automatizações e notificações." },
      { type: "novo", text: "Renomear veículos, operacionais e propriedades — nome original visível ao lado." },
      { type: "melhorado", text: "Interface migrada para shadcn/ui em toda a plataforma: tema e primitivos partilhados." },
      { type: "melhorado", text: "Conteúdo interligado: veículos exigidos por missões, talentos para novas especializações, químico ligado a laboratórios." },
      { type: "melhorado", text: "Trajeto das equipas desenhado no mapa e primeiras mecânicas de coordenação." },
      { type: "equilibrio", text: "Economia com limites de recursos, extrato de movimentos, rendimentos decrescentes e abastecimento com tempo." },
      { type: "equilibrio", text: "Risco e recompensa das missões escalados pela distância, com mínimo de membros por missão." },
    ],
  },
  {
    version: "0.5.0",
    date: "03/07/2026",
    title: "Centro de Comando",
    tagline: "Informação útil em todo o lado: tooltips, badges e resumos agregados.",
    changes: [
      { type: "novo", text: "Tooltips informativos em todos os botões, ícones e marcadores do mapa, com legenda colapsável." },
      { type: "novo", text: "Badges inteligentes nos botões do HUD: avarias, combustível, moral baixa, missões por reclamar." },
      { type: "novo", text: "Summary strips em todos os painéis: Equipas, Operacionais, Frota, Imóveis e Império." },
      { type: "melhorado", text: "Barra de recursos com fluxos €/h, estado do calor, equipas prontas e countdown de salários." },
      { type: "melhorado", text: "Império com fluxo de caixa passivo e balanço €/h; Frota com autonomia em km por veículo." },
      { type: "melhorado", text: "Despacho inteligente com capacidades visíveis e painéis com referências cruzadas." },
      { type: "corrigido", text: "Duplicação de estado nas Equipas e badges de notificação errados." },
    ],
  },
  {
    version: "0.2.0",
    date: "02/07/2026",
    title: "O Coração da Organização",
    tagline: "Sistema completo de operacionais — a alma do teu império.",
    changes: [
      { type: "novo", text: "14 especializações de operacionais, das quais 6 com passivos de organização." },
      { type: "novo", text: "9 atributos, 4 raridades com multiplicadores e 8 talentos únicos aplicados em missões." },
      { type: "novo", text: "7 ranks com promoções pagas, XP individual e progressão de atributos." },
      { type: "novo", text: "Lealdade, moral e fadiga com folha salarial periódica — faltar ao pagamento tem consequências." },
      { type: "novo", text: "Recrutamento por 6 fontes desbloqueadas por nível e 9 formações de especialização." },
      { type: "novo", text: "Traições: roubo, fuga de informação, sabotagem e abandono — com risco exposto na interface." },
    ],
  },
  {
    version: "0.1.0",
    date: "02/07/2026",
    title: "Fundação",
    tagline: "Lisboa acorda. O primeiro império nasce.",
    changes: [
      { type: "novo", text: "Autenticação segura com sessão persistente; criar conta funda a organização com equipa, operacionais e veículo iniciais." },
      { type: "novo", text: "Mapa vivo de Lisboa com 16 zonas, QG no Cais do Sodré e unidades a mover-se em tempo real." },
      { type: "novo", text: "11 tipos de oportunidades criminosas com gate por nível e 4 especializações de equipas." },
      { type: "novo", text: "Economia dupla: € limpo / € sujo com lavagem de dinheiro, respeito e 10 níveis de progressão." },
      { type: "novo", text: "Calor policial com rusgas, frota de 6 veículos e 7 tipos de propriedades com upgrades." },
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;

export function changelogStats() {
  const total = CHANGELOG.reduce((acc, v) => acc + v.changes.length, 0);
  const byType = {};
  for (const v of CHANGELOG) for (const c of v.changes) byType[c.type] = (byType[c.type] || 0) + 1;
  return { versions: CHANGELOG.length, total, byType };
}
