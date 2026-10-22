import { DIRECTIONS, HEX_DIRECTIONS } from '../constants.js';
import { OmegaError } from '../types.js';

export function boardLength(config) {
  return config.size * config.size;
}

export function emptyBoard(config) {
  return Array(boardLength(config)).fill(null);
}

export function opponent(mark) {
  return mark === 'X' ? 'O' : 'X';
}

export function rc(index, size) {
  return [Math.floor(index / size), index % size];
}

export function idx(row, col, size) {
  return row * size + col;
}

export function validIndex(index, config) {
  return Number.isInteger(index) && index >= 0 && index < boardLength(config);
}

/** Direções em que uma linha pode ser formada: quatro no tabuleiro quadrado, três no hexagonal. */
export function directionsFor(config) {
  return config?.variant === 'hex' ? HEX_DIRECTIONS : DIRECTIONS;
}

export function isClassic3x3(config) {
  return config.size === 3 && config.winLength === 3 && (config.variant ?? 'classic') === 'classic';
}

/**
 * Lances legais. Na variante Gravity só a casa livre mais baixa de cada coluna é jogável,
 * e é esse índice (a casa de pouso) que a função devolve.
 */
export function legalMoves(board, config) {
  const moves = [];
  if (config?.variant === 'gravity') {
    const n = config.size;
    for (let col = 0; col < n; col += 1) {
      for (let row = n - 1; row >= 0; row -= 1) {
        const index = row * n + col;
        if (board[index] === null) {
          moves.push(index);
          break;
        }
      }
    }
    return moves;
  }
  for (let index = 0; index < board.length; index += 1) {
    if (board[index] === null) moves.push(index);
  }
  return moves;
}

export function full(board) {
  return board.every(Boolean);
}

/**
 * Converte o índice pedido no índice real da jogada.
 * Em Gravity, qualquer casa da coluna vira a casa de pouso; nas demais variantes é o próprio índice.
 */
export function resolveMoveIndex(board, index, config) {
  if (!validIndex(index, config)) throw new OmegaError('invalid-index', 'Índice inválido.');
  if (config?.variant !== 'gravity') {
    if (board[index] !== null) throw new OmegaError('occupied', 'Célula ocupada.');
    return index;
  }
  const col = index % config.size;
  for (let row = config.size - 1; row >= 0; row -= 1) {
    const target = row * config.size + col;
    if (board[target] === null) return target;
  }
  throw new OmegaError('column-full', 'Coluna cheia.');
}

export const FADE_MAX_PIECES = 3;

/**
 * Retorna as peças ativas do jogador (em ordem cronológica de colocação).
 * Cada elemento é o índice da célula no tabuleiro.
 */
export function activePieces(moves = [], mark, board) {
  const active = [];
  for (const move of moves) {
    if (move.mark === mark && board[move.index] === mark) {
      if (!active.includes(move.index)) {
        active.push(move.index);
      }
    }
  }
  return active;
}

/**
 * No modo Fade (Jogo da Velha Infinito), se o jogador já tiver 3 peças no tabuleiro,
 * remove a mais antiga dele para dar lugar à nova jogada.
 */
export function fadeOldestPiece(board, moves, mark) {
  const active = activePieces(moves, mark, board);
  if (active.length >= FADE_MAX_PIECES) {
    const fadedIndex = active[0];
    const next = board.slice();
    next[fadedIndex] = null;
    return { board: next, fadedIndex };
  }
  return { board, fadedIndex: null };
}

/** Aplica o lance sem alterar o tabuleiro original. */
export function applyMove(board, index, mark, config, moves = []) {
  const target = resolveMoveIndex(board, index, config);
  let next = board.slice();
  if (config?.variant === 'fade') {
    const fadeResult = fadeOldestPiece(next, moves, mark);
    next = fadeResult.board;
  }
  next[target] = mark;
  return next;
}

