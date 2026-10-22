import { ELO } from '../core/constants.js';

/** Pontuação esperada de quem tem `rating` contra `opponentRating` (fórmula Elo). */
export function expected(rating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

/** Novo rating Elo após um resultado (`score`: 1 vitória, 0,5 empate, 0 derrota). */
export function updateRating(rating, opponentRating, score, k = ELO.K) {
  return Math.round(rating + k * (score - expected(rating, opponentRating)));
}
