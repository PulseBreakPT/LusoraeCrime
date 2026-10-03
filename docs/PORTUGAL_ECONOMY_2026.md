# Lusorae — Economia Portugal 2026

Referência de balanceamento aplicada em outubro de 2026.

## Princípio

O objetivo não é copiar preços ao cêntimo. O jogo usa valores portugueses reais como **âncoras** e converte-os para uma economia jogável e consistente.

- Bens legais e públicos: próximos do mercado real.
- Custos operacionais: aproximados ao contexto português.
- Mercado clandestino: valores ficcionais com prémio de risco/escassez; não representam preços reais de aquisição ilegal.
- Um ciclo salarial de 120 minutos reais representa aproximadamente uma semana económica dentro da simulação.

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

Os salários Lusorae são custos semanais de simulação e incluem um prémio ficcional para especialização, disponibilidade e risco.

Fonte: https://www.ine.pt/

### Veículos

O mercado português de usados em 2026 apresenta grande concentração abaixo de 15.000 €, outra faixa relevante entre 15.000 € e 30.000 €, e maior tempo de stock acima de 30.000 €. Carrinhas comerciais recentes aparecem frequentemente na zona dos 18–26 mil €, enquanto berlinas/performance modernas sobem rapidamente para 30–90 mil € ou mais.

Referências:
- https://www.standvirtual.com/
- https://www.standvirtual.com/diarioautomovel/

## Perfil aplicado

### Veículos

| Tipo | Preço Lusorae |
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

### Salários semanais de simulação

Os valores vão aproximadamente de 400 € a 750 € por ciclo semanal, dependendo de especialização e raridade base da função.

A referência é a remuneração portuguesa real, convertida para custo semanal e acrescida de um prémio ficcional de especialização/risco.

### Propriedades

Os valores representam **aquisição operacional + preparação inicial + adaptação do espaço**, não uma avaliação imobiliária universal. A localização real em Portugal varia demasiado para existir um único preço nacional.

Em Faro, anúncios recentes de armazéns mostram referências próximas de 7–11 €/m²/mês, enquanto Lisboa tende a ser mais cara.

A progressão Lusorae usa:

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

Referência de mercado: https://www.idealista.pt/

### Armamento

Os preços do armamento no Lusorae são **inteiramente de balanceamento ficcional**. Não são apresentados como preços reais de mercado ilegal.

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
4. Salários são tratados como custo semanal de simulação.
5. Itens clandestinos nunca são descritos como cotações reais.
6. Sempre que a economia for atualizada, este documento e os testes devem ser atualizados no mesmo commit.
