import { DIFFICULTY_LEVELS, MODES, SIZE_LIMITS, VARIANTS } from '../constants.js';
import { OmegaError } from '../types.js';
import { emptyBoard, fadeOldestPiece, full, opponent, resolveMoveIndex } from './board.js';
import { findWinningLine } from './win.js';

const CELL_VALUES = new Set(['X', 'O', null]);
const isMark = (value) => value === 'X' || value === 'O';

function fail(message) {
  throw new OmegaError('invalid-snapshot', message);
}

export function validateConfig(config) {
  if (
    !config ||
    !Number.isInteger(config.size) ||
    config.size < SIZE_LIMITS.min ||
    config.size > SIZE_LIMITS.max
  ) {
    throw new OmegaError('invalid-config', 'Configuração de tamanho inválida.');
  }
  if (
    !Number.isInteger(config.winLength) ||
    config.winLength < 3 ||
    config.winLength > config.size
  ) {
    throw new OmegaError('invalid-config', 'Configuração de vitória inválida.');
  }
  if (config.variant !== undefined && !VARIANTS.includes(config.variant)) {
    throw new OmegaError('invalid-config', 'Variante inválida.');
  }
  return true;
}

export function normalizeConfig(config) {
  validateConfig(config);
  return { size: config.size, winLength: config.winLength, variant: config.variant ?? 'classic' };
}

/** Metadados opcionais da partida: só campos conhecidos e curtos sobrevivem. */
export function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const clean = {};
  if (isMark(meta.human)) clean.human = meta.human;
  for (const key of ['tournamentId', 'matchId']) {
    if (typeof meta[key] === 'string' && meta[key].length <= 80) clean[key] = meta[key];
  }
  return Object.keys(clean).length ? clean : null;
}

/**
 * Valida um snapshot vindo de fora (armazenamento, link, backup, rede).
 * O histórico de lances é reexecutado do zero: tabuleiro, turno, status e resultado
 * precisam ser exatamente os que as regras produzem.
 */
export function validateSnapshot(s) {
  if (!s || typeof s !== 'object') fail('Snapshot inválido.');
  validateConfig(s.config);
  const config = normalizeConfig(s.config);
  if (typeof s.id !== 'string' || !s.id || s.id.length > 80) fail('Identificador inválido.');
  if (!MODES.includes(s.mode)) fail('Modo inválido.');
  if (!DIFFICULTY_LEVELS.includes(s.difficulty)) fail('Dificuldade inválida.');
  if (!Array.isArray(s.board) || s.board.length !== config.size * config.size) {
    fail('Tabuleiro inválido.');
  }
  if (!s.board.every((value) => CELL_VALUES.has(value))) fail('Marcador inválido.');
  if (!isMark(s.current) || !isMark(s.starter)) fail('Jogador inválido.');
  if (!['playing', 'won', 'draw', 'aborted'].includes(s.status)) fail('Status inválido.');
  if (
    !Array.isArray(s.moves) ||
    (config.variant !== 'fade' && s.moves.length > s.board.length) ||
    (config.variant === 'fade' && s.moves.length > 500) ||
    !s.moves.every((move) => move && Number.isInteger(move.index) && isMark(move.mark))
  ) {
    fail('Histórico de movimentos inválido.');
  }

  let board = emptyBoard(config);
  let current = s.starter;
  let status = 'playing';
  let result = null;
  let winningLine = null;
  const movesSoFar = [];
  for (const move of s.moves) {
    if (status !== 'playing') fail('Existem movimentos após o fim da partida.');
    if (move.mark !== current) fail('Turnos do histórico são inválidos.');
    const requested = Number.isInteger(move.requestedIndex) ? move.requestedIndex : move.index;
    const target = resolveMoveIndex(board, requested, config);
    if (target !== move.index) fail('Índice real do movimento não confere.');
    board = board.slice();
    if (config.variant === 'fade') {
      const fade = fadeOldestPiece(board, movesSoFar, move.mark);
      board = fade.board;
    }
    board[target] = move.mark;
    movesSoFar.push(move);
    const line = findWinningLine(board, target, move.mark, config);
    if (line) {
      status = 'won';
      result = config.variant === 'misere' ? opponent(move.mark) : move.mark;
      winningLine = line;
    } else if (full(board)) {
      status = 'draw';
      result = 'draw';
    } else {
      current = opponent(current);
    }
  }

  if (board.some((value, index) => value !== s.board[index])) {
    fail('Tabuleiro não corresponde ao histórico.');
  }
  if (s.status === 'aborted') {
    if (status !== 'playing' || s.result !== 'aborted') {
      fail('Estado abortado não corresponde ao histórico.');
    }
    if (s.current !== current) fail('Jogador atual não corresponde ao histórico.');
    return true;
  }
  if (s.endReason === 'timeout') {
    // Derrota no relógio: o histórico ainda está em jogo e perde quem tinha a vez.
    if (status !== 'playing' || s.status !== 'won' || s.result !== opponent(current)) {
      fail('Derrota por tempo não corresponde ao histórico.');
    }
    if (s.winningLine?.length) fail('Linha vencedora inválida.');
    return true;
  }
  if (s.status !== status) fail('Status não corresponde ao histórico.');
  if (s.result !== result) fail('Resultado não corresponde ao histórico.');
  if (status === 'playing' && s.current !== current) {
    fail('Jogador atual não corresponde ao histórico.');
  }
  if (status === 'won' && JSON.stringify(s.winningLine ?? []) !== JSON.stringify(winningLine)) {
    fail('Linha vencedora inválida.');
  }
  return true;
}
