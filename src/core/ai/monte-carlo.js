import { opponent } from '../engine/board.js';
import { findWinningLine } from '../engine/win.js';
import { completesLine, positionalScore } from './evaluate.js';
import { candidateMoves } from './minimax.js';

/** Recompensa em [0, 1] do ponto de vista de `player` para um vencedor (ou null = empate). */
export function rewardFor(winnerMark, player) {
  if (winnerMark === null) return 0.5;
  return winnerMark === player ? 1 : 0;
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

/**
 * Simulação (playout) usada pelo MCTS: joga até o fim, ou até `maxPlies`, com uma política leve.
 * - Clássica/Gravity: vence se puder, bloqueia se precisar, senão sorteia.
 * - Misère: evita completar a própria linha enquanto houver alternativa.
 * Se estourar `maxPlies`, a posição é estimada pela avaliação estática.
 * O tabuleiro recebido é alterado (passe uma cópia).
 */
export function rollout(board, config, toMove, player, rng = Math.random, maxPlies = 30) {
  const misere = config.variant === 'misere';
  let turn = toMove;
  for (let ply = 0; ply < maxPlies; ply += 1) {
    const moves = candidateMoves(board, config);
    if (!moves.length) return 0.5;

    let choice;
    if (misere) {
      const safe = moves.filter((move) => !completesLine(board, move, turn, config));
      choice = pick(safe.length ? safe : moves, rng);
    } else {
      const them = opponent(turn);
      choice = moves.find((move) => completesLine(board, move, turn, config)) ?? -1;
      if (choice < 0) choice = moves.find((move) => completesLine(board, move, them, config)) ?? -1;
      if (choice < 0) choice = pick(moves, rng);
    }

    board[choice] = turn;
    if (findWinningLine(board, choice, turn, config)) {
      return rewardFor(misere ? opponent(turn) : turn, player);
    }
    turn = opponent(turn);
  }
  const score = positionalScore(board, config, player) * (misere ? -1 : 1);
  return 1 / (1 + Math.exp(-score / (config.size * config.winLength * 4)));
}
