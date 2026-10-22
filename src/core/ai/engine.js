import { DIFFICULTY, DIFFICULTY_ALIASES } from '../constants.js';
import { isClassic3x3, legalMoves } from '../engine/board.js';
import { hybridMove } from './ensemble.js';
import { tacticalSummary } from './evaluate.js';
import { WIN_SCORE, alphaBeta } from './minimax.js';
import { probe3x3 } from './tablebase3x3.js';

function verdict(fields) {
  return {
    move: -1,
    score: 0,
    algorithm: 'none',
    depth: 0,
    nodes: 0,
    iterations: 0,
    elapsedMs: 0,
    exact: false,
    candidates: [],
    reasons: [],
    ...fields,
  };
}

/**
 * Escolhe o lance da IA.
 *
 * Ordem de decisão (igual em todos os tabuleiros e variantes):
 * 1. Erro deliberado: com probabilidade `blunder` do nível, joga um lance legal aleatório.
 * 2. Tática de um lance (exceto Misère): vence se puder, senão bloqueia a ameaça imediata.
 * 3. 3×3 clássico nos níveis com `tablebase`: solução exata.
 * 4. Busca: alpha-beta com a profundidade/tempo do nível; no OMEGA, híbrido alpha-beta + MCTS.
 *
 * `reasons` traz chaves de i18n (e parâmetros) em vez de texto, para a interface traduzir.
 */
export function chooseMove({ board, config, player, difficulty = 'normal', rng = Math.random }) {
  const started = performance.now();
  const normalizedKey =
    typeof difficulty === 'string'
      ? (DIFFICULTY_ALIASES[difficulty.toLowerCase()] ?? difficulty)
      : difficulty;
  const level = DIFFICULTY[normalizedKey] ?? DIFFICULTY.normal;
  const moves = legalMoves(board, config);
  if (!moves.length) return verdict({ reasons: [{ key: 'reason.noMoves' }] });

  const finish = (fields) => verdict({ ...fields, elapsedMs: performance.now() - started });

  if (level.blunder > 0 && rng() < level.blunder) {
    return finish({
      move: moves[Math.floor(rng() * moves.length)],
      algorithm: 'random',
      reasons: [{ key: 'reason.blunder' }],
    });
  }

  if (config.variant !== 'misere') {
    const tactical = tacticalSummary(board, config, player);
    if (tactical.winning.length) {
      return finish({
        move: tactical.winning[0],
        score: WIN_SCORE,
        algorithm: 'tactical',
        exact: true,
        candidates: tactical.winning.map((index) => ({ index, score: WIN_SCORE })),
        reasons: [{ key: 'reason.immediateWin' }],
      });
    }
    if (tactical.blocks.length) {
      return finish({
        move: tactical.blocks[0],
        algorithm: 'tactical',
        candidates: tactical.blocks.map((index) => ({ index, score: 0 })),
        reasons: [{ key: 'reason.block' }],
      });
    }
  }

  const solved = level.tablebase && isClassic3x3(config) ? probe3x3(board, player) : null;
  if (solved?.moves.length) {
    return finish({
      move: solved.moves[Math.floor(rng() * solved.moves.length)],
      score: solved.outcome,
      algorithm: 'tablebase',
      depth: solved.distance,
      exact: true,
      candidates: solved.moves.map((index) => ({ index, score: solved.outcome })),
      reasons: [{ key: 'reason.tablebaseMove' }],
    });
  }

  const limits = { depth: level.depth, timeBudgetMs: level.timeBudgetMs };
  const search = level.mctsBudgetMs
    ? hybridMove(board, config, player, { ...limits, mctsBudgetMs: level.mctsBudgetMs, rng })
    : { ...alphaBeta(board, config, player, limits), algorithm: 'alpha-beta', iterations: 0 };

  const reasons = [
    { key: 'reason.search', params: { depth: search.depth, nodes: search.nodes } },
    { key: search.exact ? 'reason.exact' : 'reason.heuristic' },
  ];
  if (search.algorithm === 'alpha-beta+mcts') {
    reasons.push({ key: 'reason.mcts', params: { iterations: search.iterations } });
  }
  return finish({
    move: search.move,
    score: search.score,
    algorithm: search.algorithm,
    depth: search.depth,
    nodes: search.nodes,
    iterations: search.iterations,
    exact: search.exact,
    candidates: search.candidates,
    reasons,
  });
}
