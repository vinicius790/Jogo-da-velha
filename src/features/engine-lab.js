import { chooseMove } from '../core/ai/engine.js';
import { DIFFICULTY_LEVELS } from '../core/constants.js';

/**
 * Laboratório de motores: pede o lance de cada nível para a mesma posição e mede o que cada um
 * fez de fato (algoritmo, profundidade, nós, tempo). `consensus` é o lance mais votado.
 */
export function compareEngines({ board, config, player = 'X', rng = Math.random }) {
  const results = DIFFICULTY_LEVELS.map((difficulty) => {
    const verdict = chooseMove({ board, config, player, difficulty, rng });
    return {
      difficulty,
      move: verdict.move,
      score: verdict.score,
      algorithm: verdict.algorithm,
      depth: verdict.depth,
      nodes: verdict.nodes,
      exact: verdict.exact,
      elapsedMs: verdict.elapsedMs,
    };
  });
  const votes = new Map();
  for (const result of results) votes.set(result.move, (votes.get(result.move) ?? 0) + 1);
  const [consensusMove, consensusVotes] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  return { consensusMove, consensusVotes, total: results.length, results };
}
