import { full, legalMoves, opponent } from '../engine/board.js';
import { findWinningLine, winner } from '../engine/win.js';

const CONFIG = Object.freeze({ size: 3, winLength: 3, variant: 'classic' });
const memo = new Map();

/**
 * Resolve a posição para o jogador da vez.
 * outcome: 1 vitória, 0 empate, -1 derrota; distance: lances até o fim com jogo perfeito;
 * moves: todos os lances ótimos (vitória mais rápida, derrota mais lenta, qualquer empate).
 */
function solve(board, player) {
  const key = `${board.map((v) => v ?? '.').join('')}${player}`;
  const cached = memo.get(key);
  if (cached) return cached;

  let result;
  const done = winner(board, CONFIG);
  if (done) {
    result = { outcome: done.mark === player ? 1 : -1, distance: 0, move: null, moves: [] };
  } else if (full(board)) {
    result = { outcome: 0, distance: 0, move: null, moves: [] };
  } else {
    let best = null;
    let moves = [];
    for (const move of legalMoves(board, CONFIG)) {
      const next = board.slice();
      next[move] = player;
      let candidate;
      if (findWinningLine(next, move, player, CONFIG)) {
        candidate = { outcome: 1, distance: 1 };
      } else {
        const child = solve(next, opponent(player));
        candidate = { outcome: 0 - child.outcome, distance: child.distance + 1 };
      }
      const order = compare(candidate, best);
      if (order > 0) {
        best = candidate;
        moves = [move];
      } else if (order === 0) {
        moves.push(move);
      }
    }
    result = { ...best, move: moves[0], moves };
  }
  memo.set(key, result);
  return result;
}

function compare(candidate, best) {
  if (!best) return 1;
  if (candidate.outcome !== best.outcome) return candidate.outcome - best.outcome;
  if (candidate.outcome > 0) return best.distance - candidate.distance;
  if (candidate.outcome < 0) return candidate.distance - best.distance;
  return 0;
}

/** Consulta a solução exata do 3×3 clássico; devolve null se a entrada não for um tabuleiro válido. */
export function probe3x3(board, player) {
  const validBoard =
    Array.isArray(board) &&
    board.length === 9 &&
    board.every((value) => value === null || value === 'X' || value === 'O');
  if (!validBoard || (player !== 'X' && player !== 'O')) return null;
  return solve(board, player);
}
