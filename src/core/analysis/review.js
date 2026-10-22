import { alphaBeta } from '../ai/minimax.js';
import { emptyBoard, fadeOldestPiece } from '../engine/board.js';
import { analyzePosition } from './analyzer.js';
import {
  GRADE_SYMBOLS,
  classifyMove,
  explainMove,
  outcomeClass,
  summarize,
} from './move-grader.js';

/**
 * Análise pós-jogo: para cada posição da partida, o lance jogado, a nota dele e os melhores
 * lances alternativos segundo a busca alpha-beta, mais a leitura instantânea do analisador
 * (avaliação estática e tática de um lance) naquela posição.
 *
 * `positions[i]` descreve a posição ANTES do lance `i + 1`:
 * - `played` / `playedScore` / `grade` / `symbol` / `explanation`: o que foi jogado e como a busca o avalia
 *   (`playedScore` é null quando o lance ficou fora dos candidatos da busca em tabuleiros grandes);
 * - `alternatives`: até `alternatives` outros lances, do melhor para o pior, com `score` do ponto
 *   de vista de quem joga e `outcome` (1 vitória forçada, -1 derrota forçada, 0 indefinido);
 * - `depth` / `exact`: até onde a busca chegou; `evalScore`, `wins`, `threats`: analisador.
 */
export function reviewGame(replay, { depth = 6, timeBudgetMs = 150, alternatives = 3 } = {}) {
  let board = emptyBoard(replay.config);
  const positions = [];
  const movesSoFar = [];
  const describe = ({ index, score }) => ({ index, score, outcome: outcomeClass(score) });
  for (const move of replay.moves) {
    const search = alphaBeta(board, replay.config, move.mark, { depth, timeBudgetMs });
    const reading = analyzePosition(board, replay.config, move.mark);
    const played = search.candidates.find((candidate) => candidate.index === move.index);
    const isWin = Boolean(reading?.tactical?.winning?.includes(move.index));
    const grade = classifyMove(search.candidates, move.index, { isImmediateWin: isWin });
    positions.push({
      turn: positions.length + 1,
      mark: move.mark,
      played: move.index,
      playedScore: played ? played.score : null,
      grade,
      symbol: GRADE_SYMBOLS[grade] ?? '',
      explanation: explainMove(grade, { isWin }),
      best: search.candidates[0].index,
      alternatives: search.candidates
        .filter((candidate) => candidate.index !== move.index)
        .slice(0, alternatives)
        .map(describe),
      depth: search.depth,
      exact: search.exact,
      evalScore: reading.evalScore,
      wins: reading.tactical.winning,
      threats: reading.tactical.blocks,
    });
    if (replay.config.variant === 'fade') {
      const fade = fadeOldestPiece(board, movesSoFar, move.mark);
      board = fade.board;
    }
    board[move.index] = move.mark;
    movesSoFar.push(move);
  }
  return { positions, summary: summarize(positions) };
}

/** Próximo lance (a partir de `turn`, exclusivo) classificado como impreciso ou erro grave; -1 se não há. */
export function nextMistake(review, turn) {
  const found = review.positions.find(
    (position) =>
      position.turn > turn && (position.grade === 'inaccuracy' || position.grade === 'blunder'),
  );
  return found ? found.turn : -1;
}
