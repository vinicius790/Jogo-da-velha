import { OmegaError } from './types.js';
import { GameEngine } from './engine/game.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Índice → coordenada "coluna + linha" (A1 é o canto superior esquerdo). */
export function cellToCoordinate(index, size) {
  if (!Number.isInteger(index) || index < 0 || index >= size * size) {
    throw new RangeError('Índice fora do tabuleiro.');
  }
  return `${ALPHABET[index % size]}${Math.floor(index / size) + 1}`;
}

export function coordinateToCell(token, size) {
  const match = String(token ?? '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z])(\d{1,2})$/);
  if (!match) throw new OmegaError('bad-notation', 'Coordenada inválida.');
  const col = ALPHABET.indexOf(match[1]);
  const row = Number(match[2]) - 1;
  if (row < 0 || row >= size || col >= size) {
    throw new OmegaError('bad-notation', 'Coordenada fora do tabuleiro.');
  }
  return row * size + col;
}

/** Lista de lances no formato `XA1-OB2-...`. */
export function encodeMoves(moves, config) {
  return moves.map((move) => `${move.mark}${cellToCoordinate(move.index, config.size)}`).join('-');
}

export function notationForGame(state) {
  return encodeMoves(state.moves, state.config);
}

/** Reconstrói a partida a partir da notação, validando turnos e legalidade lance a lance. */
export function decodeMoves(notation, { size, winLength, variant = 'classic' }) {
  const game = new GameEngine({ mode: 'local', config: { size, winLength, variant } });
  const tokens = String(notation ?? '')
    .split('-')
    .map((token) => token.trim())
    .filter(Boolean);
  for (const token of tokens) {
    if (token[0] !== game.state.current) {
      throw new OmegaError('bad-notation', `Turno inválido em ${token}.`);
    }
    game.play(coordinateToCell(token.slice(1), size));
  }
  return game.state;
}
