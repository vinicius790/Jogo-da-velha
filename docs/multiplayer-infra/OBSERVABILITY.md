# Observabilidade

O projeto tem pouca instrumentação, e este documento lista exatamente o que existe. Não há
OpenTelemetry, Prometheus, coleta remota de eventos nem painel.

## Servidor

- `GET /` ou `GET /health` devolve JSON com `status`, número de salas e número de conexões.
  Serve para verificação de saúde (é o que o `HEALTHCHECK` do Dockerfile usa).
- Uma linha de log na inicialização, com a porta e as origens autorizadas.
- Erros de protocolo voltam para o cliente como mensagem `error`; não são registrados em log.

## Navegador

- `src/services/telemetry.js` guarda **em memória**, só durante a sessão, o tempo e o algoritmo
  de cada lance da IA (até 500 amostras). A aba Análise mostra quantidade, média e percentil 95.
  Nada sai do navegador e nada é gravado.
- O painel "Leitura da posição" mostra o que a última busca fez: algoritmo, profundidade, nós e
  tempo.
- A arena IA × IA mede o tempo de cada decisão durante a simulação.
- Falha ao registrar o service worker gera um aviso no console.

## O que faltaria para produção

Logs estruturados no servidor (entradas, saídas, erros, recusas por limite), métricas de salas e
conexões ao longo do tempo, e algum relatório de erros do front-end. Nada disso está implementado.
