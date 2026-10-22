# Desempenho

## Orçamento de tempo da IA

Cada nível tem um teto de tempo por lance (`DIFFICULTY` em `src/core/constants.js`):

| Nível        | Alpha-beta | MCTS   | Teto total |
| ------------ | ---------- | ------ | ---------- |
| Fácil        | 60 ms      | —      | 60 ms      |
| Normal       | 150 ms     | —      | 150 ms     |
| Difícil      | 300 ms     | —      | 300 ms     |
| Especialista | 600 ms     | —      | 600 ms     |
| OMEGA        | 700 ms     | 400 ms | 1,1 s      |

A busca verifica o relógio a cada 256 nós e devolve o melhor lance da última profundidade
concluída. A primeira profundidade sempre termina, então sempre há um lance. Os tempos medidos por
lance estão em [AI_BENCHMARKS.md](../ia/AI_BENCHMARKS.md) (o p95 fica colado no teto em tabuleiros
grandes, como esperado).

No 3×3 clássico os níveis Especialista e OMEGA consultam a solução exata, memorizada no processo:
a resposta é praticamente instantânea.

## Thread principal

A busca, a arena, o laboratório e a classificação de replays rodam no Web Worker
(`src/workers/ai.worker.js`) em qualquer tamanho de tabuleiro. Só há execução na thread principal
se o navegador não tiver `Worker`.

O que roda na thread principal a cada lance é barato: redesenho do tabuleiro (no máximo 144
botões), `analyzePosition` (uma varredura do tabuleiro) e o gráfico.

## Custos conhecidos

- `GameEngine.state` clona o estado a cada leitura. É simples e seguro; em um laço muito quente
  valeria guardar a referência.
- A chave da tabela de transposição é uma string montada por posição.
- Na raiz, cada lance é pesquisado com janela completa (dá pontuações exatas para o laboratório e
  para o estudo de replays, ao custo de menos poda).
- Em tabuleiros com mais de 36 casas a busca só considera casas vizinhas de alguma peça.

## Tamanho do build

Medido em `npm run build` desta versão: JavaScript principal ≈ 110 kB (≈ 36 kB com gzip), Worker
≈ 18 kB, CSS ≈ 9 kB. Não há dependências de terceiros no pacote do navegador.

## O que não foi medido

Não há medição de tempo de carregamento, Lighthouse ou uso de memória.
