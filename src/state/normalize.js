import { GameEngine } from '../core/engine/game.js';
import { validateReplay } from '../features/replay.js';
import { sanitizeTournaments } from '../features/tournaments.js';
import { sanitizeProfile } from './profile.js';

const REPLAY_LIMIT = 200;
const SOLVED_LIMIT = 500;

/** Partida ativa: só é aceita se o histórico de lances reproduzir o estado declarado. */
export function normalizeGame(game) {
  if (!game) return null;
  try {
    return GameEngine.from(game).state;
  } catch {
    return null;
  }
}

export function normalizeReplays(replays) {
  return Array.isArray(replays) ? replays.filter(validateReplay).slice(0, REPLAY_LIMIT) : [];
}

/** Ids dos puzzles já resolvidos. */
export function normalizeSolved(puzzles) {
  if (!Array.isArray(puzzles)) return [];
  const ids = puzzles.filter((id) => typeof id === 'string' && id.length <= 64);
  return [...new Set(ids)].slice(0, SOLVED_LIMIT);
}

/**
 * Converte qualquer entrada externa (armazenamento local, backup importado, outra aba)
 * em um estado de aplicação válido. O que não passa na validação é descartado.
 */
export function normalizeState(incoming) {
  const source = incoming && typeof incoming === 'object' ? incoming : {};
  return {
    profile: sanitizeProfile(source.profile),
    game: normalizeGame(source.game),
    replays: normalizeReplays(source.replays),
    tournaments: sanitizeTournaments(source.tournaments),
    puzzles: normalizeSolved(source.puzzles),
  };
}

/**
 * Aplica uma mensagem do BroadcastChannel (outra aba do mesmo site) ao estado.
 * A mensagem é tratada como entrada não confiável e passa pelos mesmos validadores.
 */
export function applySyncMessage(state, message) {
  if (!message || typeof message !== 'object' || message.source !== 'omega') return state;
  switch (message.type) {
    case 'profile':
      return { ...state, profile: sanitizeProfile(message.payload) };
    case 'replays':
      return { ...state, replays: normalizeReplays(message.payload) };
    case 'tournaments':
      return { ...state, tournaments: sanitizeTournaments(message.payload) };
    case 'puzzles':
      return { ...state, puzzles: normalizeSolved(message.payload) };
    case 'state':
      // A partida ativa pertence a cada aba; uma restauração em outra aba não a substitui.
      return { ...normalizeState(message.payload), game: state.game };
    default:
      return state;
  }
}
