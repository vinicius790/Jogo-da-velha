import { completesLine } from '../core/ai/evaluate.js';
import { directionsFor, emptyBoard, idx, opponent } from '../core/engine/board.js';
import { normalizeConfig } from '../core/engine/validator.js';
import { winner } from '../core/engine/win.js';

/** Tabuleiros oferecidos nos puzzles: clássica e hexagonal (linha só nos três eixos do hexágono). */
export const PUZZLE_CONFIGS = Object.freeze([
  Object.freeze({ size: 3, winLength: 3, variant: 'classic' }),
  Object.freeze({ size: 4, winLength: 4, variant: 'classic' }),
  Object.freeze({ size: 5, winLength: 4, variant: 'classic' }),
  Object.freeze({ size: 6, winLength: 4, variant: 'classic' }),
  Object.freeze({ size: 4, winLength: 3, variant: 'hex' }),
  Object.freeze({ size: 5, winLength: 4, variant: 'hex' }),
  Object.freeze({ size: 6, winLength: 4, variant: 'hex' }),
]);

const MAX_ATTEMPTS = 200;

/** Gerador pseudoaleatório determinístico (xorshift32) a partir de uma semente. */
export function seededRng(seed) {
  let x = Number(seed) >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function shuffle(values, rng) {
  const list = values.slice();
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Todos os segmentos de `winLength` casas alinhadas que cabem no tabuleiro (nos eixos da variante). */
function segments(config) {
  const { size, winLength } = config;
  const out = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      for (const [dr, dc] of directionsFor(config)) {
        const endRow = row + (winLength - 1) * dr;
        const endCol = col + (winLength - 1) * dc;
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
        out.push(
          Array.from({ length: winLength }, (_, k) => idx(row + k * dr, col + k * dc, size)),
        );
      }
    }
  }
  return out;
}

function winningMoves(board, mark, config) {
  const scratch = board.slice();
  return scratch
    .map((value, index) => (value === null ? index : -1))
    .filter((index) => index >= 0 && completesLine(scratch, index, mark, config));
}

/**
 * Monta uma posição "vença em um lance":
 * uma linha de quem joga com uma casa faltando, peças do adversário em casas sorteadas e
 * contagem de peças coerente com a alternância de turnos (X começa). Posições em que alguém
 * já venceu são descartadas, portanto toda posição gerada é alcançável em uma partida real.
 */
function buildPosition(config, rng) {
  const toMove = rng() < 0.5 ? 'X' : 'O';
  const them = opponent(toMove);
  const board = emptyBoard(config);
  const all = segments(config);
  const line = all[Math.floor(rng() * all.length)];
  const gap = line[Math.floor(rng() * line.length)];
  for (const cell of line) if (cell !== gap) board[cell] = toMove;

  // Pares extras de peças deixam a posição menos óbvia nos tabuleiros maiores.
  const extraPairs = Math.floor(rng() * (config.size - 2));
  const mine = config.winLength - 1 + extraPairs;
  const theirs = toMove === 'X' ? mine : mine + 1;
  const free = shuffle(
    board
      .map((value, index) => (value === null && index !== gap ? index : -1))
      .filter((i) => i >= 0),
    rng,
  );
  if (free.length < extraPairs + theirs) return null;
  for (const cell of free.slice(0, extraPairs)) board[cell] = toMove;
  for (const cell of free.slice(extraPairs, extraPairs + theirs)) board[cell] = them;

  if (winner(board, config)) return null;
  return { board, toMove };
}

/** Gera um puzzle determinístico para (semente, configuração). */
export function generatePuzzle(seed = Date.now(), config = PUZZLE_CONFIGS[0]) {
  const normalized = normalizeConfig(config);
  const rng = seededRng(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const position = buildPosition(normalized, rng);
    if (!position) continue;
    const answers = winningMoves(position.board, position.toMove, normalized);
    if (!answers.length) continue;
    // Ids da clássica sem sufixo, como antes (os resolvidos ficam guardados por id).
    const variant = normalized.variant === 'classic' ? '' : `-${normalized.variant}`;
    return {
      id: `puzzle-${normalized.size}x${normalized.winLength}${variant}-${seed}`,
      config: normalized,
      board: position.board,
      toMove: position.toMove,
      answers,
    };
  }
  throw new Error('Não foi possível gerar um puzzle para esta configuração.');
}

/** Qualquer lance que complete uma linha de quem joga resolve o puzzle. */
export function validatePuzzle(puzzle, index) {
  return Boolean(puzzle) && Number.isInteger(index) && puzzle.answers.includes(index);
}
