import { DECIDED_SCORE, alphaBeta } from '../ai/minimax.js';
import { emptyBoard, fadeOldestPiece } from '../engine/board.js';

export const GRADE_SYMBOLS = Object.freeze({
  brilliant: '!!',
  best: '!',
  excellent: '',
  good: '',
  inaccuracy: '?',
  blunder: '??',
});

export const GRADE_TITLES = Object.freeze({
  brilliant: 'Brilhante (!!)',
  best: 'Melhor Lance (!)',
  excellent: 'Excelente',
  good: 'Excelente',
  inaccuracy: 'Imprecisão (?)',
  blunder: 'Erro Crasso (??)',
});

export function explainMove(grade, details = {}) {
  switch (grade) {
    case 'brilliant':
      return 'Lance genial (!!): encontra a única rota tática vencedora diante de defesas complexas.';
    case 'best':
      return details.isWin
        ? 'Melhor lance (!): finalização imediata e decisiva da partida.'
        : 'Melhor lance (!): a resposta mais precisa segundo o motor posicional.';
    case 'excellent':
    case 'good':
      return 'Excelente: jogada forte e equilibrada que mantém a iniciativa sem falhas.';
    case 'inaccuracy':
      return 'Imprecisão (?): lance subótimo que reduz a vantagem posicional ou atrasa a vitória.';
    case 'blunder':
      return 'Erro crasso (??): falha tática crítica que concede oportunidade de vitória imediata ao oponente.';
    default:
      return '';
  }
}

/** 1 = vitória forçada, -1 = derrota forçada, 0 = resultado em aberto. */
export function outcomeClass(score) {
  if (score >= DECIDED_SCORE) return 1;
  if (score <= -DECIDED_SCORE) return -1;
  return 0;
}

/** Nota de um lance (`index`) diante dos candidatos da busca, ordenados do melhor para o pior. */
export function classifyMove(candidates, index, { isImmediateWin = false } = {}) {
  const best = candidates[0];
  const rank = candidates.findIndex((candidate) => candidate.index === index);
  const played = candidates[rank];
  if (!played) return 'inaccuracy';
  if (outcomeClass(played.score) < outcomeClass(best.score)) return 'blunder';

  const isWinning = played.score >= DECIDED_SCORE;
  const runnerUp = candidates[1];
  const isSoleWinningMove = isWinning && runnerUp && runnerUp.score < DECIDED_SCORE && !isImmediateWin;

  if (played.score >= best.score) {
    if (isSoleWinningMove && candidates.length >= 3) {
      return 'brilliant';
    }
    return 'best';
  }
  return rank < 3 ? 'excellent' : 'inaccuracy';
}

/**
 * Classifica cada lance de um replay comparando-o com a busca alpha-beta na mesma posição:
 * - brilliant (!!): lance tático único vencedor;
 * - best (!): igual (ou tão bom quanto) o melhor lance encontrado;
 * - excellent: entre os três melhores, sem mudar o resultado previsto;
 * - inaccuracy (?): pior que isso, mas ainda sem mudar o resultado previsto;
 * - blunder (??): troca vitória por não-vitória, ou não-derrota por derrota forçada.
 */
export function gradeReplay(replay, { depth = 6, timeBudgetMs = 150 } = {}) {
  let board = emptyBoard(replay.config);
  const grades = [];
  const movesSoFar = [];
  for (const move of replay.moves) {
    const search = alphaBeta(board, replay.config, move.mark, { depth, timeBudgetMs });
    const grade = classifyMove(search.candidates, move.index);
    grades.push({
      turn: grades.length + 1,
      mark: move.mark,
      index: move.index,
      best: search.candidates[0].index,
      grade,
      symbol: GRADE_SYMBOLS[grade] ?? '',
      explanation: explainMove(grade),
    });
    if (replay.config.variant === 'fade') {
      const fade = fadeOldestPiece(board, movesSoFar, move.mark);
      board = fade.board;
    }
    board[move.index] = move.mark;
    movesSoFar.push(move);
  }
  return { grades, summary: summarize(grades) };
}

/** Contagem das notas por lado. */
export function summarize(grades) {
  const summary = {};
  for (const mark of ['X', 'O']) {
    const own = grades.filter((grade) => grade.mark === mark);
    const count = (name) => own.filter((grade) => grade.grade === name).length;
    summary[mark] = {
      total: own.length,
      brilliant: count('brilliant'),
      best: count('best'),
      excellent: count('excellent') + count('good'),
      good: count('excellent') + count('good'),
      inaccuracy: count('inaccuracy'),
      blunder: count('blunder'),
    };
  }
  return summary;
}

