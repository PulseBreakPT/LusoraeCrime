# SUBMUNDO — Product Context

> Fonte de verdade de produto para decisões de interface. O projeto ainda pode aparecer tecnicamente como `LusoraeCrime`, mas a marca e o produto são **SUBMUNDO**.

## O produto

SUBMUNDO é um jogo de estratégia e gestão criminal, centrado num mapa vivo. O jogador dirige uma organização, reage a oportunidades, gere equipas, operacionais, frota, armamento, propriedades, economia, risco policial e progressão.

A experiência é Web + mobile/Capacitor. O mapa é o palco principal; a interface existe para permitir decisões rápidas sem transformar o jogo num dashboard administrativo.

## Modo de produto

Para decisões de design, tratar SUBMUNDO como uma interface **Operate**: scanabilidade, consistência, velocidade de decisão, estado atual e ergonomia têm prioridade sobre decoração.

Referência de processo: https://github.com/pbakaus/impeccable

## Tarefas principais do jogador

1. Perceber o que está a acontecer no mapa.
2. Detetar oportunidades, ameaças e estados que exigem ação.
3. Despachar e acompanhar operações.
4. Gerir crew, operacionais, equipamento, frota e propriedades.
5. Controlar dinheiro limpo, dinheiro sujo, respeito/nível e risco.
6. Entrar num menu, decidir e voltar ao mapa sem perder contexto.

## Princípios de produto

- **Mapa primeiro.** A UI permanente ocupa o mínimo necessário.
- **Estado antes de decoração.** Cor, movimento e badges têm significado funcional.
- **Uma linguagem de menu.** Os módulos principais abrem no mesmo modal, com a mesma geometria e comportamento.
- **Mobile real.** Alvos táteis, safe areas, viewport dinâmico e texto legível são requisitos, não extras.
- **Densidade com hierarquia.** Informação compacta é permitida; ruído visual não.
- **Consistência vence improviso.** Um padrão partilhado deve ser corrigido na origem em vez de receber exceções por ecrã.
- **Portugal e pt-PT.** Economia, nomenclatura e linguagem do produto seguem o contexto português quando aplicável.
- **Game logic é sagrada.** Passes de design não devem alterar economia, simulação ou regras sem um pedido explícito.

## Anti-objetivos

Evitar:
- glassmorphism como linguagem dominante;
- gradientes decorativos em menus;
- glow permanente sem significado;
- cartões dentro de cartões só para “encher” composição;
- marcas de água gigantes, grelhas ou ornamentos a competir com o mapa;
- menus com dimensões diferentes por módulo;
- painéis com caudas, conectores ou aparência de balão ligado ao dock;
- bottom sheets como padrão para os módulos principais;
- botões táteis demasiado pequenos;
- microtexto usado como substituto de hierarquia;
- animação que existe apenas para mostrar que existe animação.

## Restrições técnicas

- React 19 + CRACO + Tailwind.
- Radix UI para diálogos/sheets e primitivos acessíveis.
- Leaflet para mapa.
- Capacitor para Android.
- Manter `data-testid` existentes e acrescentá-los a novos controlos interativos relevantes.
- Preservar `prefers-reduced-motion`.
- Não adicionar bibliotecas de UI/desenho sem necessidade real.
