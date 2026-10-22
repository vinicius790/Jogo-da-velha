// Fachada de alto nível para quem embute o motor em outro projeto (reexportada por src/index.js).
import { chooseMove } from './ai/engine.js';
import { analyzePosition } from './analysis/analyzer.js';
import { GameEngine } from './engine/game.js';
import { decodeState, encodeState } from './serialization/share.js';

export function createGame(options = {}) {
  return new GameEngine(options);
}

/** Pede o lance da IA para a posição atual (não joga; devolve o veredito). */
export function suggestMove(game, difficulty = 'expert') {
  const { board, config, current } = game.state;
  return chooseMove({ board, config, player: current, difficulty });
}

export function analyze(game) {
  const { board, config, current } = game.state;
  return analyzePosition(board, config, current);
}

export function share(game) {
  return encodeState(game.state);
}

/** Recria a partida a partir de um código de compartilhamento (validando o conteúdo). */
export function restore(code) {
  return GameEngine.from(decodeState(code));
}
