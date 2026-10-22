import { tacticalSummary } from '../core/ai/evaluate.js';
import { AI_RATING, AI_RATING_DEVIATION } from '../core/constants.js';
import { emptyBoard } from '../core/engine/board.js';
import { notationForGame } from '../core/notation.js';
import { updateGlicko2 } from '../services/glicko2.js';
import { updateRating } from '../services/rating.js';
import { evaluateAchievements } from './achievements.js';
import { recordRanking } from './ranking.js';

const XP = Object.freeze({ win: 25, draw: 10, loss: 5 });
const SCORE = Object.freeze({ win: 1, draw: 0.5, loss: 0 });
const HISTORY_LIMIT = 100;

/** Resultado da partida do ponto de vista de `player` ('win' | 'draw' | 'loss'). */
export function playerOutcome(state, player) {
  if (state.result === 'draw') return 'draw';
  return state.result === player ? 'win' : 'loss';
}

/** Verdadeiro se, em alguma vez sua, `player` esteve sob ameaça de derrota imediata. */
export function facedImmediateThreat(state, player) {
  if (state.config.variant === 'misere') return false;
  const board = emptyBoard(state.config);
  for (const move of state.moves) {
    if (move.mark === player && tacticalSummary(board, state.config, player).blocks.length) {
      return true;
    }
    board[move.index] = move.mark;
  }
  return false;
}

/**
 * Regras de registro de uma partida encerrada no perfil. Função pura: devolve o novo perfil
 * e o que mudou, ou null quando a partida não deve ser registrada.
 *
 * - Só contam partidas concluídas (vitória/empate) em que há um jogador humano identificado
 *   e ao menos um lance (ou que terminaram no relógio, mesmo antes do primeiro lance):
 *   modo `ai` (com rating) e modo `online` como jogador (sem rating: o servidor não tem ratings).
 * - Modo local, modo espectador, partidas abortadas e partidas abertas por link (`unrated`)
 *   não alteram o perfil.
 * - A mesma partida (mesmo id) nunca é registrada duas vezes.
 */
export function applyGameResult(
  profile,
  state,
  { player, unrated = false, offline = false, durationMs = 0, now = Date.now() } = {},
) {
  const finished = state.status === 'won' || state.status === 'draw';
  const countable = state.mode === 'ai' || state.mode === 'online';
  if (!finished || !countable || unrated) return null;
  // Sem lances só conta a derrota (ou vitória) no relógio: quem não jogou a tempo perde.
  if (!state.moves.length && state.endReason !== 'timeout') return null;
  if (player !== 'X' && player !== 'O') return null;
  if (profile.history.some((entry) => entry.id === state.id)) return null;

  const outcome = playerOutcome(state, player);
  const score = SCORE[outcome];
  const rated = state.mode === 'ai';

  let rating = profile.rating;
  let glicko = profile.glicko;
  if (rated) {
    const opponent = AI_RATING[state.difficulty] ?? AI_RATING.normal;
    rating = updateRating(profile.rating, opponent.elo, score);
    const next = updateGlicko2(profile.glicko, [
      { opponentRating: opponent.glicko, opponentDeviation: AI_RATING_DEVIATION, score },
    ]);
    glicko = {
      rating: Math.round(next.rating),
      deviation: Math.round(next.deviation),
      volatility: Number(next.volatility.toFixed(6)),
    };
  }

  const streak = outcome === 'win' ? profile.streak + 1 : 0;
  const entry = {
    id: state.id,
    finishedAt: now,
    mode: state.mode,
    difficulty: state.difficulty,
    config: { ...state.config },
    result: state.result,
    player,
    outcome,
    rated,
    moves: state.moves.length,
    endReason: state.endReason === 'timeout' ? 'timeout' : null,
    ratingDelta: rating - profile.rating,
    notation: notationForGame(state),
    durationMs,
  };
  const next = {
    ...profile,
    played: profile.played + 1,
    wins: profile.wins + (outcome === 'win' ? 1 : 0),
    losses: profile.losses + (outcome === 'loss' ? 1 : 0),
    draws: profile.draws + (outcome === 'draw' ? 1 : 0),
    rating,
    glicko,
    xp: profile.xp + XP[outcome],
    streak,
    bestStreak: Math.max(profile.bestStreak, streak),
    history: [entry, ...profile.history].slice(0, HISTORY_LIMIT),
    ranking: recordRanking(profile.ranking, entry, profile.name),
  };

  const unlocked = evaluateAchievements(next, {
    game: {
      outcome,
      config: state.config,
      difficulty: state.difficulty,
      mode: state.mode,
      playerMoves: state.moves.filter((move) => move.mark === player).length,
      facedThreat: facedImmediateThreat(state, player),
      offline,
      endReason: state.endReason ?? null,
    },
  });
  next.achievements = [...next.achievements, ...unlocked];
  return { profile: next, entry, unlocked };
}

/** Desbloqueia conquistas ligadas a eventos fora de uma partida (puzzle, replay, importação…). */
export function applyEvent(profile, event) {
  const unlocked = evaluateAchievements(profile, event);
  if (!unlocked.length) return { profile, unlocked };
  return {
    profile: { ...profile, achievements: [...profile.achievements, ...unlocked] },
    unlocked,
  };
}
