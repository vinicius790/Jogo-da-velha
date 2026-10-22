import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from '../src/core/engine/game.js';
import {
  closeLocalMatch,
  createLocalMatch,
  markOwners,
  recordLocalMatchGame,
  sanitizeLocalMatch,
} from '../src/features/local-match.js';

const CONFIG = { size: 3, winLength: 3, variant: 'classic' };

function finished(moves, options = {}) {
  const game = new GameEngine({ mode: 'local', config: options.config ?? CONFIG });
  for (const index of moves) game.play(index);
  return game.state;
}

function match(options = {}) {
  return createLocalMatch({
    players: ['Ana', 'Bia'],
    config: CONFIG,
    bestOf: 3,
    id: 'match-test',
    createdAt: 100,
    ...options,
  });
}

test('local match cleans names and retains a validated variant and clock', () => {
  const value = match({
    players: ['  Ana\nSilva  ', 'Bia\u0000'],
    config: { size: 5, winLength: 4, variant: 'hex' },
    bestOf: 5,
    clock: { moveMs: 10_000, gameMs: 300_000 },
  });
  assert.deepEqual(value.players, ['Ana Silva', 'Bia']);
  assert.deepEqual(value.config, { size: 5, winLength: 4, variant: 'hex' });
  assert.deepEqual(value.clock, { moveMs: 10_000, gameMs: 300_000 });
  assert.equal(value.bestOf, 5);
  assert.equal(value.targetWins, 3);
});

test('local match rotates who owns X for every completed game, including a draw', () => {
  const first = match();
  assert.deepEqual(markOwners(first), { x: 0, o: 1, nextX: 0 });
  const afterDraw = recordLocalMatchGame(first, finished([0, 1, 2, 4, 3, 5, 7, 6, 8]));
  assert.equal(afterDraw.draws, 1);
  assert.equal(afterDraw.wins[0] + afterDraw.wins[1], 0);
  assert.deepEqual(markOwners(afterDraw), { x: 1, o: 0, nextX: 1 });
  const afterWin = recordLocalMatchGame(afterDraw, finished([0, 3, 1, 4, 2]));
  assert.deepEqual(afterWin.wins, [0, 1]);
  assert.equal(afterWin.gamesPlayed, 2);
});

test('best-of-three ends when one player reaches two wins and keeps a short round log', () => {
  let value = match();
  value = recordLocalMatchGame(value, finished([0, 3, 1, 4, 8, 5])); // O wins; Bia owns O.
  assert.deepEqual(value.wins, [0, 1]);
  value = recordLocalMatchGame(value, finished([0, 3, 1, 4, 2])); // X belongs to Bia in game 2.
  assert.deepEqual(value.wins, [0, 2]);
  assert.equal(value.status, 'completed');
  assert.equal(value.recent.length, 2);
  assert.equal(value.recent[0].winner, 1);
  assert.equal(value.recent[1].xPlayer, 1);
  assert.equal(value.targetWins, 2);
});

test('completed game ids are idempotent and inputs are not mutated', () => {
  const initial = match();
  const game = finished([0, 3, 1, 4, 2]);
  const next = recordLocalMatchGame(initial, game);
  assert.deepEqual(initial.wins, [0, 0]);
  assert.deepEqual(recordLocalMatchGame(next, game), next);
});

test('draws do not award points; a later win still completes the series', () => {
  const value = match({ bestOf: 5 });
  const draw = recordLocalMatchGame(value, finished([0, 1, 2, 4, 3, 5, 7, 6, 8]));
  assert.equal(draw.status, 'active');
  assert.equal(draw.wins[0], 0);
  assert.equal(draw.wins[1], 0);
  assert.equal(draw.draws, 1);
});

test('a timeout before the first move is still a valid series result', () => {
  const game = new GameEngine({ mode: 'local', config: CONFIG, clock: { moveMs: 5000 } });
  const timeout = game.timeout(5001);
  const result = recordLocalMatchGame(match(), timeout);
  assert.deepEqual(result.wins, [0, 1]);
  assert.equal(result.recent[0].moveCount, 0);
  assert.equal(result.recent[0].endReason, 'timeout');
  assert.equal(sanitizeLocalMatch(result).status, 'active');
});
test('invalid formats, configs, unfinished games, foreign modes and duplicate counts are rejected', () => {
  assert.throws(() => match({ bestOf: 4 }), /formato/i);
  assert.throws(() => match({ config: { size: 2, winLength: 3, variant: 'classic' } }));
  assert.throws(() => recordLocalMatchGame(match(), new GameEngine({ mode: 'local', config: CONFIG }).state));
  assert.throws(() => recordLocalMatchGame(match(), finished([0, 3, 1, 4, 2], {
    config: { size: 4, winLength: 3, variant: 'classic' },
  })), /configuração/i);
  const online = { ...finished([0, 3, 1, 4, 2]), mode: 'online' };
  assert.throws(() => recordLocalMatchGame(match(), online), /local/i);
  assert.equal(sanitizeLocalMatch({ ...match(), wins: [1, 0], gamesPlayed: 0 }), null);
});

test('stored data is sanitized and closing an active match cannot change a completed result', () => {
  const initial = match();
  assert.equal(sanitizeLocalMatch({ ...initial, players: ['A'.repeat(100), 'B'] }).players[0].length, 32);
  assert.equal(sanitizeLocalMatch({ ...initial, recent: [{ winner: 7 }] }), null);
  const abandoned = closeLocalMatch(initial);
  assert.equal(abandoned.status, 'abandoned');
  const complete = recordLocalMatchGame(
    recordLocalMatchGame(initial, finished([0, 3, 1, 4, 8, 5])),
    finished([0, 3, 1, 4, 2], { config: CONFIG }),
  );
  assert.equal(closeLocalMatch(complete).status, 'completed');
});