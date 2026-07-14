# 25 melhorias gerais — v1.2.0

Este pacote melhora o jogo completo — navegação, comando, operações, equipa, frota, armamento, economia, alertas e acessibilidade — sem alterações à base de dados.

1. **Centro de Comando global** aberto com `Ctrl/Cmd + K`.
2. **Pesquisa rápida com `/`** a partir de qualquer painel.
3. **Pesquisa tolerante a acentos e termos parciais** para encontrar resultados em português com maior facilidade.
4. **Navegação integral por teclado** nos resultados com setas e `Enter`.
5. **Histórico persistente de comandos recentes** para repetir ações frequentes.
6. **Navegação global entre painéis** diretamente pelo Centro de Comando.
7. **Pesquisa transversal de equipas, funcionários, veículos, propriedades e armas**.
8. **Pesquisa e abertura direta de oportunidades** no respetivo cartão de despacho.
9. **Atalhos numéricos `1–9`** para os principais painéis.
10. **Sincronização manual com `R`**, sem precisar de recarregar a página.
11. **Memorização do último painel visitado** entre sessões.
12. **Deep links por `?panel=` e suporte do histórico do navegador** para partilhar e recuperar vistas.
13. **Cópia de briefing operacional** com o estado essencial da organização.
14. **Exportação CSV das transações financeiras** para análise externa.
15. **Descanso seguro de todos os funcionários elegíveis** numa fila sequencial.
16. **Reabastecimento seguro de todos os veículos elegíveis** numa fila sequencial.
17. **Reparação segura de toda a frota danificada** numa fila sequencial.
18. **Reparação segura de todo o armamento danificado** numa fila sequencial.
19. **Recolha rápida de todas as recompensas de missão disponíveis**.
20. **Otimização integral da organização** com uma única sequência de manutenção.
21. **Contagem de alertas no título do separador** para sinalizar eventos pendentes.
22. **Avisos de ligação perdida e dados desatualizados**, com botão de nova tentativa.
23. **Notificações desktop opcionais** para novos eventos quando o jogo está em segundo plano.
24. **Perfis de foco e HUD compacto** para reduzir distrações e libertar espaço útil.
25. **Perfil de acessibilidade** com alto contraste e redução manual de movimento.

## Segurança das ações em massa

As ações de descanso, reabastecimento e reparação são executadas sequencialmente, apresentam progresso agregado e fazem uma única sincronização final. Isto evita pedidos concorrentes sobre saldo ou estado desatualizado e reduz a quantidade de notificações.

## Validação

- Transpilação estática dos ficheiros JavaScript/JSX alterados com esbuild.
- Verificação da folha de estilos alterada.
- Revisão das ligações entre contextos, hooks, painéis e Centro de Comando.
