import { directionsFor, idx, legalMoves, opponent } from '../engine/board.js';
import { findWinningLine } from '../engine/win.js';

// Peso de uma janela de `winLength` casas ocupada só por um lado, por quantidade de peças.
const WEIGHTS = [0, 1, 8, 60, 450, 3200, 24000];

function windowScore(mine, theirs) {
  if (mine && theirs) return 0;
  const count = Math.max(mine, theirs);
  const weight = WEIGHTS[Math.min(count, WEIGHTS.length - 1)];
  return mine ? weight : -weight;
}

/** Em Gravity uma casa vazia só é jogável se for a mais baixa livre da coluna. */
function playable(board, index, config) {
  if (config.variant !== 'gravity') return true;
  const below = index + config.size;
  return below >= board.length || board[below] !== null;
}

/**
 * Varre todas as janelas de `winLength` casas do tabuleiro.
 * Devolve a avaliação estática do ponto de vista de `forMark` e, para cada lado, o conjunto de
 * casas jogáveis que completam uma linha agora (`mine` = de `forMark`, `theirs` = do adversário).
 */
export function scanPosition(board, config, forMark) {
  const { size, winLength } = config;
  const them = opponent(forMark);
  const center = (size - 1) / 2;
  const mine = new Set();
  const theirs = new Set();
  let score = 0;
  const directions = directionsFor(config);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const value = board[idx(row, col, size)];
      if (value) {
        const centrality = 3 / (1 + Math.abs(row - center) + Math.abs(col - center));
        score += value === forMark ? centrality : -centrality;
      }
      for (const [dr, dc] of directions) {
        const endRow = row + (winLength - 1) * dr;
        const endCol = col + (winLength - 1) * dc;
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
        let own = 0;
        let other = 0;
        let gap = -1;
        for (let k = 0; k < winLength; k += 1) {
          const index = idx(row + k * dr, col + k * dc, size);
          const cell = board[index];
          if (cell === forMark) own += 1;
          else if (cell === them) other += 1;
          else gap = index;
        }
        score += windowScore(own, other);
        if (own + other === winLength - 1 && (own === 0 || other === 0)) {
          if (playable(board, gap, config)) (own ? mine : theirs).add(gap);
        }
      }
    }
  }
  return { score, mine, theirs };
}

/**
 * Avaliação estática do ponto de vista de `forMark`:
 * centralidade das peças + soma de todas as janelas de `winLength` casas ainda abertas.
 */
export function positionalScore(board, config, forMark) {
  return scanPosition(board, config, forMark).score;
}

/** Verifica se `mark` completaria uma linha jogando em `index` (o tabuleiro é restaurado). */
export function completesLine(board, index, mark, config) {
  board[index] = mark;
  const line = findWinningLine(board, index, mark, config);
  board[index] = null;
  return Boolean(line);
}

/**
 * Tática de um lance: casas em que `player` completa uma linha (`winning`)
 * e casas em que o adversário completaria (`blocks`).
 */
export function tacticalSummary(board, config, player) {
  const scratch = board.slice();
  const them = opponent(player);
  const winning = [];
  const blocks = [];
  for (const move of legalMoves(scratch, config)) {
    if (completesLine(scratch, move, player, config)) winning.push(move);
    if (completesLine(scratch, move, them, config)) blocks.push(move);
  }
  return { winning, blocks };
}
