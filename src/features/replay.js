import { DIFFICULTY_LEVELS, MODES } from '../core/constants.js';
import { GameEngine } from '../core/engine/game.js';

/** Replay = configuração + lista de lances; o tabuleiro é sempre reconstruído pelas regras. */
export function makeReplay(state, player = null) {
  return {
    id: state.id,
    createdAt: state.createdAt,
    config: { ...state.config },
    mode: state.mode,
    difficulty: state.difficulty,
    result: state.result,
    endReason: state.endReason ?? null,
    player: player === 'X' || player === 'O' ? player : null,
    moves: state.moves.map((move, i) => ({ index: move.index, mark: move.mark, turn: i + 1 })),
  };
}

/** Estado da partida após os `turn` primeiros lances do replay. */
export function replayFrame(replay, turn) {
  const game = new GameEngine({ mode: 'local', config: replay.config });
  for (const move of replay.moves.slice(0, turn)) game.play(move.index);
  // Partida decidida no relógio: o último quadro mostra a derrota por tempo.
  if (replay.endReason === 'timeout' && turn >= replay.moves.length) game.timeout();
  return game.state;
}

/** Um replay só é aceito se os lances forem legais e levarem ao resultado declarado. */
export function validateReplay(replay) {
  try {
    if (!replay || typeof replay !== 'object' || !Array.isArray(replay.moves)) return false;
    if (typeof replay.id !== 'string' || !replay.id || replay.id.length > 80) return false;
    if (!MODES.includes(replay.mode) || !DIFFICULTY_LEVELS.includes(replay.difficulty)) {
      return false;
    }
    if (!Number.isFinite(replay.createdAt)) return false;
    // Campos opcionais usados pela tela (lado do jogador na análise, derrota por tempo).
    if (![undefined, null, 'X', 'O'].includes(replay.player)) return false;
    if (![undefined, null, 'timeout'].includes(replay.endReason)) return false;
    const end = replayFrame(replay, replay.moves.length);
    const marksMatch = end.moves.every((move, i) => move.mark === replay.moves[i].mark);
    return marksMatch && end.result === (replay.result ?? null);
  } catch {
    return false;
  }
}
