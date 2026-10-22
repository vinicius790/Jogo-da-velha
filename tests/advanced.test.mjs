// Busca alpha-beta: correção da tabela de transposição e da tática nas folhas.
import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPosition } from '../src/core/ai/evaluate.js';
import { DECIDED_SCORE, alphaBeta, candidateMoves } from '../src/core/ai/minimax.js';
import { legalMoves } from '../src/core/engine/board.js';
import { GameEngine } from '../src/core/engine/game.js';
import { seededRng } from '../src/features/puzzles.js';

const NO_LIMIT = 60_000;

/** Posição alcançável após `plies` lances aleatórios (descarta partidas já encerradas). */
function randomPosition(config, plies, rng) {
  for (;;) {
    const game = new GameEngine({ mode: 'local', config });
    for (let i = 0; i < plies && game.state.status === 'playing'; i += 1) {
      const moves = legalMoves(game.state.board, config);
      game.play(moves[Math.floor(rng() * moves.length)]);
    }
    if (game.state.status === 'playing') return game.state;
  }
}

test('regressão: a tabela de transposição não altera o resultado da busca', () => {
  // Antes, valores obtidos com corte eram gravados como exatos e reutilizados; a busca com
  // tabela divergia da busca sem tabela. Agora as pontuações de todos os lances coincidem.
  const rng = seededRng(12345);
  const cases = [
    { config: { size: 3, winLength: 3, variant: 'classic' }, plies: 2, depth: 9 },
    { config: { size: 4, winLength: 3, variant: 'classic' }, plies: 3, depth: 4 },
    { config: { size: 4, winLength: 4, variant: 'misere' }, plies: 4, depth: 4 },
    { config: { size: 5, winLength: 4, variant: 'gravity' }, plies: 4, depth: 5 },
  ];
  for (const { config, plies, depth } of cases) {
    for (let i = 0; i < 6; i += 1) {
      const state = randomPosition(config, plies, rng);
      const options = { depth, timeBudgetMs: NO_LIMIT };
      const withTable = alphaBeta(state.board, config, state.current, options);
      const without = alphaBeta(state.board, config, state.current, {
        ...options,
        useTable: false,
      });
      const scores = (result) =>
        Object.fromEntries(
          result.candidates.map((candidate) => [candidate.index, candidate.score]),
        );
      assert.deepEqual(scores(withTable), scores(without), `${config.variant} ${state.board}`);
      assert.ok(withTable.nodes <= without.nodes, 'a tabela deve economizar nós, não gastar mais');
    }
  }
});

test('busca completa do 3×3 vazio dá empate exato', () => {
  const config = { size: 3, winLength: 3, variant: 'classic' };
  const result = alphaBeta(Array(9).fill(null), config, 'X', { depth: 9, timeBudgetMs: NO_LIMIT });
  assert.equal(result.score, 0);
  assert.equal(result.exact, true);
  assert.equal(result.depth, 9);
});

test('a folha enxerga a vitória imediata de quem tem a vez', () => {
  // X (a jogar) tem A1-B1 e completa em C1: mesmo com profundidade 1, o lance vencedor aparece.
  const config = { size: 5, winLength: 3, variant: 'classic' };
  const board = Array(25).fill(null);
  board[0] = 'X';
  board[1] = 'X';
  board[10] = 'O';
  board[20] = 'O';
  const result = alphaBeta(board, config, 'X', { depth: 1, timeBudgetMs: NO_LIMIT });
  assert.equal(result.move, 2);
  assert.ok(result.score >= DECIDED_SCORE);
});

test('ameaça dupla é reconhecida como vitória forçada', () => {
  const config = { size: 5, winLength: 4, variant: 'classic' };
  const board = Array(25).fill(null);
  // X: B2 C2 D2 (linha aberta nas duas pontas, A2 e E2) → duas casas vencedoras.
  [6, 7, 8].forEach((cell) => (board[cell] = 'X'));
  [20, 22, 24].forEach((cell) => (board[cell] = 'O'));
  const scan = scanPosition(board, config, 'X');
  assert.deepEqual([...scan.mine].sort(), [5, 9]);
  // Com O a jogar, O perde mesmo bloqueando uma ponta.
  const result = alphaBeta(board, config, 'O', { depth: 2, timeBudgetMs: NO_LIMIT });
  assert.ok(result.score <= -DECIDED_SCORE);
});

test('Gravity: casa vencedora "no ar" não conta como ameaça imediata', () => {
  const config = { size: 4, winLength: 3, variant: 'gravity' };
  const board = Array(16).fill(null);
  board[12] = 'X';
  board[13] = 'X'; // falta a casa 14 (no chão): jogável
  board[4] = 'O';
  board[5] = 'O'; // faltaria a casa 6, mas a 10 abaixo está vazia: não jogável
  board[8] = 'O';
  board[9] = 'X';
  const scan = scanPosition(board, config, 'X');
  assert.ok(scan.mine.has(14));
  assert.ok(!scan.theirs.has(6));
});

test('o orçamento de tempo interrompe a busca sem deixar de devolver um lance', () => {
  const config = { size: 8, winLength: 5, variant: 'classic' };
  const board = Array(64).fill(null);
  board[27] = 'X';
  board[28] = 'O';
  const started = performance.now();
  const result = alphaBeta(board, config, 'X', { depth: 20, timeBudgetMs: 80 });
  assert.ok(performance.now() - started < 1500);
  assert.equal(board[result.move], null);
  assert.ok(result.depth >= 1);
});

test('em tabuleiros grandes só entram lances próximos de alguma peça', () => {
  const config = { size: 12, winLength: 5, variant: 'classic' };
  const board = Array(144).fill(null);
  assert.equal(candidateMoves(board, config).length, 1, 'tabuleiro vazio: só o centro');
  board[0] = 'X';
  const moves = candidateMoves(board, config);
  assert.deepEqual(
    moves.sort((a, b) => a - b),
    [1, 12, 13],
  );
});
