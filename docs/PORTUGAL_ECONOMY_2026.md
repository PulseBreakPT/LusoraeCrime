# SUBMUNDO — Economia Portugal 2026

Referência de balanceamento aplicada em outubro de 2026.

## Princípio

O objetivo não é copiar preços ao cêntimo. O jogo usa valores portugueses reais como **âncoras** e converte-os para uma economia jogável e consistente.

- Bens legais e públicos: próximos do mercado real.
- Custos operacionais: aproximados ao contexto português.
- Mercado clandestino: valores ficcionais com prémio de risco/escassez; não representam preços reais de aquisição ilegal.
- Os custos **fixos** são liquidados uma vez por semana, à **segunda-feira às 20:00 (Europe/Lisbon)**.
- Valores anuais da frota (seguro, IUC, IPO e reserva de manutenção preventiva) são divididos por 52 e só entram pela fração semanal; não existe uma segunda cobrança anual.
- Combustível, reparações e desgaste são **custos variáveis** e só acontecem quando os ativos são usados.

## Âncoras externas

### Combustível

DGEG — Preço Médio Diário, Portugal Continental, referência de 24-09-2026:

- Gasolina simples 95: 2,115 €/L.
- Gasóleo simples: 2,221 €/L.

Valores usados no jogo, arredondados:

- gasolina: 2,12 €/L;
- gasóleo: 2,22 €/L.

Fonte: https://precoscombustiveis.dgeg.gov.pt/estatistica/preco-medio-diario/

### Trabalho

INE, trimestre terminado em junho de 2026:

- remuneração bruta total mensal média: 1.835 €;
- remuneração regular média: 1.436 €;
- remuneração base média: 1.342 €.

Os salários SUBMUNDO são custos semanais de simulação e incluem um prémio ficcional para especialização, disponibilidade e risco.

Fonte: https://www.ine.pt/

### Veículos

O mercado português de usados em 2026 apresenta grande concentração abaixo de 15.000 €, outra faixa relevante entre 15.000 € e 30.000 €, e maior tempo de stock acima de 30.000 €. Carrinhas comerciais recentes aparecem frequentemente na zona dos 18–26 mil €, enquanto berlinas/performance modernas sobem rapidamente para 30–90 mil € ou mais.

Referências:
- https://www.standvirtual.com/
- https://www.standvirtual.com/diarioautomovel/

## Perfil aplicado

### Veículos

| Tipo | Preço SUBMUNDO |
|---|---:|
| Sedan usado | 12.500 € |
| Moto rápida | 9.000 € |
| Carrinha de entregas | 21.000 € |
| Van reforçada | 26.000 € |
| Buggy todo-o-terreno | 18.000 € |
| Desportivo | 55.000 € |
| Carro furtivo | 48.000 € |
| Berlina blindada | 65.000 € |
| Limousine | 75.000 € |
| SUV blindado | 95.000 € |
| Supercarro | 185.000 € |

Blindagem, preparação clandestina e modificações já estão incluídas nos arquétipos que as implicam.

### Salários e fecho semanal

Os salários base vão aproximadamente de 400 € a 750 € por semana de simulação, dependendo de especialização e raridade base da função.

O custo patronal usa **23,75% de TSU** sobre o salário bruto. A folha salarial é linear: aumentar o efetivo aumenta o custo pelo salário e TSU reais do novo operacional, sem multiplicadores artificiais pelo tamanho da equipa.

Todas as segundas-feiras às 20:00 são liquidados num único fecho:
- salários brutos;
- TSU patronal;
- fração semanal dos custos fixos anuais da frota;
- manutenção/exploração fixa dos imóveis.

Combustível e reparações ficam fora desse fecho porque são custos variáveis.

### Propriedades

Os valores representam **aquisição operacional + preparação inicial + adaptação do espaço**, não uma avaliação imobiliária universal. A localização real em Portugal varia demasiado para existir um único preço nacional.

Em Faro, anúncios recentes de armazéns mostram referências próximas de 7–11 €/m²/mês, enquanto Lisboa tende a ser mais cara.

A progressão SUBMUNDO usa:

| Operação imobiliária | Entrada |
|---|---:|
| Garagem | 55.000 € |
| Esconderijo | 85.000 € |
| Posto de vigilância | 95.000 € |
| Empresa de fachada | 140.000 € |
| Arsenal | 140.000 € |
| Oficina | 165.000 € |
| Armazém | 180.000 € |
| Laboratório | 220.000 € |
| Escritório de advocacia | 220.000 € |
| Casa de câmbio | 280.000 € |
| Porto clandestino | 420.000 € |
| Centro logístico | 450.000 € |

O preço-base é ajustado pela localização escolhida no mapa: Lisboa ×1,30; Porto ×1,15; Algarve ×1,10; Madeira ×1,05; litoral/centro ×1,00; Açores ×0,90; interior ×0,85. O preço efetivamente pago fica guardado no imóvel e é a base das melhorias, revenda e manutenção.

A manutenção imobiliária fixa equivale a 0,056% do valor-base do imóvel por semana e entra no fecho de segunda-feira.

Referência de mercado: https://www.idealista.pt/

## Recompensas monetárias

As operações normais usam uma escala-base por risco de 2.500 €, 4.800 €, 9.000 €, 16.500 € e 30.000 €. Dificuldade, distância, categoria, raridade e evolução da organização ajustam o valor, mas a recompensa de uma operação normal fica limitada a **1.500–90.000 €**.

A progressão por nível foi reduzida para +12% por nível acima do primeiro e os bónus combinados têm teto, evitando que propriedades e conquistas multipliquem o mesmo saque duas vezes.

Na Cidade Viva, as gamas-base são:
- Corrida Clandestina: 4.000–7.500 € limpos;
- Entrega à Desmontagem: 7.500–13.500 € sujos;
- Rota Clandestina: 12.000–22.000 € sujos.

Grandes golpes Mastermind ficam acima das operações normais porque exigem preparação, equipa, veículo, custos prévios, risco e cooldown: 90.000 €, 175.000 € e 310.000 € de base antes de cortes e modificadores.

### Lavagem

A lavagem manual devolve 78% na taxa base e pode melhorar até 90% com especialistas e infraestrutura. A lavagem passiva devolve 82%. Isto cria uma diferença real entre dinheiro sujo e dinheiro utilizável sem transformar a lavagem num imposto proibitivo.

### Armamento

Os preços do armamento no SUBMUNDO são **inteiramente de balanceamento ficcional**. Não são apresentados como preços reais de mercado ilegal.

Os custos refletem apenas:
- categoria;
- raridade operacional;
- manutenção;
- discrição;
- progressão de jogo.

## Regras de consistência

1. O backend e o modo convidado usam os mesmos preços.
2. Saves convidados antigos são migrados automaticamente.
3. Combustível usa uma referência pública e datada.
4. Custos fixos são fechados segunda-feira às 20:00; custos variáveis só são cobrados quando ocorrem.
5. Encargos anuais usados como referência são divididos por 52 e não geram cobranças anuais separadas.
6. Salários usam salário bruto + 23,75% de TSU patronal.
7. Itens clandestinos nunca são descritos como cotações reais.
8. Sempre que a economia for atualizada, este documento e os testes devem ser atualizados em conjunto.
