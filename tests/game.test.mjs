import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from '../src/core/engine/game.js';

test('os turnos alternam', () => {
  const game = new GameEngine();
  game.play(0);
  assert.equal(game.state.current, 'O');
  game.play(1);
  assert.equal(game.state.current, 'X');
});

test('vitória encerra a partida e bloqueia novos lances', () => {
  const game = new GameEngine();
  for (const move of [0, 3, 1, 4, 2]) game.play(move);
  const state = game.state;
  assert.equal(state.status, 'won');
  assert.equal(state.result, 'X');
  assert.deepEqual(state.winningLine, [0, 1, 2]);
  assert.throws(() => game.play(8), { code: 'game-over' });
});

test('tabuleiro cheio sem linha é empate', () => {
  const game = new GameEngine();
  for (const move of [0, 1, 2, 4, 3, 5, 7, 6, 8]) game.play(move);
  assert.equal(game.state.status, 'draw');
  assert.equal(game.state.result, 'draw');
});

test('regressão: refazer funciona para vários lances desfeitos em sequência', () => {
  const game = new GameEngine({ mode: 'local' });
  for (const move of [0, 4, 8]) game.play(move);
  game.undo();
  game.undo();
  game.undo();
  assert.equal(game.state.moves.length, 0);
  assert.equal(game.state.redo.length, 3);

  game.redoMove();
  game.redoMove();
  const state = game.redoMove();
  assert.deepEqual(
    state.moves.map((move) => move.index),
    [0, 4, 8],
  );
  assert.equal(state.redo.length, 0);
  assert.equal(state.current, 'O');
});

test('um lance novo depois de desfazer descarta a pilha de refazer', () => {
  const game = new GameEngine({ mode: 'local' });
  game.play(0);
  game.play(4);
  game.undo();
  game.play(8);
  assert.equal(game.state.redo.length, 0);
  assert.equal(game.redoMove().moves.length, 2);
});

test('desfazer reabre uma partida terminada', () => {
  const game = new GameEngine({ mode: 'local' });
  for (const move of [0, 3, 1, 4, 2]) game.play(move);
  const state = game.undo();
  assert.equal(state.status, 'playing');
  assert.equal(state.result, null);
  assert.equal(state.winningLine, null);
  assert.equal(state.current, 'X');
});

test('regressão: reset() realmente zera o estado do motor', () => {
  const game = new GameEngine({ mode: 'local', config: { size: 4, winLength: 3 }, starter: 'O' });
  const firstId = game.state.id;
  game.play(0);
  game.play(1);
  const returned = game.reset();
  const state = game.state;
  assert.deepEqual(returned, state);
  assert.equal(state.moves.length, 0);
  assert.ok(state.board.every((cell) => cell === null));
  assert.equal(state.current, 'O');
  assert.equal(state.config.size, 4);
  assert.equal(state.mode, 'local');
  assert.notEqual(state.id, firstId);
});

test('state devolve cópias: alterar o retorno não altera o motor', () => {
  const game = new GameEngine();
  game.state.board[0] = 'X';
  assert.equal(game.state.board[0], null);
});

test('configuração inválida é recusada', () => {
  assert.throws(() => new GameEngine({ config: { size: 2, winLength: 3 } }), {
    code: 'invalid-config',
  });
  assert.throws(() => new GameEngine({ config: { size: 3, winLength: 4 } }), {
    code: 'invalid-config',
  });
  assert.throws(() => new GameEngine({ config: { size: 3, winLength: 3, variant: 'x' } }), {
    code: 'invalid-config',
  });
});

test('meta guarda só campos conhecidos', () => {
  const game = new GameEngine({ meta: { human: 'O', tournamentId: 't1', evil: '<script>' } });
  assert.deepEqual(game.state.meta, { human: 'O', tournamentId: 't1' });
});
