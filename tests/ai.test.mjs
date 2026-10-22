import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseMove } from '../src/core/ai/engine.js';
import { mcts } from '../src/core/ai/mcts.js';
import { probe3x3 } from '../src/core/ai/tablebase3x3.js';
import { DIFFICULTY, DIFFICULTY_ALIASES, DIFFICULTY_LEVELS } from '../src/core/constants.js';
import { legalMoves } from '../src/core/engine/board.js';
import { GameEngine } from '../src/core/engine/game.js';
import { playArena } from '../src/features/analytics.js';
import { seededRng } from '../src/features/puzzles.js';

const classic = { size: 3, winLength: 3, variant: 'classic' };
const never = () => 0.99; // rng que nunca aciona o erro deliberado
const always = () => 0; // rng que sempre aciona (para níveis com blunder > 0)

test('IA joga a vitória imediata', () => {
  const board = ['X', 'X', null, 'O', null, 'O', null, null, null];
  const verdict = chooseMove({ board, config: classic, player: 'X', difficulty: 'expert' });
  assert.equal(verdict.move, 2);
  assert.equal(verdict.algorithm, 'tactical');
});

test('IA bloqueia a derrota imediata', () => {
  const board = ['O', 'O', null, 'X', null, null, null, null, 'X'];
  const verdict = chooseMove({ board, config: classic, player: 'X', difficulty: 'expert' });
  assert.equal(verdict.move, 2);
});

test('regressão: cada nível tem parâmetros de força diferentes e crescentes', () => {
  const levels = DIFFICULTY_LEVELS.map((name) => DIFFICULTY[name]);
  for (let i = 1; i < levels.length; i += 1) {
    assert.ok(levels[i].depth > levels[i - 1].depth, 'profundidade cresce');
    assert.ok(levels[i].blunder <= levels[i - 1].blunder, 'erro deliberado não cresce');
  }
  assert.ok(DIFFICULTY.easy.blunder > 0);
  assert.equal(DIFFICULTY.expert.blunder, 0);
  assert.equal(DIFFICULTY.omega.blunder, 0);
});

test('regressão: o erro deliberado do nível é realmente aplicado (era ignorado)', () => {
  // X tem vitória imediata na casa 5. Com o rng forçando o erro, o Fácil sorteia outro lance.
  const board = ['O', null, null, 'X', 'X', null, 'O', null, null];
  const blunder = chooseMove({
    board,
    config: classic,
    player: 'X',
    difficulty: 'easy',
    rng: always,
  });
  assert.equal(blunder.algorithm, 'random');
  assert.equal(blunder.move, legalMoves(board, classic)[0]);
  assert.notEqual(blunder.move, 5);

  const focused = chooseMove({
    board,
    config: classic,
    player: 'X',
    difficulty: 'easy',
    rng: never,
  });
  assert.equal(focused.move, 5);

  // Níveis sem erro deliberado ignoram o rng "azarado".
  const expert = chooseMove({
    board,
    config: classic,
    player: 'X',
    difficulty: 'expert',
    rng: always,
  });
  assert.equal(expert.move, 5);
});

test('regressão: no 3×3 o Fácil perde partidas e o Especialista nunca perde', () => {
  const rng = seededRng(2026);
  const asX = playArena({ games: 60, config: classic, x: 'expert', o: 'easy', rng });
  const asO = playArena({ games: 60, config: classic, x: 'easy', o: 'expert', rng });
  assert.equal(asX.o + asO.x, 0, 'o Especialista não pode perder no 3×3');
  assert.ok(asX.x + asO.o >= 20, `o Fácil deveria perder com frequência (perdeu ${asX.x + asO.o})`);
});

test('regressão: os níveis intermediários ficam entre o Fácil e o Especialista', () => {
  const rng = seededRng(7);
  const lossesAgainstExpert = (level) => {
    const asX = playArena({ games: 80, config: classic, x: 'expert', o: level, rng });
    const asO = playArena({ games: 80, config: classic, x: level, o: 'expert', rng });
    return asX.x + asO.o;
  };
  const easy = lossesAgainstExpert('easy');
  const normal = lossesAgainstExpert('normal');
  const hard = lossesAgainstExpert('hard');
  assert.ok(easy > normal, `Fácil (${easy}) deve perder mais que Normal (${normal})`);
  assert.ok(normal > hard, `Normal (${normal}) deve perder mais que Difícil (${hard})`);
});

test('Especialista e OMEGA usam a solução exata no 3×3 clássico', () => {
  const board = Array(9).fill(null);
  for (const difficulty of ['expert', 'omega']) {
    const verdict = chooseMove({ board, config: classic, player: 'X', difficulty });
    assert.equal(verdict.algorithm, 'tablebase');
    assert.equal(verdict.exact, true);
    assert.equal(verdict.score, 0, 'o 3×3 é empate com jogo perfeito');
  }
  const hard = chooseMove({ board, config: classic, player: 'X', difficulty: 'hard', rng: never });
  assert.equal(hard.algorithm, 'alpha-beta');
});

