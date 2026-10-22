# IA: visão geral

Ponto de entrada: `chooseMove({ board, config, player, difficulty, rng })` em
`src/core/ai/engine.js`.

## Os cinco níveis

Definidos em `DIFFICULTY` (`src/core/constants.js`):

| Nível        | Profundidade máx. | Tempo  | Erro deliberado | Solução exata no 3×3 | MCTS   |
| ------------ | ----------------- | ------ | --------------- | -------------------- | ------ |
| Fácil        | 1                 | 60 ms  | 35%             | não                  | —      |
| Normal       | 2                 | 150 ms | 12%             | não                  | —      |
| Difícil      | 4                 | 300 ms | 3%              | não                  | —      |
| Especialista | 6                 | 600 ms | 0               | sim                  | —      |
| OMEGA        | 10                | 700 ms | 0               | sim                  | 400 ms |

"Erro deliberado" é a probabilidade de o nível jogar um lance legal sorteado, ignorando até uma
vitória ou um bloqueio óbvios. É o que faz os níveis baixos perderem mesmo no 3×3.

## Ordem de decisão

A mesma em todos os tabuleiros e variantes:

1. **Erro deliberado** — sorteia `rng()`; se cair abaixo da taxa do nível, joga um lance aleatório.
2. **Tática de um lance** (exceto Misère) — se dá para completar uma linha, completa; senão, se o
   adversário completaria uma linha no próximo lance, bloqueia.
3. **Solução exata** — no 3×3 clássico, Especialista e OMEGA consultam a tabela resolvida
   ([AI_TABLEBASE.md](AI_TABLEBASE.md)) e sorteiam entre os lances ótimos.
4. **Busca** — alpha-beta com a profundidade e o tempo do nível ([AI_SEARCH.md](AI_SEARCH.md)).
   No OMEGA, o resultado do alpha-beta é refinado por MCTS ([AI_MCTS.md](AI_MCTS.md)).

## Veredito

`chooseMove` devolve o lance e o que a busca fez de fato: `algorithm` (`random`, `tactical`,
`tablebase`, `alpha-beta`, `alpha-beta+mcts` ou `none`), `depth`, `nodes`, `iterations`,
`elapsedMs`, `exact` (verdadeiro quando o resultado é certo), `candidates` (lances com pontuação)
e `reasons` (chaves de tradução). O painel "Leitura da posição" e o laboratório de motores mostram
esses campos; não há número inventado de "confiança".

## Variantes

- **Gravity**: os lances legais são as casas de pouso; a tática imediata só conta casas jogáveis
  agora (uma casa "no ar" não é ameaça).
- **Hexagonal**: tudo o que procura linhas (detecção de vitória, avaliação por janelas, tática
  de um lance, alpha-beta e MCTS) usa `directionsFor(config)`, que no hexagonal devolve só os três
  eixos do hexágono. O corte de candidatos por vizinhança em tabuleiros grandes também é
  hexagonal: `cellDistance` mede a distância no hexágono, então só entram as seis vizinhas (raio 1)
  ou as 18 casas a até dois passos (raio 2).
- **Misère**: completar a linha perde. A tática de um lance é desligada, a avaliação é invertida e
  as simulações do MCTS evitam completar a própria linha.

## Força medida

Veja [AI_BENCHMARKS.md](AI_BENCHMARKS.md). Resumo honesto: no 3×3 os níveis se ordenam com
clareza; em tabuleiros maiores Normal/Difícil/Especialista vencem o Fácil com folga, mas entre
níveis vizinhos a vantagem de quem começa pesa tanto quanto a diferença de nível.
