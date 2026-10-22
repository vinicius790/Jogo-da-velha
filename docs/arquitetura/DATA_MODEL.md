# Modelo de dados

## Estado da partida (`GameEngine.state`)

```js
{
  id: 'game-<uuid>',
  mode: 'ai' | 'local' | 'online' | 'spectator',
  config: { size: 3..12, winLength: 3..size, variant: 'classic' | 'misere' | 'gravity' | 'hex' },
  difficulty: 'easy' | 'normal' | 'hard' | 'expert' | 'omega',
  starter: 'X' | 'O',
  current: 'X' | 'O',            // quem joga agora
  board: [null | 'X' | 'O'],     // size² casas, linha a linha
  status: 'playing' | 'won' | 'draw' | 'aborted',
  result: null | 'X' | 'O' | 'draw' | 'aborted',
  winningLine: null | [índices],
  endReason: null | 'timeout',   // 'timeout' = derrota no relógio de quem tinha a vez
  clock: null | { moveMs, gameMs, remaining: { X, O }, turnStartedAt },
  moves: [{ index, requestedIndex, mark, turn, at }],
  redo: [lances desfeitos],
  meta: null | { human?, tournamentId?, matchId? },
  createdAt, updatedAt
}
```

- Em Gravity, `requestedIndex` é a casa clicada e `index` é a casa onde a peça pousou.
- Em Misère, `result` é o adversário de quem completou a linha.
- Em Hexagonal, `board` continua sendo uma lista linha a linha; a casa `(linha, coluna)` é o
  hexágono de coordenadas axiais `r = linha`, `q = coluna`. As linhas de vitória seguem só três
  direções: `(0, +1)`, `(+1, 0)` e `(+1, -1)` (ver `HEX_DIRECTIONS`).
- `clock` (`src/core/engine/clock.js`): `moveMs`/`gameMs` são os limites (0 = desligado),
  `remaining` é o saldo de cada lado e `turnStartedAt` o instante em que o lance atual começou.
  Ao retomar uma partida salva, `turnStartedAt` é reiniciado. Com `endReason: 'timeout'` o
  histórico ainda está "em jogo", `status` é `won`, `result` é o adversário de quem tinha a
  vez e `winningLine` é `null`; o validador confere exatamente isso.
- `meta.human` é o símbolo do jogador humano no modo `ai`; `tournamentId`/`matchId` ligam a
  partida a um confronto de torneio.

## Perfil (`src/state/profile.js`)

```js
{
  name, rating /* Elo */, xp, played, wins, losses, draws, streak, bestStreak,
  glicko: { rating, deviation, volatility },
  achievements: [ids],
  ranking: { '<tamanho>-<variante>': { played, wins, draws, losses, rating, streak, bestStreak,
             top: [{ name, moves, durationMs, difficulty, at }] } },  // até 5 em `top`
  history: [{ id, finishedAt, mode, difficulty, config, result, player, outcome,
              rated, moves, endReason /* null | 'timeout' */, ratingDelta, notation,
              durationMs }],  // até 100 entradas
  settings: { theme: 'dark'|'light', sound, language: 'pt-BR'|'en'|'es', motion: 'full'|'reduced' }
}
```

`defaultProfile()` e `sanitizeProfile()` são a única definição; qualquer perfil lido de fora passa
por `sanitizeProfile`, que limita faixas, descarta campos desconhecidos e conquistas inexistentes.

## Torneio (`src/features/tournaments.js`)

```js
{ id, name, config, players: ['human', 'easy', ...], createdAt,
  matches: [{ id, x, o, status: 'pending' | 'done', winner: null | 'draw' | <jogador> }] }
```

## Chaves de armazenamento (`src/state/store.js`)

| Chave         | Conteúdo                                  |
| ------------- | ----------------------------------------- |
| `profile`     | perfil                                    |
| `active-game` | partida em andamento (modos `ai`/`local`) |
| `replays`     | até 200 replays                           |
| `tournaments` | até 20 torneios                           |
| `puzzles`     | ids dos puzzles resolvidos (até 500)      |

No IndexedDB ficam no banco `omega-ttt`, armazém `kv`; no localStorage, com o prefixo `omega-ttt:`.
