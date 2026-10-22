import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyBoard } from '../src/core/engine/board.js';
import { findWinningLine, winner } from '../src/core/engine/win.js';

function boardWith(config, cells, mark) {
  const board = emptyBoard(config);
  for (const cell of cells) board[cell] = mark;
  return board;
}

test('vitória na horizontal', () => {
  const config = { size: 3, winLength: 3 };
  assert.deepEqual(findWinningLine(boardWith(config, [0, 1, 2], 'X'), 2, 'X', config), [0, 1, 2]);
});

test('vitória na vertical e nas duas diagonais', () => {
  const config = { size: 4, winLength: 3 };
  assert.deepEqual(findWinningLine(boardWith(config, [1, 5, 9], 'O'), 5, 'O', config), [1, 5, 9]);
  assert.deepEqual(
    findWinningLine(boardWith(config, [0, 5, 10], 'O'), 10, 'O', config),
    [0, 5, 10],
  );
  assert.deepEqual(findWinningLine(boardWith(config, [2, 5, 8], 'O'), 8, 'O', config), [2, 5, 8]);
});

test('linha não atravessa a borda do tabuleiro', () => {
  const config = { size: 4, winLength: 3 };
  // 2, 3 e 4 são vizinhos no vetor, mas 3 e 4 estão em linhas diferentes.
  assert.equal(findWinningLine(boardWith(config, [2, 3, 4], 'X'), 3, 'X', config), null);
});

test('em linha maior que o necessário, o segmento devolvido contém o último lance', () => {
  const config = { size: 5, winLength: 3 };
  const line = findWinningLine(boardWith(config, [0, 1, 2, 3], 'X'), 3, 'X', config);
  assert.equal(line.length, 3);
  assert.ok(line.includes(3));
});

test('winner varre o tabuleiro inteiro', () => {
  const config = { size: 3, winLength: 3 };
  assert.equal(winner(emptyBoard(config), config), null);
  assert.equal(winner(boardWith(config, [2, 4, 6], 'O'), config).mark, 'O');
});
