import { positionalScore, tacticalSummary } from '../ai/evaluate.js';
import { probe3x3 } from '../ai/tablebase3x3.js';
import { isClassic3x3, legalMoves } from '../engine/board.js';

function complexityOf(cells) {
  if (cells > 81) return 'extreme';
  if (cells > 36) return 'high';
  if (cells > 9) return 'medium';
  return 'low';
}

/**
 * Leitura instantânea da posição (sem busca): tática de um lance, avaliação estática e,
 * no 3×3 clássico, o resultado exato. A melhor jogada vem do motor (`chooseMove`), não daqui.
 */
export function analyzePosition(board, config, player) {
  return {
    evalScore: positionalScore(board, config, player),
    tactical: tacticalSummary(board, config, player),
    exact: isClassic3x3(config) ? probe3x3(board, player) : null,
    complexity: complexityOf(board.length),
    free: legalMoves(board, config).length,
    total: board.length,
  };
}
