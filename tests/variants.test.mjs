import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseMove } from '../src/core/ai/engine.js';
import { legalMoves } from '../src/core/engine/board.js';
import { GameEngine } from '../src/core/engine/game.js';

test('Gravity: a peça cai até o fundo da coluna', () => {
  const game = new GameEngine({ config: { size: 4, winLength: 3, variant: 'gravity' } });
  const state = game.play(0);
  assert.equal(state.board[12], 'X');
  assert.equal(state.moves[0].index, 12);
  assert.equal(state.moves[0].requestedIndex, 0);
});

test('Gravity: vitória vertical é detectada na casa de pouso', () => {
  const game = new GameEngine({
    mode: 'local',
    config: { size: 4, winLength: 3, variant: 'gravity' },
  });
  for (const move of [0, 1, 0, 1, 0]) game.play(move);
  assert.equal(game.state.status, 'won');
  assert.equal(game.state.result, 'X');
  assert.deepEqual(game.state.winningLine, [4, 8, 12]);
});

test('Gravity: desfazer e refazer respeitam a casa de pouso', () => {
  const game = new GameEngine({
    mode: 'local',
    config: { size: 4, winLength: 3, variant: 'gravity' },
  });
  game.play(0);
  game.play(0);
  game.undo();
  assert.equal(game.state.board[8], null);
  assert.equal(game.redoMove().board[8], 'O');
});

test('Misère: quem completa a linha perde', () => {
  const game = new GameEngine({ config: { size: 3, winLength: 3, variant: 'misere' } });
  for (const move of [0, 3, 1, 4, 2]) game.play(move);
  assert.equal(game.state.status, 'won');
  assert.equal(game.state.result, 'O');
});

test('IA em Gravity só escolhe casas de pouso', () => {
  const config = { size: 4, winLength: 3, variant: 'gravity' };
  const board = Array(16).fill(null);
  const verdict = chooseMove({ board, config, player: 'X', difficulty: 'hard' });
  assert.ok(legalMoves(board, config).includes(verdict.move));
});

test('IA em Misère não completa a própria linha quando há alternativa', () => {
  const config = { size: 3, winLength: 3, variant: 'misere' };
  const board = ['X', 'X', null, 'O', 'O', null, null, null, null];
  for (const difficulty of ['hard', 'expert', 'omega']) {
    const verdict = chooseMove({ board, config, player: 'X', difficulty, rng: () => 0.99 });
    assert.notEqual(verdict.move, 2, difficulty);
  }
});
