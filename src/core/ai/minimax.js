import { legalMoves, opponent } from '../engine/board.js';
import { findWinningLine } from '../engine/win.js';
import { scanPosition } from './evaluate.js';
import { TranspositionTable } from './transposition.js';

export const WIN_SCORE = 100000;
/** A partir deste valor absoluto a pontuação representa vitória/derrota forçada. */
export const DECIDED_SCORE = WIN_SCORE - 1000;

// Tipo do valor guardado na tabela de transposição.
const EXACT = 0; // valor exato do nó
const LOWER = 1; // corte beta: o valor real é >= ao guardado
const UPPER = 2; // falhou abaixo de alpha: o valor real é <= ao guardado

const TIMEOUT = Symbol('search-timeout');

/**
 * Distância entre duas casas na vizinhança do tabuleiro: Chebyshev no quadrado (as oito casas em
 * volta estão a 1) e distância hexagonal no hexagonal, onde só seis casas são vizinhas: em
 * coordenadas axiais (dr, dc) = (1, -1) é vizinha, mas (1, 1) está a 2.
 */
export function cellDistance(dr, dc, hex = false) {
  if (hex) return (Math.abs(dr) + Math.abs(dc) + Math.abs(dr + dc)) / 2;
  return Math.max(Math.abs(dr), Math.abs(dc));
}

