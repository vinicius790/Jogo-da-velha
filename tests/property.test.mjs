// Testes por propriedade: partidas aleatórias em todas as variantes mantêm os invariantes.
import assert from 'node:assert/strict';
import test from 'node:test';
import { legalMoves } from '../src/core/engine/board.js';
import { GameEngine } from '../src/core/engine/game.js';
import { validateSnapshot } from '../src/core/engine/validator.js';
import { makeReplay, validateReplay } from '../src/features/replay.js';
import { seededRng } from '../src/features/puzzles.js';

for (const variant of ['classic', 'misere', 'gravity']) {
  test(`propriedade (${variant}): partidas aleatórias nunca violam as regras`, () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const rng = seededRng(seed);
      const config = { size: 3 + (seed % 4), winLength: 3, variant };
      const game = new GameEngine({ mode: 'local', config });
      const seen = new Set();
      while (game.state.status === 'playing') {
        const before = game.state;
        const moves = legalMoves(before.board, config);
        assert.ok(moves.length > 0, 'partida em andamento sempre tem lance legal');
        const next = game.play(moves[Math.floor(rng() * moves.length)]);
        const move = next.moves.at(-1);

        assert.ok(!seen.has(move.index), 'nenhuma casa é jogada duas vezes');
        seen.add(move.index);
        assert.equal(next.board[move.index], move.mark);
        assert.equal(move.mark, before.current);
        assert.equal(next.board.filter(Boolean).length, next.moves.length);
        if (variant === 'gravity') {
          for (
            let below = move.index + config.size;
            below < next.board.length;
            below += config.size
          ) {
            assert.ok(next.board[below], 'em Gravity não há casa vazia abaixo de uma peça');
          }
        }
      }
      const end = game.state;
      assert.ok(['won', 'draw'].includes(end.status));
      assert.equal(validateSnapshot(end), true, 'o estado final passa na própria validação');
      assert.equal(validateReplay(makeReplay(end)), true);
      if (end.status === 'won') {
        const lineMark = end.board[end.winningLine[0]];
        assert.ok(end.winningLine.every((cell) => end.board[cell] === lineMark));
        assert.equal(end.result === lineMark, variant !== 'misere');
      }
    }
  });
}

test('propriedade: desfazer tudo e refazer tudo devolve exatamente o mesmo estado', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const rng = seededRng(seed * 31);
    const config = { size: 4, winLength: 3, variant: seed % 2 ? 'gravity' : 'classic' };
    const game = new GameEngine({ mode: 'local', config });
    for (let i = 0; i < 6 && game.state.status === 'playing'; i += 1) {
      const moves = legalMoves(game.state.board, config);
      game.play(moves[Math.floor(rng() * moves.length)]);
    }
    const reference = game.state;
    for (let i = 0; i < reference.moves.length; i += 1) game.undo();
    assert.ok(game.state.board.every((cell) => cell === null));
    for (let i = 0; i < reference.moves.length; i += 1) game.redoMove();
    const again = game.state;
    assert.deepEqual(again.board, reference.board);
    assert.equal(again.status, reference.status);
    assert.equal(again.current, reference.current);
    assert.deepEqual(
      again.moves.map((move) => move.index),
      reference.moves.map((move) => move.index),
    );
  }
});
