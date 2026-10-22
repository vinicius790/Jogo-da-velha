import { directionsFor, idx, rc } from './board.js';

function inside(row, col, size) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

/**
 * Procura uma linha vencedora que passe pelo último lance.
 * Devolve exatamente `winLength` índices (contendo `lastIndex`) ou null.
 */
export function findWinningLine(board, lastIndex, mark, config) {
  const { size, winLength } = config;
  const [row, col] = rc(lastIndex, size);
  for (const [dr, dc] of directionsFor(config)) {
    const cells = [lastIndex];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (inside(r, c, size) && board[idx(r, c, size)] === mark) {
        cells.push(idx(r, c, size));
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= winLength) {
      cells.sort((a, b) => a - b);
      const position = cells.indexOf(lastIndex);
      const start = Math.max(0, Math.min(position - (winLength - 1), cells.length - winLength));
      return cells.slice(start, start + winLength);
    }
  }
  return null;
}

/** Varre o tabuleiro inteiro; use `findWinningLine` quando o último lance é conhecido. */
export function winner(board, config) {
  for (let index = 0; index < board.length; index += 1) {
    const mark = board[index];
    if (!mark) continue;
    const line = findWinningLine(board, index, mark, config);
    if (line) return { mark, line };
  }
  return null;
}
