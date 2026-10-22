import { OmegaError } from '../core/types.js';
import { validateReplay } from '../features/replay.js';
import { applySyncMessage, normalizeGame, normalizeSolved, normalizeState } from './normalize.js';
import { sanitizeProfile } from './profile.js';
import { storage } from './storage.js';

const KEYS = Object.freeze({
  profile: 'profile',
  game: 'active-game',
  replays: 'replays',
  tournaments: 'tournaments',
  puzzles: 'puzzles',
});
const REPLAY_LIMIT = 200;

const listeners = new Set();
// Sincroniza perfil, replays, torneios e puzzles entre abas do mesmo navegador.
const channel =
  typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('omega-ttt-sync')
    : null;

let state = normalizeState(null);

export async function loadStore() {
  state = normalizeState({
    profile: await storage.get(KEYS.profile),
    game: await storage.get(KEYS.game),
    replays: await storage.get(KEYS.replays),
    tournaments: await storage.get(KEYS.tournaments),
    puzzles: await storage.get(KEYS.puzzles),
  });
  return getState();
}

export function getState() {
  return structuredClone(state);
}

/** Avisa quando o estado muda por causa de outra aba. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function broadcast(type, payload) {
  try {
    channel?.postMessage({ source: 'omega', type, payload });
  } catch {
    // canal fechado ou payload não clonável: a outra aba se atualiza no próximo carregamento
  }
}

/** Substitui todo o estado por um backup importado (validado campo a campo). */
export async function restoreState(snapshot) {
  state = normalizeState(snapshot);
  await Promise.all([
    storage.set(KEYS.profile, state.profile),
    storage.set(KEYS.replays, state.replays),
    storage.set(KEYS.tournaments, state.tournaments),
    storage.set(KEYS.puzzles, state.puzzles),
    state.game ? storage.set(KEYS.game, state.game) : storage.remove(KEYS.game),
  ]);
  broadcast('state', state);
  return getState();
}

export async function updateProfile(mutator) {
  state.profile = sanitizeProfile(mutator(structuredClone(state.profile)));
  await storage.set(KEYS.profile, state.profile);
  broadcast('profile', state.profile);
  return structuredClone(state.profile);
}

export async function saveGame(game) {
  state.game = normalizeGame(game);
  if (state.game) await storage.set(KEYS.game, state.game);
}

export async function clearGame() {
  state.game = null;
  await storage.remove(KEYS.game);
}

export async function appendReplay(replay) {
  if (!validateReplay(replay)) throw new OmegaError('invalid-replay', 'Replay inválido.');
  const others = state.replays.filter((item) => item.id !== replay.id);
  state.replays = [replay, ...others].slice(0, REPLAY_LIMIT);
  await storage.set(KEYS.replays, state.replays);
  broadcast('replays', state.replays);
}

export async function saveTournaments(tournaments) {
  state.tournaments = normalizeState({ tournaments }).tournaments;
  await storage.set(KEYS.tournaments, state.tournaments);
  broadcast('tournaments', state.tournaments);
  return structuredClone(state.tournaments);
}

export async function markPuzzleSolved(id) {
  state.puzzles = normalizeSolved([id, ...state.puzzles]);
  await storage.set(KEYS.puzzles, state.puzzles);
  broadcast('puzzles', state.puzzles);
}

channel?.addEventListener('message', (event) => {
  const next = applySyncMessage(state, event.data);
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener(getState());
});
