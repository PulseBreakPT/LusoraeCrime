# Cidade Viva — 25 mecânicas sandbox (v1.3.0)

Este pacote adapta ao LusoraeCrime o ritmo de um sandbox criminal urbano — perseguição, progressão de rua, território, contactos e veículos com memória — usando sistemas, nomes e conteúdo originais.

1. **Nível de procurado com 0–5 estrelas**, calculado a partir do calor real da organização.
2. **Janela de busca policial com contagem decrescente** quando o alerta chega a três estrelas.
3. **Scanner policial em direto** com força competente, alerta, zona de maior pressão e inteligência ativa.
4. **Eventos urbanos rotativos a cada 30 minutos**, determinados de forma estável por jogador.
5. **Modificadores reais dos eventos** sobre sucesso, pagamentos, calor, equipamento e tipos de atividade.
6. **Reputação de rua independente** ganha em atividades e defesa de zonas.
7. **Seis níveis de reputação com desbloqueios** de contactos, atividades, apostas e equipamento.
8. **Influência individual em cada distrito** gerado à volta do Quartel-General.
9. **Tomada de território aos 100 pontos de influência** com custo e recompensa de reputação.
10. **Três níveis de consolidação territorial**, cada um com maior rendimento e vantagem local.
11. **Pressão rival persistente** que cresce com o tempo em zonas controladas.
12. **Defesa territorial jogável**, com custo, chance, cooldown e consequências de sucesso ou falha.
13. **Rendimento passivo territorial** em dinheiro sujo e fachadas limpas nos níveis superiores.
14. **Rede de quatro contactos desbloqueáveis**: intermediário, mecânico, advogada e informador.
15. **Sistema de favores com relação e cooldown**, incluindo multiplicador de trabalho, assistência, redução de calor/libertação e inteligência.
16. **Corridas clandestinas cronometradas** que usam velocidade, condição, combustível e notoriedade do veículo.
17. **Três escalões de apostas de corrida** com risco e multiplicadores próprios.
18. **Série de vitórias em corridas**, aumentando progressivamente o pagamento até ao limite.
19. **Contratos de entrega à desmontagem** com custos, desgaste, calor e pagamento sujo.
20. **Rotas clandestinas de carga** com maior duração, controlos policiais e equipamento especializado.
21. **Três abordagens operacionais** — Fantasma, Calculado e Impacto — alterando chance, tempo, recompensa e calor.
22. **Três planos de fuga** — Baixo Perfil, Velocidade e Isca — com efeitos sobre captura, duração e custo.
23. **Equipamento tático consumível e loadout de dois espaços**: colete, bloqueador, documentos frios e pneus reforçados.
24. **Notoriedade persistente por veículo e matrículas frias**, ligada também às perseguições das operações normais.
25. **Seguro, apreensão e recuperação de veículos**, aplicados tanto às atividades urbanas como às perseguições do jogo principal.

## Integração com o jogo existente

- O calor continua a ter uma única fonte de verdade no jogador.
- Dinheiro, combustível, condição e estado dos funcionários são alterados nas coleções existentes.
- Veículos apreendidos ficam bloqueados também no despacho normal.
- A notoriedade ganha em missões normais aumenta a probabilidade de perseguição.
- A leitura da Cidade Viva é sequencial ao tick principal para evitar concorrência sobre a carteira.
- Atividades só podem ser reclamadas uma vez; o servidor faz a remoção atómica antes do pagamento.

## Conteúdo original

A inspiração limita-se ao género e ao ritmo de um sandbox urbano. Não são usados nomes de personagens, missões, mapas, marcas, imagens, áudio ou outros recursos de terceiros.
