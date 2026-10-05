[🌐 **ABRIR SUBMUNDO AO VIVO**](https://pulsebreakpt.github.io/LusoraeCrime/)

# SUBMUNDO — Império Criminoso de Portugal

[![Deploy GitHub Pages](https://github.com/PulseBreakPT/LusoraeCrime/actions/workflows/pages.yml/badge.svg)](https://github.com/PulseBreakPT/LusoraeCrime/actions/workflows/pages.yml)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

**SUBMUNDO** é um simulador persistente de estratégia e gestão criminal, pensado para Web e com interface mobile-first. O jogador não controla uma única personagem: controla uma organização inteira, o seu Quartel-General, equipas, operacionais, frota, armamento, imóveis, dinheiro, influência, risco policial e operações em tempo real.

O mapa é o centro da experiência. O mundo nasce à volta do Quartel-General escolhido pelo jogador em território português, as oportunidades surgem dinamicamente, as equipas deslocam-se pelo mapa, as operações evoluem por fases e a economia continua a produzir consequências enquanto a organização cresce.

> **Projeto ficcional.** SUBMUNDO é uma obra original de estratégia/gestão inspirada apenas no género de sandbox criminal. Não reutiliza personagens, missões, mapas, arte, áudio ou texto de outras propriedades intelectuais.

---

## Estado público

| Componente | Estado |
|---|---|
| GitHub Pages | Frontend publicado automaticamente |
| URL | https://pulsebreakpt.github.io/LusoraeCrime/ |
| Build | React/CRACO via GitHub Actions |
| Rotas SPA | Preparadas para o subdiretório `/LusoraeCrime` |
| Login e registo no Pages | **Ocultos por feature flag**, não removidos |
| Sistema de autenticação | Continua implementado no código |
| Backend completo | FastAPI + MongoDB, destinado à stack Docker/VPS |
| Deploy de produção | Docker Compose + Caddy + HTTPS automático |
| Modo atual | Single-player local + backend persistente com camada social/multiplayer opt-in |

**Compatibilidade de deployment:** o caminho `LusoraeCrime` que ainda aparece no URL do GitHub Pages é apenas o identificador legado do repositório/deploy atual; a marca do produto é exclusivamente **SUBMUNDO**.

A build pública do GitHub Pages usa `REACT_APP_AUTH_UI_ENABLED=false`. Isto esconde o ecrã de login/registo sem apagar a implementação. Para uma build privada ou de produção, a interface pode voltar a ser exposta alterando a flag.

---

## Índice

- [Visão do jogo](#visão-do-jogo)
- [Números atuais do conteúdo](#números-atuais-do-conteúdo)
- [Mundo e mapa](#mundo-e-mapa)
- [Operações e equipas](#operações-e-equipas)
- [Operacionais e RH](#operacionais-e-rh)
- [Frota](#frota)
- [Armamento](#armamento)
- [Imóveis e QG](#imóveis-e-qg)
- [Economia e risco](#economia-e-risco)
- [Missões e progressão](#missões-e-progressão)
- [Cidade Viva](#cidade-viva)
- [Mastermind](#mastermind)
- [Centro de Comando e UX](#centro-de-comando-e-ux)
- [Loja](#loja)
- [Polícia](#polícia)
- [Simulação interior](#simulação-interior)
- [Administração e legal](#administração-e-legal)
- [Arquitetura](#arquitetura)
- [Stack técnica](#stack-técnica)
- [Rotas do frontend](#rotas-do-frontend)
- [API](#api)
- [Executar localmente](#executar-localmente)
- [Deploy](#deploy)
- [Segurança](#segurança)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Testes](#testes)
- [Direção futura](#direção-futura)

---

## Visão do jogo

O loop principal combina gestão, planeamento e execução:

1. **Estabelecer o QG** em terra firme portuguesa.
2. **Gerar o mundo operacional** em redor do QG.
3. **Analisar oportunidades** no mapa e no painel de operações.
4. **Preparar equipas**, operacionais, veículos e armamento.
5. **Avaliar risco e probabilidade** antes do despacho.
6. **Enviar a equipa**, acompanhar viagem, execução e regresso.
7. **Gerir dinheiro limpo e sujo**, calor, salários, combustível, desgaste e propriedades.
8. **Expandir a organização** com melhores operacionais, frota, armamento, QG e imóveis.
9. **Controlar territórios**, contactos e atividades de rua.
10. **Planear grandes golpes** através do sistema Mastermind.

O motor usa um modelo de progressão persistente e data-driven: o conteúdo vive sobretudo em `game_data.py`, `economy_constants.py`, `city_data.py`, `quests_data.py` e `mastermind_data.py`.

---

## Números atuais do conteúdo

| Sistema | Conteúdo atual |
|---|---:|
| Tipos de operações | **67** |
| Especializações de operacionais | **24** |
| Atributos de operacionais | **9** |
| Raridades | **4** |
| Patentes/ranks | **7** |
| Talentos | **10** |
| Fontes de recrutamento | **6** |
| Cursos de formação | **10** |
| Especializações de equipa | **4** |
| Modelos de veículos | **11** |
| Modelos de armas | **9** |
| Tipos de imóveis | **12** |
| Quests/missões definidas | **120** |
| Capítulos principais | **12** |
| Zonas geradas à volta do QG | **até ~16** |
| Níveis de procurado | **0–5 estrelas** |
| Ranks de reputação de rua | **6** |
| Alvos Mastermind | **7** |
| Ranks Mastermind | **10** |
| Mercadorias Mastermind | **8** |

### Conteúdo de operações

<details>
<summary><strong>Ver os 67 tipos de operações</strong></summary>

Assalto, Roubo de Veículo, Cobrança, Transporte Ilegal, Contrabando, Hack, Lavagem de Dinheiro, Infiltração, Ataque a Território, Operação VIP, Missão Especial, Entrega Expressa, Vigilância Digital, Assalto Armado, Suborno a Oficial, Rota Internacional, Ciberataque Bancário, Roubo de Joalharia, Assalto a Licorista, Roubo de Carga, Assalto a Casa de Penhores, Assalto a Carro Blindado, Emboscada a Rival, Assalto a Casino, Sequestro Relâmpago, Assalto a Museu, Guerra de Território, Entrega Local, Recolha de Mercadoria, Transporte de Armas, Rota Costeira, Contrabando de Tabaco, Frota Fantasma, Rota da Alfândega, Carga Diplomática, Rede de Distribuição, Porto Franco, Phishing Bancário, Clonagem de Cartões, Hack de Semáforos, Fraude de Criptomoedas, Invasão de Servidor, Ciberespionagem, Ataque DDoS, Roubo de Dados, Sabotagem Industrial, Guerra Cibernética, Proteção de Comércio, Boato de Rua, Suborno a Funcionário, Chantagem a Político, Lavagem via Casino, Infiltração em Sindicato, Acordo com Autarca, Campanha de Difamação, Controlo da Imprensa, Golpe de Estado Local, Roubo de Obra de Arte, Operação Encoberta, Resgate de Refém, Leilão Clandestino, Venda de Armamento, Fuga da Prisão, Assassínio por Contrato, Golpe ao Banco Central, Tráfico de Influência Internacional e Operação Fantasma.

</details>

---

## Mundo e mapa

### QG em Portugal

Uma conta nova começa sem Quartel-General. O jogador escolhe o primeiro QG diretamente no mapa.

A validação é feita no servidor:

- apenas em **terra firme portuguesa**;
- Continente, Madeira e Açores são suportados;
- mar e grandes corpos de água interiores são rejeitados;
- existe proteção adicional junto a costa/fronteira;
- a posição é validada com geometria GeoJSON real de Portugal;
- o QG é uma decisão permanente no fluxo atual.

### Mundo gerado em redor do QG

Depois da colocação:

- são geradas aproximadamente **16 zonas**;
- as zonas distribuem-se por **3 anéis de distância**;
- zonas próximas tendem a suportar operações mais rápidas;
- zonas mais afastadas alimentam maior distância, risco e recompensa;
- todos os pontos são novamente validados em terra;
- as zonas recebem nomes reais através de reverse geocoding;
- o sistema evita mostrar zonas ainda sem nome confirmado.

### Mapa

- React Leaflet + Leaflet.
- Base CartoDB Dark Matter.
- Marcadores de oportunidades, equipas, imóveis, QG e polícia.
- Movimento interpolado em tempo real.
- Legenda, filtros e tooltips.
- Interface desenhada para desktop e toque/mobile.
- Colocação de imóveis e QG em modo focado para evitar UI sobreposta.

---

## Operações e equipas

Existem quatro especializações base de equipa:

| Especialização | Foco |
|---|---|
| Crew de Assalto | Assaltos, roubos e confronto |
| Rede Logística | Transporte, entregas e contrabando |
| Célula Técnica | Hacking, infiltração e vigilância |
| Unidade de Influência | Cobranças, lavagem e operações sociais |

O sistema operacional inclui:

- preview de despacho;
- decomposição da probabilidade de sucesso;
- recomendação de oportunidade;
- recomendação de equipa;
- recomendação para repetir operações;
- favoritos por tipo de oportunidade;
- requisitos por nível;
- requisitos de veículos;
- categorias e especializações adequadas;
- efeitos de distância;
- trânsito;
- chuva;
- noite/discrição;
- fadiga;
- moral;
- lealdade;
- experiência da equipa;
- compatibilidade do veículo;
- compatibilidade do armamento;
- condição do veículo;
- proficiência das armas;
- liderança e composição da equipa;
- calor policial;
- presença policial local;
- efeitos de propriedades;
- cooldown após missões e alterações de roster;
- recall de equipas em trânsito;
- bónus por presença local;
- eventos excecionais e saque adicional;
- progressão por fases: viagem, operação, regresso e conclusão.

O motor mantém um piso de chance e risco residual: nenhuma operação é garantida a 100%.

---

## Operacionais e RH

### 24 especializações

<details>
<summary><strong>Ver todas as especializações</strong></summary>

Assaltante, Motorista, Hacker, Mecânico, Informador, Médico Clandestino, Lavador de Dinheiro, Advogado, Negociador, Segurança, Contrabandista, Falsificador, Espião, Gestor de Empresa, Franco-Atirador, Arrombador, Piloto de Fuga, Estafeta, Engenheiro Social, Criptógrafo, Relações Públicas, Chantagista, Químico e Recrutador.

</details>

### 9 atributos

Força, Inteligência, Discrição, Condução, Tiro, Hack, Negociação, Sangue-frio e Resistência.

### Progressão individual

- 4 raridades: **Comum, Raro, Elite e Lendário**;
- 7 ranks: **Recruta → Membro → Especialista → Veterano → Tenente → Chefe de Equipa → Braço-Direito**;
- 10 talentos;
- XP e level individual;
- promoções pagas;
- salários;
- histórico por operacional;
- bónus e passivos de especialização.

### Estado humano

Cada operacional pode ser afetado por:

- moral;
- lealdade;
- fadiga;
- ausência;
- treino;
- descanso;
- ferimentos;
- prisão;
- missão ativa;
- risco de traição.

A organização pode sofrer roubo interno, fuga de informação, sabotagem ou abandono quando o risco de traição cresce.

### Recrutamento e treino

Fontes: Rua, Bares, Empresas, Prisões, Mercado Negro e Contactos.

Cursos: Combate, Condução Evasiva, Hacking, Discrição, Negociação, Primeiros Socorros, Logística, Gestão, Liderança e Treino Físico.

---

## Frota

### 11 veículos

| Veículo | Nível | Preço base | Velocidade | Lugares | Discrição |
|---|---:|---:|---:|---:|---:|
| Sedan Usado | 1 | 6 000 € | 9 | 4 | 75 |
| Moto Rápida | 1 | 12 000 € | 15 | 2 | 70 |
| Carrinha de Entregas | 1 | 9 000 € | 10 | 3 | 85 |
| Van Reforçada | 2 | 18 000 € | 12 | 6 | 80 |
| Berlina Blindada | 2 | 22 000 € | 13 | 4 | 45 |
| Buggy Todo-o-Terreno | 2 | 20 000 € | 16 | 2 | 25 |
| Desportivo | 3 | 30 000 € | 19 | 2 | 15 |
| SUV Blindado | 4 | 45 000 € | 14 | 5 | 35 |
| Limousine | 4 | 50 000 € | 11 | 6 | 5 |
| Supercarro | 5 | 65 000 € | 26 | 2 | 8 |
| Carro Furtivo | 5 | 55 000 € | 20 | 2 | 95 |

A frota tem:

- gasolina e gasóleo;
- consumo real por modelo;
- tamanho de depósito;
- autonomia;
- combustível;
- desgaste e condição;
- quilometragem;
- reparação;
- abastecimento;
- compra e venda;
- atribuição e transferência;
- otimização automática;
- compatibilidade por tipo de operação;
- notoriedade no sistema Cidade Viva;
- apreensão, seguro e recuperação em mecânicas de rua.

---

## Armamento

### 9 modelos

| Arma | Nível | Preço base | Perfil |
|---|---:|---:|---|
| Faca/Taser | 1 | 1 200 € | Silenciosa |
| Pistola | 1 | 2 800 € | Equilibrada |
| Espingarda | 2 | 5 000 € | Assalto |
| Submetralhadora | 3 | 10 000 € | Assalto |
| Pistola Silenciada | 3 | 8 000 € | Silenciosa |
| Caçadeira de Canos Serrados | 3 | 6 500 € | Assalto |
| Rifle de Assalto | 4 | 18 000 € | Assalto especial |
| Rifle de Precisão | 5 | 32 000 € | Técnica/especial |
| Metralhadora Ligeira | 6 | 45 000 € | Assalto pesado |

O modelo de armas considera:

- potência;
- precisão;
- alcance;
- peso;
- velocidade de utilização;
- durabilidade;
- fiabilidade;
- capacidade de carregador;
- manutenção;
- discrição;
- requisitos de atributos;
- compatibilidade com a operação;
- proficiência do operacional;
- condição;
- desgaste por missão;
- risco de encravamento;
- munição carregada e stock logístico por categoria;
- recarga a partir do inventário da organização;
- cinco linhas de modificações persistentes (fiabilidade, ergonomia, precisão, perfil discreto e reforço);
- impacto no calor e na probabilidade da missão.

---

## Imóveis e QG

### 12 tipos de imóveis

| Imóvel | Nível mín. | Função principal |
|---|---:|---|
| Esconderijo | 1 | Aumenta capacidade de operacionais |
| Garagem | 1 | Aumenta capacidade de veículos |
| Empresa de Fachada | 2 | Lavagem automática |
| Armazém | 2 | Bónus em logística |
| Posto de Vigilância | 2 | Bónus em operações técnicas |
| Escritório de Advocacia | 2 | Bónus em influência |
| Laboratório | 3 | Produção passiva de dinheiro sujo + calor |
| Oficina | 3 | Desconto em reparações |
| Arsenal | 3 | Bónus em assalto |
| Casa de Câmbio | 3 | Aumenta lavagem automática |
| Porto Clandestino | 4 | Bónus global de recompensas |
| Centro Logístico | 4 | Grande aumento de capacidade da frota |

- imóveis podem ser comprados, vendidos, renomeados e melhorados;
- nível máximo atual de imóvel: **3**;
- propriedades influenciam economia, capacidade e operações;
- calor elevado pode criar risco de rusga;
- existe otimização de propriedades;
- cada imóvel pode desenvolver **Segurança, Armazenamento e Operações**;
- até quatro operacionais livres podem ser destacados para uma instalação e aumentar a sua eficiência;
- o preço regional efetivamente pago é usado também nas melhorias automáticas;
- o QG possui sistema próprio de upgrades, prioridades e cosméticos;
- os departamentos Financeiro, RH, Logística, Investigação e Comunicações têm três níveis e efeitos reais;
- nível máximo atual do QG: **10**, com o tier final reservado à organização nível **100**.

---

## Economia e risco

O jogo trabalha com duas moedas operacionais:

- **dinheiro limpo**;
- **dinheiro sujo**.

Valores de arranque definidos atualmente no motor:

- **100 000 € limpos**;
- **5 000 € sujos**.

Outros sistemas:

- lavagem manual;
- lavagem passiva;
- produção passiva;
- limites de dinheiro sujo;
- calor adicional por acumulação de dinheiro sujo;
- salários;
- manutenção;
- combustível;
- reparações;
- compra/venda de ativos;
- suborno policial;
- tratamento médico;
- libertação de operacionais;
- custos de recrutamento, treino e promoção;
- registo de transações;
- escalonamento de recompensas;
- distância e dificuldade;
- bónus permanentes por marcos de sucesso;
- centro financeiro de 30 dias com receitas, despesas, resultado e valor dos ativos;
- três níveis de controlo territorial com custo de defesa e rendimento passivo;
- investimentos de prestígio de late game;
- rede de proteção temporária contra rusgas.

O fecho económico acontece **todas as segundas-feiras às 20:00, Europe/Lisbon**. Cobra salários brutos, TSU patronal, a fração semanal dos custos fixos da frota, manutenção imobiliária e defesa territorial. Combustível e reparações continuam a ser custos variáveis. Os valores são centralizados em `backend/economy_constants.py`.

---

## Progressão 1–100

A organização tem agora **100 níveis**. Os níveis 1–10 preservam os thresholds históricos para manter compatibilidade com saves existentes; os níveis 11–100 usam uma curva progressiva própria.

O conteúdo deixa de ficar concentrado no early game: operações, veículos, armas, imóveis, recrutamento, território, prestige, especializações, QG e Mastermind distribuem desbloqueios ao longo da carreira. Marcos estruturais incluem território no 20/45/75, contactos no 75, infraestrutura soberana no 85 e o capstone **Império SUBMUNDO** no nível 100.

O frontend mostra o próximo desbloqueio relevante e revela módulos avançados progressivamente para reduzir carga visual no início.

---

## Missões e progressão

Existem **102 definições de quests**:

| Tipo | Quantidade |
|---|---:|
| Principais | 39 |
| Diárias | 29 |
| Semanais | 15 |
| Dinâmicas | 8 |
| Eventos | 7 |
| Decisões | 4 |

A história principal está organizada em 6 capítulos:

1. Começo
2. Expansão
3. Organização
4. Domínio
5. Consolidação
6. Legado

O sistema suporta:

- objetivos de estado e de contagem;
- recompensas escaladas;
- dificuldade;
- streaks;
- escolhas;
- eventos contextuais;
- missões dinâmicas geradas pelo estado atual;
- reclamar individualmente ou em massa;
- decisões com consequências.

---

## Cidade Viva

O núcleo urbano está integrado no estado do jogador e influencia diretamente operações, economia e competição. A simulação usa o horário de Lisboa e janelas globais partilhadas, para que clima e acontecimentos sejam previsíveis e não um bónus escondido lançado por missão.

### Sistemas implementados

- procurado de **0 a 5 estrelas** e camada policial no mapa;
- conquista de zonas operacionais a partir do nível 5;
- **3 níveis de consolidação territorial**;
- pressão rival e defesa persistentes;
- custo semanal de defesa territorial;
- rendimento passivo territorial;
- bónus local de recompensa por controlo;
- **18 stocks consumíveis** com capacidade de armazenamento;
- loadouts de equipa consumidos no despacho;
- notoriedade persistente por veículo;
- pneus, revisões, seguro e inspeção;
- apreensão temporária de veículos com recuperação mais rápida quando segurados;
- doutrinas de equipa: Equilibrada, Segurança Máxima, Baixo Perfil e Impacto;
- **clima global persistente** em janelas de 2 horas, com efeitos em deslocação, calor, recompensa e chance;
- **ciclo horário** madrugada/manhã/tarde/noite ligado a trânsito, polícia e operações;
- **eventos urbanos globais** em janelas de 6 horas e calendário dos próximos acontecimentos;
- notícias automáticas construídas a partir do estado da cidade e dos eventos reais da organização;
- **10 tipos de negócios urbanos** com compra, níveis, condição, segurança, rendimento limpo/sujo e calor;
- bónus sistémicos da rede empresarial aplicados às categorias de operação relevantes;
- **5 organizações rivais NPC** persistentes com poder, hostilidade, inteligência e pressão territorial;
- rivais autónomos em janelas de 3 horas: podem sabotar negócios, aumentar calor, pressionar território ou ajudar quando aliados;
- reconhecimento, sabotagem, pressão, tréguas e acordos com rivais, com custos e cooldowns;
- temporadas de **30 dias**, leaderboard e prémios automáticos de pódio com claim atómico;
- PvP **opt-in**, desafios com consentimento e consequências persistentes;
- alianças entre jogadores por código de convite;
- chat/frequência da cidade com limitação de spam;
- casino clandestino com roleta e blackjack, usando exclusivamente moeda do jogo;
- saúde/stress do chefe, hospitalização e detenção com impacto real e visível na liderança das operações;
- modo convidado local com uma simulação equivalente de Cidade Viva para o GitHub Pages.

A Cidade Viva não substitui a preparação das equipas: os seus multiplicadores são deliberadamente limitados e ficam visíveis no preview do despacho.

---

## Mastermind

O sistema **Mastermind** representa operações de grande escala com planeamento em várias fases.

### Alvos

- **Leilão da Meia-Noite** — organização nível 10;
- **Reserva do Estuário** — nível 25;
- **Nó Soberano** — nível 40;
- **Cofre do Freeport** — nível 55;
- **Bolsa do Consórcio** — nível 70;
- **Arquivo Soberano** — nível 85;
- **Operação SUBMUNDO** — capstone de nível 100.

### Estrutura de um golpe

1. Reconhecimento.
2. Criação do plano.
3. Seleção da equipa.
4. Seleção do veículo de fuga.
5. Escolha de abordagem.
6. Escolha do recetor.
7. Preparações obrigatórias.
8. Preparações opcionais.
9. Lançamento do final.
10. Complicação dinâmica.
11. Recolha do resultado.

### Abordagens

- Silencioso;
- Infiltração;
- Choque;
- Fantasma;
- Distribuído.

### Progressão Mastermind

Dez estatutos: Planeador, Coordenador, Arquiteto, Mastermind, Estratega, Diretor, Soberano, Arquiteto Nacional, Lenda e SUBMUNDO.

Também inclui:

- XP separado;
- percentagem configurável para a equipa;
- lista de prontidão;
- alvo em cooldown;
- recompensas rivais;
- caçadores;
- caches de sinal territoriais;
- mercado negro;
- oito mercadorias, desde Microchips Selados até Chaves Soberanas;
- preços dinâmicos em janelas de **15 minutos**.

---

## Centro de Comando e UX

O frontend funciona como um cockpit tático sobre o mapa.

### Centro de Comando

- `Ctrl/Cmd + K` abre pesquisa global;
- `/` também pode abrir pesquisa;
- pesquisa tolerante a acentos e termos parciais;
- navegação por teclado;
- histórico de comandos;
- pesquisa de equipas, operacionais, veículos, imóveis, armas e oportunidades;
- ações rápidas;
- navegação direta para painéis.

### Atalhos

Os painéis principais suportam atalhos numéricos `1–9`.

### Ferramentas de gestão

- sincronização manual;
- último painel memorizado;
- deep links via `?panel=`;
- exportação CSV de transações;
- briefing operacional copiável;
- descanso em massa;
- abastecimento em massa;
- reparações em massa;
- recolha de recompensas em massa;
- otimização global da organização;
- avisos de dados desatualizados;
- notificações desktop opcionais;
- focus mode;
- HUD compacto;
- perfil de alto contraste;
- redução de movimento.

---

## Loja

A loja usa **dinheiro do jogo** e inclui:

- aceleração de temporizadores;
- cosméticos;
- VIP;
- slots extra;
- pinturas de veículos;
- emblemas de equipa;
- skins do QG.

Não existe dependência de pagamentos reais no fluxo documentado do projeto.

---

## Polícia

A camada policial é uma simulação própria integrada no mapa e nas missões.

### PSP e GNR

- **PSP** em centros urbanos configurados;
- **GNR** como força territorial/rural por omissão;
- zonas de patrulhamento ligadas aos ativos do jogador;
- diferentes raios, densidade e resposta;
- viaturas no mapa;
- reforços;
- deteção;
- perseguição;
- interceção;
- resposta dependente da força competente;
- pressão crescente com o calor.

A configuração atual inclui centros PSP em várias cidades portuguesas, entre elas Lisboa, Porto, Braga, Coimbra, Faro, Setúbal, Aveiro, Viseu, Leiria, Évora, Santarém, Funchal e Ponta Delgada.

---

## Simulação interior

As operações podem ser acompanhadas numa **Câmara da Operação**.

O sistema interior é executado no frontend e inclui:

- geração procedural de edifícios;
- plantas/blueprints;
- segmentos e obstáculos;
- pathfinding A*;
- NPCs;
- atribuição de papéis com base no roster real;
- fases interiores sincronizadas com os timestamps da missão;
- aproximação, entrada, progressão, execução, retirada e saída;
- diálogo/rádio contextual;
- simulação destruída quando a operação termina ou o overlay é fechado.

---

## Administração e legal

### Administração

Existe painel para administradores/moderadores com:

- dashboard;
- lista de utilizadores;
- detalhe de utilizador;
- estatísticas do servidor;
- logs;
- concessão de recursos;
- reset de progresso;
- ban/unban;
- gestão de roles;
- grant/revoke de admin.

Moderadores têm acesso de leitura às áreas previstas; mutações administrativas exigem role de administrador.

### Legal

Rotas e páginas para:

- Termos de Serviço;
- Política de Privacidade;
- RGPD;
- Changelog;
- disclaimer ficcional.

A aceitação do disclaimer é auditada no backend com versão e registo temporal.

---

## Arquitetura

```text
┌────────────────────────────────────────────────────────────────┐
│                        Browser / Mobile Web                    │
│  React 19 · CRACO · Tailwind · React Router · Leaflet         │
└──────────────────────────────┬─────────────────────────────────┘
                               │ HTTPS / REST
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                          FastAPI                               │
│ Auth · Game · Organization · City · Mastermind · Admin · Legal│
│ Engine · Economy Director · Quests · World · City · Live Ops  │
└──────────────────────────────┬─────────────────────────────────┘
                               │ Motor/PyMongo
                               ▼
┌────────────────────────────────────────────────────────────────┐
│                           MongoDB 7                            │
│ users · players · teams · employees · vehicles · missions ... │
└────────────────────────────────────────────────────────────────┘

Produção:
Internet → Caddy → React estático
                 └→ /api/* → FastAPI → MongoDB
```

### Filosofia do motor

O backend usa um **tick lazy**: o estado avança durante leituras/ações relevantes em vez de depender de um game loop permanente para tudo. Entre outras coisas, o motor trata de spawn, expiração, progresso de missões, calor, RH, economia e eventos persistentes.

O tick é serializado por jogador através de uma lease atómica, para que polling concorrente em várias tabs/dispositivos não duplique rendimento, salários, raids ou automações. A recuperação offline usa uma janela única de **28 dias** tanto para produção como para custos fixos. Rotas resolvidas no despacho ficam persistidas e são tratadas como geometria canónica da missão.

A progressão 1–100 usa um contrato de desbloqueios versionado: alterar preços ou recompensas não desloca silenciosamente conteúdo entre níveis. Operações, quests, Mastermind e temporadas passam ainda pelo `economy_director.py`, que aplica guardrails globais contra multiplicadores ou farms que escapem ao balanceamento normal.

---

## Stack técnica

### Frontend

- React 19
- React DOM 19
- React Router 7
- CRACO / react-scripts
- Tailwind CSS
- Radix UI
- React Leaflet / Leaflet
- TanStack Query
- Axios
- Framer Motion
- Sonner
- Recharts
- React Hook Form
- Zod
- Lucide React

### Backend

- Python
- FastAPI 0.110
- Uvicorn
- Motor
- PyMongo
- Pydantic
- PyJWT
- bcrypt
- HTTPX
- python-dotenv

### Infraestrutura

- MongoDB 7
- Docker / Docker Compose
- Caddy
- Let's Encrypt
- GitHub Actions
- GitHub Pages
- Autoheal container
- health checks
- volumes persistentes
- script de backup MongoDB

---

## Rotas do frontend

| Rota | Função |
|---|---|
| `/` | Jogo protegido |
| `/auth` | Login/registo; oculto na build pública atual |
| `/termos` | Termos |
| `/privacidade` | Privacidade |
| `/rgpd` | RGPD |
| `/changelog` | Histórico de versões |
| `/painel` | Administração/moderação |
| `/dev/loading` | Preview de desenvolvimento |
| `/dev/operation` | Preview de operação |

O `BrowserRouter` usa `process.env.PUBLIC_URL`, permitindo funcionar corretamente em `/LusoraeCrime` no GitHub Pages.

---

## API

A API é organizada por domínio.

<details>
<summary><strong>Autenticação — /api/auth</strong></summary>

- `POST /register`
- `POST /check-availability`
- `POST /login`
- `POST /logout`
- `GET /me`
- `POST /claim-admin`
- `POST /change-password`
- `POST /delete-account`
- `POST /refresh`

</details>

<details>
<summary><strong>Jogo principal — /api/game</strong></summary>

**Estado e operações**
- `GET /catalog`
- `GET /state`
- `POST /dispatch/preview`
- `POST /dispatch`
- `POST /dispatch/recommend_opportunity`
- `POST /dispatch/recommend_team`
- `POST /dispatch/recommend_repeat`
- `POST /opportunities/favorite`
- `POST /missions/recall`

**Equipas e RH**
- `POST /teams/create`
- `POST /employees/recruit`
- `POST /recruitment/refresh`
- `POST /employees/assign`
- `POST /employees/train`
- `POST /employees/rest`
- `POST /employees/promote`
- `POST /employees/bonus`
- `POST /employees/heal`
- `POST /employees/release`
- `POST /employees/fire`
- `POST /employees/rename`
- `POST /employees/optimize`

**Frota**
- `POST /vehicles/buy`
- `POST /vehicles/sell`
- `POST /vehicles/refuel`
- `POST /vehicles/repair`
- `POST /vehicles/assign`
- `POST /vehicles/transfer`
- `POST /vehicles/rename`
- `POST /vehicles/optimize`

**Armamento**
- `POST /weapons/buy`
- `POST /weapons/sell`
- `POST /weapons/repair`
- `POST /weapons/assign`
- `POST /weapons/unassign`
- `POST /weapons/auto_assign`
- `POST /weapons/optimize`

**Imóveis e QG**
- `POST /properties/buy`
- `POST /properties/sell`
- `POST /properties/upgrade`
- `POST /properties/rename`
- `POST /properties/optimize`
- `POST /hq/validate`
- `POST /hq/place`
- `POST /hq/upgrade`
- `POST /hq/priority`

**Economia, quests e loja**
- `POST /police/bribe`
- `POST /launder`
- `GET /transactions`
- `POST /settings`
- `POST /quests/claim`
- `POST /quests/claim_all`
- `POST /quests/choose`
- `POST /shop/speedup`
- `POST /shop/buy_slot`
- `POST /shop/vip`
- `POST /shop/cosmetic`
- `POST /vehicles/equip_paint`
- `POST /teams/equip_emblem`
- `POST /hq/equip_skin`

</details>

<details>
<summary><strong>Organização — /api/game/org</strong></summary>

- `GET /catalog`
- `GET /finance/summary`
- `POST /inventory/buy`
- `POST /inventory/sell`
- `POST /teams/rename`
- `POST /teams/doctrine`
- `POST /teams/policies`
- `POST /teams/loadout`
- `POST /teams/dissolve`
- `POST /weapons/reload`
- `POST /weapons/upgrade`
- `POST /vehicles/service`
- `POST /vehicles/tires`
- `POST /vehicles/insurance`
- `POST /vehicles/inspection`
- `GET /vehicles/{vehicle_id}/lifecycle`
- `POST /properties/module`
- `POST /properties/staff`
- `POST /departments/upgrade`
- `POST /territories/claim`
- `POST /territories/consolidate`
- `POST /territories/defend`
- `POST /prestige/buy`
- `POST /governance/protection`

Todas as mutações deste router aceitam `request_id` e usam recibos idempotentes com TTL para impedir cobrança duplicada em retries de rede.

</details>

<details>
<summary><strong>Mastermind — /api/game/mastermind</strong></summary>

- `GET /state`
- `POST /heists/intel`
- `POST /heists/create`
- `POST /heists/prep/start`
- `POST /heists/prep/claim`
- `POST /heists/launch`
- `POST /heists/claim`
- `POST /heists/abort`
- `POST /market/trade`
- `POST /bounty`
- `POST /cache/scan`

</details>

<details>
<summary><strong>Administração — /api/admin</strong></summary>

- `GET /dashboard`
- `GET /users`
- `GET /user/{user_id}`
- `POST /user/{user_id}/grant-resources`
- `POST /user/{user_id}/reset-progress`
- `POST /user/{user_id}/ban`
- `POST /user/{user_id}/unban`
- `POST /user/{user_id}/role`
- `POST /user/{user_id}/grant-admin`
- `POST /user/{user_id}/revoke-admin`
- `GET /logs`
- `GET /server-stats`

</details>

<details>
<summary><strong>Legal — /api/legal</strong></summary>

- `GET /meta`
- `GET /documents/{doc_id}`
- `GET /changelog`
- `POST /disclaimer-ack`

</details>

---

## Executar localmente

### Pré-requisitos

- Node.js 20+
- Yarn 1.22
- Python 3.11+ recomendado
- MongoDB

### Backend

Cria `backend/.env` com valores teus:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=submundo
JWT_SECRET=trocar-por-um-segredo-forte
CORS_ORIGINS=http://localhost:3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=trocar-esta-password
```

Depois:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install
REACT_APP_BACKEND_URL=http://localhost:8001 yarn start
```

Para mostrar a autenticação localmente, não definas `REACT_APP_AUTH_UI_ENABLED=false`.

---

## Deploy

### GitHub Pages

O workflow `.github/workflows/pages.yml`:

1. corre em pushes para `main` que alterem frontend/workflow;
2. instala Node 20;
3. instala dependências com `yarn install --frozen-lockfile`;
4. faz build de produção;
5. gera fallback SPA em `404.html`;
6. adiciona `.nojekyll`;
7. envia o artefacto;
8. publica com `actions/deploy-pages`.

### Produção completa com Docker

A pasta `deploy/` contém:

- `docker-compose.yml`;
- Dockerfile do frontend;
- Dockerfile do backend;
- Caddyfile;
- setup para Ubuntu/VPS;
- auto-deploy;
- requirements de produção;
- backups do MongoDB.

Topologia:

```text
Internet :80/:443
        │
        ▼
      Caddy
      ├── /        → React
      └── /api/*   → FastAPI
                       │
                       ▼
                    MongoDB
```

O Caddy trata de HTTPS automático e serve a SPA; o MongoDB não é exposto diretamente à Internet na configuração Docker fornecida.

Consulta `deploy/HOSTINGER.md` para o guia operacional completo.

---

## Segurança

O projeto já inclui várias medidas:

- hashing de passwords com bcrypt;
- JWT;
- access + refresh token;
- Bearer token no frontend;
- lockout após **5 tentativas falhadas**;
- bloqueio durante **15 minutos**;
- política mínima de password com 8 caracteres, maiúscula, minúscula e número;
- validação de email;
- validação de nome de organização;
- CORS explícito;
- roles `admin` e `moderator`;
- rotas administrativas separadas;
- refresh automático de sessão;
- timeout de pedidos no frontend;
- disclaimer auditado;
- MongoDB sem porta pública na stack Docker;
- headers de segurança no Caddy;
- health checks;
- autoheal;
- backups MongoDB.

**Nunca colocar segredos, passwords, JWT secrets ou credenciais reais no README ou no código versionado.**

---

## Estrutura do repositório

```text
SUBMUNDO/
├── .github/
│   └── workflows/
│       └── pages.yml
├── backend/
│   ├── auth.py
│   ├── server.py
│   ├── engine.py
│   ├── game_data.py
│   ├── economy_constants.py
│   ├── economic_simulator.py
│   ├── routes_game.py
│   ├── routes_city.py
│   ├── routes_organization.py
│   ├── organization_systems.py
│   ├── organization_intelligence.py
│   ├── organization_automation.py
│   ├── organization_events.py
│   ├── economy_director.py
│   ├── routes_mastermind.py
│   ├── routes_admin.py
│   ├── routes_legal.py
│   ├── quests.py
│   ├── quests_data.py
│   ├── city_data.py
│   ├── mastermind_data.py
│   ├── live_ops.py
│   ├── live_phrases.py
│   ├── world_gen.py
│   ├── geo.py
│   ├── geocode.py
│   └── data/
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── game/
│       │   ├── legal/
│       │   └── ui/
│       ├── context/
│       ├── hooks/
│       ├── lib/
│       │   └── interior/
│       └── pages/
├── deploy/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   ├── HOSTINGER.md
│   ├── backend/
│   ├── frontend/
│   └── scripts/
├── docs/
│   ├── GENERAL_IMPROVEMENTS_25.md
│   └── MASTERMIND_HEISTS_25.md
├── memory/
│   └── PRD.md
└── README.md
```

---

## Testes

O repositório inclui:

- testes backend com pytest;
- testes específicos de autenticação Bearer/JWT;
- testes de disclaimer/legal;
- suites de regressão;
- relatórios em `test_reports/`;
- testes de API em `backend_test.py`;
- health check opcional no frontend;
- validações de build através do GitHub Actions.

Os relatórios versionados refletem execuções passadas; devem ser novamente executados após alterações relevantes antes de serem tratados como estado atual.

---

## Documentação de design

A identidade visual definida no projeto segue um **tactical command-center HUD**:

- fundo OLED preto/cinza;
- painéis glassmorphism;
- vermelho para ação/calor;
- verde para dinheiro limpo;
- âmbar para dinheiro sujo;
- azul/ciano para sistema;
- alta densidade de informação;
- mapa como elemento principal;
- tipografia mono para métricas e timers;
- animações com suporte a `prefers-reduced-motion`;
- foco em contraste e acessibilidade.

---

## Changelog e versões

O changelog público do backend mantém a série formal:

- v0.1.0 — Temporada 0
- v0.2.0 — Frota e Império Imobiliário
- v0.3.0 — Funcionários
- v0.4.0 — Centro de Comando
- v0.5.0 — Cockpit Cinemático
- v0.6.0 — Autenticação AAA e Transparência Legal

A documentação técnica também contém pacotes posteriores, incluindo:

- **25 melhorias gerais — v1.2.0**
- **Cidade Viva — v1.3.0**
- **Mastermind — 25 mecânicas**

Por isso, o número mostrado no changelog público e as versões dos pacotes de funcionalidades não devem ser interpretados como uma única versão SemVer global até existir uma política de release unificada.

---

## Android / Google Play

O projeto está preparado para distribuição Android através de **Capacitor 8**, com package ID legado `pt.lusorae.crime` (mantido para compatibilidade de atualização na Google Play), **target/compile SDK 36**, minSdk 24 e pipeline GitHub Actions que gera um Android App Bundle de validação.

- Google Sign-In via Credential Manager / Social Login.
- Google ID token validado no backend antes da criação da sessão.
- Política de Privacidade pública: https://pulsebreakpt.github.io/LusoraeCrime/privacy.html
- Eliminação de conta fora da app: https://pulsebreakpt.github.io/LusoraeCrime/delete-account.html
- Eliminação dentro da app em Definições → Conta.
- Guia completo de release: [docs/GOOGLE_PLAY_RELEASE.md](docs/GOOGLE_PLAY_RELEASE.md)
- Workflow Android: [Android / Google Play readiness](.github/workflows/android.yml)

A ativação efetiva do Google Sign-In requer configurar o Web OAuth Client ID e o Android OAuth Client no mesmo projeto Google Cloud, incluindo o SHA-1 do certificado de assinatura da Play Store.

---

## Direção futura

Itens ainda documentados como evolução possível:

- jogadores e alianças visíveis diretamente no mapa;
- guerras PvP territoriais assíncronas com temporadas dedicadas;
- mercado entre organizações com ordens, contratos e reputação;
- árvore de tecnologia/investigação;
- polícia e investigações ainda mais profundas;
- eventos comunitários cooperativos de servidor;
- PWA/Capacitor para Android/iOS;
- modularização adicional de rotas e motor à medida que o projeto cresce.

---

## Licença

Neste momento o repositório não contém um ficheiro `LICENSE`. Não assumas que o código pode ser redistribuído, sublicenciado ou reutilizado fora dos termos definidos pelo proprietário do repositório.

---

<p align="center">
  <strong>SUBMUNDO</strong><br>
  Um império não se controla com um gatilho. Controla-se com informação, logística, dinheiro e decisões.
</p>