test('tablebase: resultado, distância e todos os lances ótimos', () => {
  const winning = probe3x3(['X', 'X', null, 'O', null, null, null, null, 'O'], 'X');
  assert.equal(winning.outcome, 1);
  assert.equal(winning.distance, 1);
  assert.deepEqual(winning.moves, [2]);

  const opening = probe3x3(Array(9).fill(null), 'X');
  assert.equal(opening.outcome, 0);
  assert.equal(opening.moves.length, 9, 'todo primeiro lance mantém o empate');

  // Depois de X no canto, só o centro salva O.
  const reply = probe3x3(['X', null, null, null, null, null, null, null, null], 'O');
  assert.deepEqual(reply.moves, [4]);
  assert.equal(probe3x3([1, 2, 3], 'X'), null);
});

test('regressão: o MCTS é usado de fato pelo nível OMEGA fora do 3×3', () => {
  const config = { size: 5, winLength: 4, variant: 'classic' };
  const board = Array(25).fill(null);
  board[12] = 'X';
  const verdict = chooseMove({
    board,
    config,
    player: 'O',
    difficulty: 'omega',
    rng: seededRng(3),
  });
  assert.equal(verdict.algorithm, 'alpha-beta+mcts');
  assert.ok(verdict.iterations > 0);
  assert.equal(board[verdict.move], null);
  assert.ok(verdict.reasons.some((reason) => reason.key === 'reason.mcts'));

  const expert = chooseMove({ board, config, player: 'O', difficulty: 'expert' });
  assert.equal(expert.algorithm, 'alpha-beta');
});

test('MCTS encontra a vitória e o bloqueio óbvios', () => {
  const config = { size: 4, winLength: 4, variant: 'classic' };
  const board = Array(16).fill(null);
  [0, 1, 2].forEach((cell) => (board[cell] = 'X'));
  [4, 5, 8].forEach((cell) => (board[cell] = 'O'));
  const win = mcts(board, config, 'X', { iterations: 400, timeBudgetMs: 2000, rng: seededRng(1) });
  assert.equal(win.move, 3);
  const block = mcts(board, config, 'O', {
    iterations: 800,
    timeBudgetMs: 3000,
    rng: seededRng(1),
  });
  assert.equal(block.move, 3);
});

test('MCTS respeita a restrição de lances da raiz e sempre devolve lance legal', () => {
  const config = { size: 6, winLength: 4, variant: 'gravity' };
  const board = Array(36).fill(null);
  const result = mcts(board, config, 'X', {
    iterations: 60,
    timeBudgetMs: 500,
    rootMoves: [32, 33],
    rng: seededRng(9),
  });
  assert.ok([32, 33].includes(result.move));
  assert.ok(result.candidates.every((candidate) => [32, 33].includes(candidate.index)));
});

test('todos os níveis devolvem lance legal em todas as variantes e em tabuleiro grande', () => {
  for (const variant of ['classic', 'misere', 'gravity']) {
    const config = { size: 4, winLength: 3, variant };
    const game = new GameEngine({ mode: 'local', config });
    game.play(5);
    const { board } = game.state;
    for (const difficulty of DIFFICULTY_LEVELS) {
      const verdict = chooseMove({ board, config, player: 'O', difficulty });
      assert.ok(legalMoves(board, config).includes(verdict.move), `${variant}/${difficulty}`);
    }
  }
  const big = { size: 12, winLength: 5, variant: 'classic' };
  const board = Array(144).fill(null);
  board[65] = 'X';
  const verdict = chooseMove({ board, config: big, player: 'O', difficulty: 'hard', rng: never });
  assert.equal(board[verdict.move], null);
});

test('sem lances legais, o veredito indica isso em vez de quebrar', () => {
  const verdict = chooseMove({ board: Array(9).fill('X'), config: classic, player: 'O' });
  assert.equal(verdict.move, -1);
  assert.equal(verdict.algorithm, 'none');
});

test('DIFFICULTY_ALIASES suporta Fácil, Médio, Imbatível e suas variações', () => {
  assert.equal(DIFFICULTY_ALIASES.facil, 'easy');
  assert.equal(DIFFICULTY_ALIASES.easy, 'easy');
  assert.equal(DIFFICULTY_ALIASES.medio, 'normal');
  assert.equal(DIFFICULTY_ALIASES.medium, 'normal');
  assert.equal(DIFFICULTY_ALIASES.imbativel, 'omega');
  assert.equal(DIFFICULTY_ALIASES.unbeatable, 'omega');

  const board = ['X', 'X', null, 'O', null, 'O', null, null, null];
  for (const diff of ['facil', 'easy', 'medio', 'medium', 'normal', 'imbativel', 'unbeatable', 'omega']) {
    const verdict = chooseMove({ board, config: classic, player: 'X', difficulty: diff, rng: never });
    assert.ok(legalMoves(board, classic).includes(verdict.move), `lance legal para ${diff}`);
    assert.equal(verdict.move, 2, `vence imediatamente no lance 2 em ${diff}`);
  }
});

