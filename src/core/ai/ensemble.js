import { mcts } from './mcts.js';
import { DECIDED_SCORE, alphaBeta } from './minimax.js';

const MAX_POOL = 6;

/**
 * Busca híbrida do nível OMEGA.
 * 1. Alpha-beta resolve a tática e ordena os lances.
 * 2. Se o resultado não está decidido e há mais de um lance praticamente empatado no topo,
 *    o MCTS desempata entre eles com simulações (a avaliação estática não os distingue).
 */
export function hybridMove(
  board,
  config,
  player,
  { depth = 8, timeBudgetMs = 700, mctsBudgetMs = 400, rng = Math.random } = {},
) {
  const search = alphaBeta(board, config, player, { depth, timeBudgetMs });
  const base = { ...search, algorithm: 'alpha-beta', iterations: 0 };
  if (search.exact || Math.abs(search.score) >= DECIDED_SCORE || search.candidates.length < 2) {
    return base;
  }

  const best = search.candidates[0].score;
  const margin = Math.max(4, Math.abs(best) * 0.15);
  const pool = search.candidates
    .filter((candidate) => candidate.score >= best - margin)
    .slice(0, MAX_POOL)
    .map((candidate) => candidate.index);
  if (pool.length < 2) return base;

  const tree = mcts(board, config, player, { rootMoves: pool, timeBudgetMs: mctsBudgetMs, rng });
  if (tree.move < 0) return base;
  return {
    ...search,
    move: tree.move,
    algorithm: 'alpha-beta+mcts',
    iterations: tree.iterations,
    nodes: search.nodes + tree.nodes,
    elapsedMs: search.elapsedMs + tree.elapsedMs,
    pool: tree.candidates,
  };
}
