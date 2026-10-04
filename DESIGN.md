# SUBMUNDO — Design System

Este documento fixa a linguagem visual do produto e substitui instruções históricas contraditórias espalhadas pelo projeto. A metodologia de revisão segue os princípios de audit/polish/quieter do projeto Impeccable: corrigir primeiro padrões partilhados, reduzir ruído e verificar a experiência completa em vez de polir componentes isolados.

## 1. Direção

**Noir operacional.** Escuro, contido, denso e preciso. Deve parecer um jogo premium em operação, não um painel SaaS e não uma “UI hacker” decorativa.

A personalidade vem de:
- mapa e mundo do jogo;
- tipografia condensada nos títulos;
- mono apenas para números/dados;
- vermelho usado com intenção;
- superfícies negras com pequenas diferenças de luminância;
- microinterações rápidas e discretas.

## 2. Hierarquia

Ordem visual normal:

1. mapa / operação ativa;
2. alerta ou decisão que exige ação;
3. modal atualmente aberto;
4. recursos essenciais;
5. navegação;
6. informação secundária.

Nunca deixar quatro ou cinco elementos permanentes a disputar o primeiro nível de atenção.

## 3. Cor

### Superfícies

- Canvas: `#050506`
- Modal: `#0A0A0D`
- Raised: `#101014`
- Hover/selected neutral: `#141419`
- Border subtil: `rgba(255,255,255,.08)`
- Border forte/focus neutral: `rgba(255,255,255,.16)`

### Texto

- Primary: `#F4F4F5`
- Secondary: `#A1A1AA`
- Muted: `#71717A`

Evitar texto essencial em tons mais escuros do que `#71717A` sobre as superfícies principais.

### Semântica

- Heat / perigo / ação destrutiva: vermelho
- Dinheiro limpo / sucesso: verde
- Dinheiro sujo / aviso económico: âmbar
- Sistema / rota / informação operacional: ciano
- Neutro: zinc/cinza

Cor sem significado funcional deve ser exceção.

## 4. Tipografia

Famílias já presentes no produto:

- Corpo: **Inter**
- Display/títulos: **Rajdhani**, fallback IBM Plex Sans
- Dados: **JetBrains Mono**

Regras:
- títulos de modal: 16–18 px;
- corpo normal: 14–16 px;
- metadados densos: 10–12 px;
- HUD ultracompacto pode usar 9 px apenas para labels auxiliares, nunca para informação crítica;
- números financeiros e métricas usam algarismos tabulares;
- uppercase apenas para labels curtas, tabs e títulos operacionais. Não usar uppercase em parágrafos.

## 5. Modal principal

Todos os módulos de gestão partilham **a mesma shell**.

Desktop/tablet:
- largura máxima: 46rem;
- altura: `min(82dvh, 48rem)`;
- centrado no viewport;
- border-radius: 18px;
- cabeçalho fixo/sticky;
- corpo com scroll interno;
- overlay comum;
- sem caudas, setas, conectores ou âncoras visuais ao dock.

Mobile:
- margem exterior: 0.5rem;
- altura: 82dvh, limitada em ecrãs baixos;
- mesma linguagem central, não bottom-sheet;
- botão fechar com alvo mínimo de 44×44 px.

O tamanho da shell não muda conforme o conteúdo. Conteúdo curto deixa espaço interno; conteúdo longo faz scroll.

## 6. Superfícies internas

Preferir:
- listas segmentadas;
- summary strips;
- separadores;
- agrupamento por espaço.

Usar cartões individuais apenas quando o item precisa realmente de identidade própria ou ação própria.

Proibido usar gradiente como decoração base de modal/cartão. Sombras devem indicar elevação, não espetáculo.

## 7. HUD e resource bar

A resource bar é uma única faixa de estado, não quatro cartões independentes.

Valores permanentes:
- nível;
- respeito/pontos;
- dinheiro limpo;
- dinheiro sujo.

Ícone + valor têm prioridade. Labels são auxiliares. Flashes de alteração devem ser curtos e não impedir leitura.

O dock inferior contém apenas navegação de alto nível. Estados ativos e alertas são visíveis, mas o botão inativo deve recuar visualmente.

## 8. Notificações

Notificações e atividade usam a mesma família de superfícies do resto da UI:
- fundo sólido;
- sem scanlines/glows decorativos;
- severidade indicada por pequeno acento lateral, ícone e texto;
- não lido indicado de forma discreta;
- operações em direto podem ter movimento apenas quando comunica estado real.

## 9. Interação

- alvo tátil mínimo: 44×44 px para controlos principais;
- focus visível em teclado;
- hover não pode ser a única forma de obter informação;
- disabled precisa de razão compreensível quando a ação é importante;
- loading/success/error devem preservar a geometria para evitar saltos.

Movimento:
- 120–220 ms para feedback local;
- entradas de modal: fade + zoom mínimo;
- sem bounce/elastic;
- sem grandes deslocações;
- respeitar `prefers-reduced-motion`.

## 10. Acessibilidade e responsividade

Verificar pelo menos:
- 320–375 px;
- ~768 px;
- desktop largo;
- alturas baixas;
- zoom/text scaling;
- teclado;
- touch.

Contraste mínimo WCAG AA para conteúdo essencial. Tooltips complementam labels; não substituem nomes acessíveis.

## 11. Regra de implementação

Antes de criar CSS local para um componente, verificar se a regra pertence a:
1. token;
2. primitivo UI;
3. componente partilhado;
4. só então componente local.

Não acumular novas “rondas SSS” no fim de `App.css` para corrigir regras anteriores. Alterações futuras devem reduzir a cascata histórica, não aumentá-la.