function hasNeighbor(board, index, size, radius, hex) {
  const row = Math.floor(index / size);
  const col = index % size;
  for (let r = Math.max(0, row - radius); r <= Math.min(size - 1, row + radius); r += 1) {
    for (let c = Math.max(0, col - radius); c <= Math.min(size - 1, col + radius); c += 1) {
      if (board[r * size + c] !== null && cellDistance(r - row, c - col, hex) <= radius) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Lances considerados pela busca, do centro para as bordas.
 * Em tabuleiros com mais de 36 casas só entram casas próximas de alguma peça
 * (toda linha vencedora nasce ao lado de peças existentes). No hexagonal, "próxima" é medida
 * pela vizinhança hexagonal (seis vizinhas), não pela quadrada.
 */
// ponytail: corte por vizinhança simples; trocar por ordenação por ameaças se a força em 10×10+ importar.
export function candidateMoves(board, config) {
  const { size } = config;
  const center = (size - 1) / 2;
  const distance = (index) =>
    Math.hypot(Math.floor(index / size) - center, (index % size) - center);
  const moves = legalMoves(board, config).sort((a, b) => distance(a) - distance(b));
  if (config.variant === 'gravity' || board.length <= 36) return moves;
  const radius = size <= 8 ? 2 : 1;
  const hex = config.variant === 'hex';
  const near = moves.filter((index) => hasNeighbor(board, index, size, radius, hex));
  return near.length ? near : moves.slice(0, 1);
}

function moveFirst(moves, preferred) {
  const position = moves.indexOf(preferred);
  if (position <= 0) return moves;
  return [preferred, ...moves.slice(0, position), ...moves.slice(position + 1)];
}

/**
 * Alpha-beta com aprofundamento iterativo, tabela de transposição e orçamento de tempo.
 *
 * A pontuação é sempre do ponto de vista de `player`. Cada lance da raiz é pesquisado com
 * janela completa, então `candidates` traz valores exatos (para a profundidade alcançada).
 */
// ponytail: janela completa na raiz custa poda; usar PVS se precisar de mais profundidade.
export function alphaBeta(
  board,
  config,
  player,
  { depth = 4, timeBudgetMs = 250, useTable = true } = {},
) {
  const misere = config.variant === 'misere';
  const table = new TranspositionTable(100000);
  const started = performance.now();
  const deadline = started + timeBudgetMs;
  let nodes = 0;

  /**
   * Avaliação de folha. Fora do Misère ela enxerga a tática imediata, que é resultado certo:
   * quem tem a vez e pode completar uma linha vence; quem não tem a vez mas ameaça duas casas
   * vence no lance seguinte (o adversário só bloqueia uma).
   */
  const evaluate = (b, turn, ply) => {
    const scan = scanPosition(b, config, player);
    if (misere) return -scan.score;
    const playerToMove = turn === player;
    const [own, other] = playerToMove ? [scan.mine, scan.theirs] : [scan.theirs, scan.mine];
    const sign = playerToMove ? 1 : -1;
    if (own.size) return sign * (WIN_SCORE - ply - 1);
    if (other.size >= 2) return -sign * (WIN_SCORE - ply - 2);
    return scan.score;
  };

  function search(b, turn, remaining, alpha, beta, ply, lastMove, empties) {
    nodes += 1;
    if ((nodes & 255) === 0 && performance.now() > deadline) throw TIMEOUT;

    const mover = opponent(turn);
    if (findWinningLine(b, lastMove, mover, config)) {
      const winnerMark = misere ? turn : mover;
      return winnerMark === player ? WIN_SCORE - ply : ply - WIN_SCORE;
    }
    if (empties === 0) return 0;
    if (remaining <= 0) return evaluate(b, turn, ply);

    const alphaStart = alpha;
    const betaStart = beta;
    const key = useTable ? `${b.map((v) => v ?? '.').join('')}${turn}` : '';
    let preferred = -1;
    if (useTable) {
      const entry = table.get(key);
      if (entry) {
        preferred = entry.move;
        if (entry.depth >= remaining) {
          if (entry.flag === EXACT) return entry.value;
          if (entry.flag === LOWER) alpha = Math.max(alpha, entry.value);
          else beta = Math.min(beta, entry.value);
          if (alpha >= beta) return entry.value;
        }
      }
    }

    const maximizing = turn === player;
    let value = maximizing ? -Infinity : Infinity;
    let best = -1;
    for (const move of moveFirst(candidateMoves(b, config), preferred)) {
      b[move] = turn;
      const score = search(b, mover, remaining - 1, alpha, beta, ply + 1, move, empties - 1);
      b[move] = null;
      if (maximizing) {
        if (score > value) {
          value = score;
          best = move;
        }
        alpha = Math.max(alpha, value);
      } else {
        if (score < value) {
          value = score;
          best = move;
        }
        beta = Math.min(beta, value);
      }
      if (alpha >= beta) break;
    }

    if (useTable) {
      // Um valor obtido com corte é só um limite; gravá-lo como exato corrompe buscas futuras.
      let flag = EXACT;
      if (value <= alphaStart) flag = UPPER;
      else if (value >= betaStart) flag = LOWER;
      table.set(key, { depth: remaining, value, flag, move: best });
    }
    return value;
  }

  const empties = board.reduce((count, cell) => count + (cell === null ? 1 : 0), 0);
  const rootMoves = candidateMoves(board, config);
  const result = {
    move: rootMoves[0] ?? -1,
    score: 0,
    candidates: [],
    depth: 0,
    nodes: 0,
    elapsedMs: 0,
    exact: false,
  };
  if (!rootMoves.length) return result;

  const maxDepth = Math.min(Math.max(1, depth), empties);
  for (let current = 1; current <= maxDepth; current += 1) {
    try {
      const candidates = [];
      for (const move of moveFirst(rootMoves, result.move)) {
        const scratch = board.slice();
        scratch[move] = player;
        const score = search(
          scratch,
          opponent(player),
          current - 1,
          -Infinity,
          Infinity,
          1,
          move,
          empties - 1,
        );
        candidates.push({ index: move, score });
      }
      candidates.sort((a, b) => b.score - a.score);
      result.move = candidates[0].index;
      result.score = candidates[0].score;
      result.candidates = candidates;
      result.depth = current;
      // Busca até o fim do jogo = resultado exato.
      result.exact = current >= empties;
      // Vitória forçada já encontrada, ou lance único: aprofundar não muda a escolha.
      if (result.score >= DECIDED_SCORE || rootMoves.length === 1) break;
    } catch (error) {
      if (error !== TIMEOUT) throw error;
      break;
    }
  }
  result.nodes = nodes;
  result.elapsedMs = performance.now() - started;
  return result;
}
