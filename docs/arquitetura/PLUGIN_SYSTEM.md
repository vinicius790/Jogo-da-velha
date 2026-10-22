# Pontos de extensão

**Não existe um sistema de plugins.** Não há carregamento dinâmico de módulos nem API de registro.
Estender o projeto é editar o código; este documento indica onde.

## Novo nível de IA

1. Acrescente a entrada em `DIFFICULTY` (`src/core/constants.js`) com `depth`, `timeBudgetMs`,
   `blunder`, `tablebase` e `mctsBudgetMs`, e o rating nominal em `AI_RATING`.
2. Adicione `level.<nome>` nos três dicionários (`src/services/locales/`).
3. Adicione a `<option>` em `#difficulty` no `index.html`.

O teste de `tests/ai.test.mjs` exige que profundidade cresça e erro deliberado não cresça na ordem
da lista.

## Nova variante de regra

Os pontos que conhecem a variante:

- `src/core/engine/board.js` — `legalMoves` e `resolveMoveIndex` (onde a peça cai);
- `src/core/engine/game.js` e `validator.js` — quem vence quando uma linha se completa;
- `src/core/ai/minimax.js` e `evaluate.js` — sinal da avaliação e tática imediata;
- `src/core/ai/monte-carlo.js` — política das simulações;
- `VARIANTS` em `constants.js`, dicionários e `<option>` em `#variant`.

## Novo algoritmo de busca

`chooseMove` (`src/core/ai/engine.js`) decide qual busca usar. Uma busca nova precisa devolver
`{ move, score, candidates, depth, nodes, elapsedMs, exact }` e nunca devolver casa ocupada.

## Nova tarefa no Web Worker

Acrescente a função em `src/workers/tasks.js`; ela fica disponível por
`runTask('<nome>', payload)` e também no modo sem Worker.

## Novo idioma

Veja [INTERNATIONALIZATION.md](../produto/INTERNATIONALIZATION.md).
