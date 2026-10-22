import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMove,
  emptyBoard,
  isClassic3x3,
  legalMoves,
  resolveMoveIndex,
} from '../src/core/engine/board.js';
import { cellToCoordinate, coordinateToCell } from '../src/core/notation.js';

const classic = { size: 3, winLength: 3, variant: 'classic' };

test('tabuleiro vazio tem size² casas', () => {
  assert.equal(emptyBoard(classic).length, 9);
  assert.equal(emptyBoard({ size: 12, winLength: 5 }).length, 144);
});

test('applyMove não altera o tabuleiro original', () => {
  const board = emptyBoard(classic);
  const next = applyMove(board, 4, 'X', classic);
  assert.equal(board[4], null);
  assert.equal(next[4], 'X');
});

test('lance em casa ocupada ou fora do tabuleiro é rejeitado com código', () => {
  const board = applyMove(emptyBoard(classic), 4, 'X', classic);
  assert.throws(() => applyMove(board, 4, 'O', classic), { code: 'occupied' });
  assert.throws(() => applyMove(board, 9, 'O', classic), { code: 'invalid-index' });
  assert.throws(() => applyMove(board, 1.5, 'O', classic), { code: 'invalid-index' });
});

test('legalMoves lista todas as casas vazias na variante clássica', () => {
  assert.equal(legalMoves(emptyBoard({ size: 4, winLength: 3 }), { size: 4 }).length, 16);
});

test('Gravity: só a casa livre mais baixa de cada coluna é jogável', () => {
  const config = { size: 4, winLength: 3, variant: 'gravity' };
  const board = emptyBoard(config);
  board[12] = 'X';
  assert.deepEqual(legalMoves(board, config), [8, 13, 14, 15]);
  assert.equal(resolveMoveIndex(board, 0, config), 8);
  assert.deepEqual(legalMoves(Array(16).fill('X'), config), []);
  assert.throws(() => resolveMoveIndex(Array(16).fill('X'), 0, config), { code: 'column-full' });
});

test('isClassic3x3 só reconhece o jogo da velha tradicional', () => {
  assert.equal(isClassic3x3({ size: 3, winLength: 3 }), true);
  assert.equal(isClassic3x3({ size: 3, winLength: 3, variant: 'misere' }), false);
  assert.equal(isClassic3x3({ size: 4, winLength: 3, variant: 'classic' }), false);
});

test('coordenadas vão e voltam em todos os tamanhos', () => {
  for (const size of [3, 5, 12]) {
    for (let index = 0; index < size * size; index += 1) {
      assert.equal(coordinateToCell(cellToCoordinate(index, size), size), index);
    }
  }
  assert.equal(cellToCoordinate(0, 3), 'A1');
  assert.equal(cellToCoordinate(5, 3), 'C2');
  assert.throws(() => coordinateToCell('D1', 3), { code: 'bad-notation' });
});
