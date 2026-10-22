import { opponent } from '../engine/board.js';
import { findWinningLine } from '../engine/win.js';
import { candidateMoves } from './minimax.js';
import { rewardFor, rollout } from './monte-carlo.js';

function createNode(board, turn, move, config, player) {
  // `move` foi jogado por quem NÃO tem a vez neste nó.
  let terminal = null;
  let unexpanded = [];
  if (move !== null && findWinningLine(board, move, opponent(turn), config)) {
    const mover = opponent(turn);
    terminal = rewardFor(config.variant === 'misere' ? turn : mover, player);
  } else {
    unexpanded = candidateMoves(board, config);
    if (!unexpanded.length) terminal = 0.5;
  }
  return { board, turn, move, terminal, unexpanded, children: [], visits: 0, value: 0 };
}

/**
 * Monte Carlo Tree Search com UCT.
 * `value` acumula a recompensa do ponto de vista de `player`; na seleção, nós em que a vez é do
 * adversário usam o complemento (1 - média), de modo que cada lado escolhe o que é melhor para si.
 * `rootMoves` permite restringir a raiz a um subconjunto de lances (usado pelo modo híbrido).
 */
export function mcts(
  board,
  config,
  player,
  {
    iterations = 5000,
    timeBudgetMs = 400,
    exploration = 1.2,
    rng = Math.random,
    rootMoves = null,
  } = {},
) {
  const started = performance.now();
  const deadline = started + timeBudgetMs;
  const root = createNode(board.slice(), player, null, config, player);
  if (rootMoves) root.unexpanded = root.unexpanded.filter((move) => rootMoves.includes(move));
  if (!root.unexpanded.length) {
    return { move: -1, score: 0.5, candidates: [], iterations: 0, nodes: 1, elapsedMs: 0 };
  }

  const empties = board.reduce((count, cell) => count + (cell === null ? 1 : 0), 0);
  const maxPlies = Math.min(empties, 30);
  let completed = 0;
  let nodes = 1;

  // Ao menos uma iteração, para sempre haver um lance a devolver.
  while (completed === 0 || (completed < iterations && performance.now() < deadline)) {
    let node = root;
    const path = [node];

    // Seleção: desce enquanto o nó estiver totalmente expandido.
    while (node.terminal === null && !node.unexpanded.length) {
      const logVisits = Math.log(node.visits);
      let selected = null;
      let bestUcb = -Infinity;
      for (const child of node.children) {
        const mean = child.value / child.visits;
        const exploit = node.turn === player ? mean : 1 - mean;
        const ucb = exploit + exploration * Math.sqrt(logVisits / child.visits);
        if (ucb > bestUcb) {
          bestUcb = ucb;
          selected = child;
        }
      }
      node = selected;
      path.push(node);
    }

    // Expansão: cria um filho para um lance ainda não tentado.
    if (node.terminal === null) {
      const position = Math.floor(rng() * node.unexpanded.length);
      const [move] = node.unexpanded.splice(position, 1);
      const nextBoard = node.board.slice();
      nextBoard[move] = node.turn;
      const child = createNode(nextBoard, opponent(node.turn), move, config, player);
      node.children.push(child);
      nodes += 1;
      node = child;
      path.push(node);
    }

    // Simulação e retropropagação.
    const reward =
      node.terminal ?? rollout(node.board.slice(), config, node.turn, player, rng, maxPlies);
    for (const visited of path) {
      visited.visits += 1;
      visited.value += reward;
    }
    completed += 1;
  }

  const candidates = root.children
    .map((child) => ({
      index: child.move,
      score: child.value / child.visits,
      visits: child.visits,
    }))
    .sort((a, b) => b.visits - a.visits || b.score - a.score);
  return {
    move: candidates[0].index,
    score: candidates[0].score,
    candidates,
    iterations: completed,
    nodes,
    elapsedMs: performance.now() - started,
  };
}
