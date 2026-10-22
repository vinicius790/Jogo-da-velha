// A API pública (src/index.js) funciona sem DOM e expõe o que o README documenta.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as omega from '../src/index.js';
import { compareEngines } from '../src/features/engine-lab.js';

test('exportações documentadas existem', () => {
  const expected = [
    'VERSION',
    'GameEngine',
    'chooseMove',
    'alphaBeta',
    'mcts',
    'analyzePosition',
    'encodeState',
    'decodeState',
    'createBackup',
    'encryptBackup',
    'makeReplay',
    'generatePuzzle',
    'updateGlicko2',
    'createGame',
    'suggestMove',
    'share',
    'restore',
  ];
  for (const name of expected) assert.ok(name in omega, name);
});

test('fachada: criar, sugerir lance, analisar, compartilhar e restaurar', () => {
  const game = omega.createGame({ mode: 'local' });
  game.play(0);
  game.play(4);
  const verdict = omega.suggestMove(game, 'expert');
  assert.equal(game.state.board[verdict.move], null);
  const analysis = omega.analyze(game);
  assert.equal(analysis.free, 7);
  assert.equal(analysis.exact.outcome, 0);
  const copy = omega.restore(omega.share(game));
  assert.deepEqual(copy.state, game.state);
});

test('uma partida inteira IA × IA pela API pública termina em resultado válido', () => {
  const game = new omega.GameEngine({ mode: 'spectator', config: { size: 4, winLength: 4 } });
  let state = game.state;
  while (state.status === 'playing') {
    const { move } = omega.chooseMove({
      board: state.board,
      config: state.config,
      player: state.current,
      difficulty: 'normal',
    });
    state = game.play(move);
  }
  assert.ok(['won', 'draw'].includes(state.status));
  assert.equal(omega.validateSnapshot(state), true);
});

test('laboratório de motores: um resultado medido por nível', () => {
  const config = { size: 3, winLength: 3, variant: 'classic' };
  const board = ['X', null, null, null, 'O', null, null, null, null];
  const report = compareEngines({ board, config, player: 'X', rng: () => 0.99 });
  assert.equal(report.total, omega.DIFFICULTY_LEVELS.length);
  assert.deepEqual(
    report.results.map((result) => result.difficulty),
    omega.DIFFICULTY_LEVELS,
  );
  for (const result of report.results) {
    assert.equal(board[result.move], null);
    assert.ok(result.elapsedMs >= 0);
    assert.ok(typeof result.algorithm === 'string');
  }
  assert.ok(report.consensusVotes >= 1 && report.consensusVotes <= report.total);
});
