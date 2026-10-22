# Estudo de replays

Arquivos: `src/core/analysis/move-grader.js`, `src/features/study.js`,
`src/ui/controllers/replays.js`.

## O que faz

Na aba Replays, o botão **Estudar** reexecuta a partida e, antes de cada lance, roda a busca
alpha-beta (profundidade 6, 150 ms por posição) para o lado que jogou. O lance jogado é comparado
com a lista de candidatos:

| Classificação | Critério                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `best`        | pontuação igual ou melhor que a do melhor lance encontrado                                       |
| `good`        | entre os três melhores, sem mudar o resultado previsto                                           |
| `inaccuracy`  | pior que isso, ainda sem mudar o resultado previsto                                              |
| `blunder`     | muda o resultado previsto para pior (deixa escapar vitória forçada, ou entra em derrota forçada) |

"Resultado previsto" é a classe da pontuação: vitória forçada, derrota forçada ou indefinido.

A lista mostrada traz as imprecisões e os erros graves do jogador humano daquela partida (ou dos
dois lados, em partida local), com o lance jogado e o que a busca preferia.

## Análise pós-jogo (`src/core/analysis/review.js`)

`reviewGame(replay, { depth, timeBudgetMs, alternatives })` usa a mesma busca (padrão:
profundidade 6, 150 ms) e a mesma nota (`classifyMove`), mas devolve **cada posição**:

```js
{
  turn, mark, played, playedScore /* null se o lance ficou fora dos candidatos */, grade, best,
  alternatives: [{ index, score, outcome /* 1, 0 ou -1 */ }],  // até 3, do melhor para o pior
  depth, exact, evalScore, wins, threats                       // busca + analyzePosition
}
```

`positions[i]` é a posição antes do lance `i + 1`. `nextMistake(review, turn)` devolve o
próximo lance (depois de `turn`) com nota `inaccuracy` ou `blunder`, ou -1.

Na aba Replays, **Analisar partida** (na lista ou no diálogo de fim de partida) roda a análise no
Web Worker. Os botões de reprodução navegam pelas posições; o painel mostra o lance jogado, a
nota, o valor do lance e as alternativas (vitória/derrota forçada ou avaliação). Clicar numa
alternativa a destaca no tabuleiro; as demais aparecem com borda tracejada. **Próximo erro** pula
para a posição anterior ao próximo erro e volta ao início quando chega ao fim.

## Limites

- No 3×3 a análise é exata (a busca chega ao fim do jogo). Em tabuleiros maiores é a opinião de
  uma busca rasa com avaliação heurística: um `blunder` é confiável (há uma sequência forçada
  dentro do horizonte), mas `good`/`inaccuracy` são só indicativos.
- A análise roda no Web Worker; um replay longo em tabuleiro grande leva alguns segundos
  (150 ms × número de lances, no pior caso).
- Não há variações anotadas nem comparação entre várias partidas.

## Teste

`tests/serialization.test.mjs` usa uma partida em que O ignora uma ameaça de vitória: o lance é
classificado como `blunder`, com o bloqueio como melhor alternativa. `tests/expansion.test.mjs`
cobre a análise pós-jogo: alternativas ordenadas e sem o lance jogado, nota de erro grave, navegação
pelos erros e funcionamento em Gravity e no hexagonal.
