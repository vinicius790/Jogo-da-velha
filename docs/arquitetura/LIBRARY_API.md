# API do motor (`src/index.js`)

`src/index.js` reexporta as partes sem DOM. Funciona em Node 22+ e em qualquer front-end.
O pacote é `private` (não é publicado no npm); para usar em outro projeto, copie `src/` ou aponte
para o repositório.

## Exportações

| Nome                                                                                    | O que é                                                                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `VERSION`                                                                               | versão lida do `package.json`                                                                                       |
| `GameEngine`                                                                            | motor de regras (`play`, `undo`, `redoMove`, `reset`, `abort`, `timeout`, `checkClock`, `state`, `GameEngine.from`) |
| `validateConfig`, `validateSnapshot`                                                    | validação de configuração e de estado vindo de fora                                                                 |
| `chooseMove({ board, config, player, difficulty, rng })`                                | lance da IA para o nível pedido                                                                                     |
| `alphaBeta`, `mcts`, `probe3x3`                                                         | algoritmos de busca usados por `chooseMove`                                                                         |
| `analyzePosition`, `gradeReplay`                                                        | leitura da posição e classificação de lances                                                                        |
| `reviewGame`, `nextMistake`                                                             | análise pós-jogo: alternativas por posição e navegação pelos erros                                                  |
| `createClock`, `timeLeft`, `isFlagged`, `clockView`                                     | relógio (o `GameEngine` aceita `clock: { moveMs, gameMs }`)                                                         |
| `rankingKey`, `recordRanking`, `rankingRows`                                            | ranking local por tamanho de tabuleiro e variante                                                                   |
| `encodeState`, `decodeState`                                                            | código de compartilhamento                                                                                          |
| `createBackup`, `verifyBackup`, `encryptBackup`, `decryptBackup`                        | backups                                                                                                             |
| `cellToCoordinate`, `coordinateToCell`, `encodeMoves`, `decodeMoves`, `notationForGame` | notação `XA1-OB2-…`                                                                                                 |
| `makeReplay`, `replayFrame`, `validateReplay`                                           | replays                                                                                                             |
| `generatePuzzle`, `validatePuzzle`                                                      | puzzles                                                                                                             |
| `playArena`, `compareEngines`                                                           | simulação IA × IA e comparação de níveis                                                                            |
| `updateGlicko2`, `expectedGlicko`                                                       | Glicko-2                                                                                                            |
| `createGame`, `suggestMove`, `analyze`, `share`, `restore`                              | atalhos (`src/core/public-api.js`)                                                                                  |
| `DIFFICULTY`, `DIFFICULTY_LEVELS`, `VARIANTS`, `OmegaError`                             | constantes e classe de erro                                                                                         |

## Exemplo

```js
import { GameEngine, chooseMove, encodeState } from './src/index.js';

const game = new GameEngine({
  mode: 'local',
  config: { size: 4, winLength: 4, variant: 'gravity' },
});
let state = game.play(0); // em Gravity, qualquer casa da coluna: a peça cai

while (state.status === 'playing') {
  const { move } = chooseMove({
    board: state.board,
    config: state.config,
    player: state.current,
    difficulty: 'hard',
  });
  state = game.play(move);
}
console.log(state.result, encodeState(state));
```

## Contratos

- `chooseMove` devolve `{ move, score, algorithm, depth, nodes, iterations, elapsedMs, exact,
candidates, reasons }`. `move` é `-1` quando não há lance legal. `reasons` são chaves de
  tradução (com parâmetros), não texto.
- `rng` é uma função que devolve um número em `[0, 1)`; passe um gerador com semente para
  resultados reproduzíveis nos níveis com erro deliberado e no MCTS. A busca tem orçamento de
  tempo, então em tabuleiros grandes a profundidade alcançada depende da máquina.
- `GameEngine.from(snapshot)` e `decodeState` + `GameEngine.from` lançam `OmegaError` se o estado
  for inconsistente.
