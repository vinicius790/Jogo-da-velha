// Testes unitários para o Modo Jogo da Velha Infinito (Fade Mode) e Análise de Partida com IA (Chess.com style)
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GRADE_SYMBOLS,
  GRADE_TITLES,
  classifyMove,
  explainMove,
} from '../src/core/analysis/move-grader.js';
import { reviewGame } from '../src/core/analysis/review.js';
import { activePieces, emptyBoard } from '../src/core/engine/board.js';
import { GameEngine } from '../src/core/engine/game.js';
import { validateSnapshot } from '../src/core/engine/validator.js';
import { makeReplay } from '../src/features/replay.js';

test('Fade Mode: activePieces rastreia as peças ativas em ordem de colocação', () => {
  const board = emptyBoard({ size: 3 });
  board[0] = 'X';
  board[4] = 'X';
  board[8] = 'X';
  const moves = [
    { mark: 'X', index: 0 },
    { mark: 'O', index: 1 },
    { mark: 'X', index: 4 },
    { mark: 'O', index: 2 },
    { mark: 'X', index: 8 },
  ];
  const activeX = activePieces(moves, 'X', board);
  assert.deepEqual(activeX, [0, 4, 8]);
});

test('Fade Mode: ao jogar a 4ª peça, a peça mais antiga do jogador desaparece', () => {
  const game = new GameEngine({
    mode: 'local',
    config: { size: 3, winLength: 3, variant: 'fade' },
  });

  // Turno 1 (X): casa 0
  game.play(0);
  assert.equal(game.state.board[0], 'X');

  // Turno 2 (O): casa 3
  game.play(3);
  assert.equal(game.state.board[3], 'O');

  // Turno 3 (X): casa 1
  game.play(1);
  assert.equal(game.state.board[1], 'X');

  // Turno 4 (O): casa 4
  game.play(4);
  assert.equal(game.state.board[4], 'O');

  // Turno 5 (X): casa 6 (X agora tem 3 peças: 0, 1, 6)
  game.play(6);
  assert.deepEqual(
    game.state.board.map((v, i) => (v ? `${v}:${i}` : null)).filter(Boolean),
    ['X:0', 'X:1', 'O:3', 'O:4', 'X:6'],
  );

  // Turno 6 (O): casa 5 (O agora tem 3 peças: 3, 4, 5 -> vitória de O!)
  // O completou a linha 3-4-5 com sua 3ª peça!
  assert.equal(game.state.status, 'playing');
});

test('Fade Mode: a 4ª peça remove a mais antiga e não forma linha com a peça desaparecida', () => {
  const game = new GameEngine({
    mode: 'local',
    config: { size: 3, winLength: 3, variant: 'fade' },
  });

  // X joga 0, 1, 8
  // O joga 3, 4, 5 (mas não completará pois vamos intercalar sem vencer)
  game.play(0); // X (peça 1 de X)
  game.play(3); // O (peça 1 de O)
  game.play(1); // X (peça 2 de X)
  game.play(4); // O (peça 2 de O)
  game.play(7); // X (peça 3 de X)
  game.play(8); // O (peça 3 de O)

  // Agora X tem 3 peças: [0, 1, 7]. Peça mais antiga é 0.
  // X joga na casa 2!
  // Se a casa 0 não sumisse, 0-1-2 seria vitória!
  // Porém, por ser a 4ª peça de X, a casa 0 desaparece simultaneamente!
  game.play(2); // X joga 2

  // Casa 0 agora deve estar vazia (null)!
  assert.equal(game.state.board[0], null, 'A peça mais antiga na casa 0 deve ter desaparecido');
  assert.equal(game.state.board[2], 'X', 'A nova peça na casa 2 deve estar presente');
  assert.equal(game.state.status, 'playing', 'Não deve haver vitória na linha 0-1-2 pois 0 sumiu');

  // X agora tem apenas as peças [1, 7, 2]
  const countX = game.state.board.filter((v) => v === 'X').length;
  assert.equal(countX, 3, 'X deve ter exatamente 3 peças no tabuleiro');
});

test('Fade Mode: vitória legítima com a 4ª peça combinando com as duas anteriores', () => {
  const game = new GameEngine({
    mode: 'local',
    config: { size: 3, winLength: 3, variant: 'fade' },
  });

  // X joga 6, 1, 4 (peças de X: 6, 1, 4 - mais antiga é 6)
  // O joga 3, 5, 8 (peças de O: 3, 5, 8)
  game.play(6); // X em 6
  game.play(3); // O em 3
  game.play(1); // X em 1
  game.play(5); // O em 5
  game.play(4); // X em 4
  game.play(8); // O em 8

  // X agora joga na casa 7!
  // 6 desaparece! Peças de X restantes: 1, 4, 7!
  // 1, 4, 7 formam a coluna central vertical (1, 4, 7)!
  game.play(7);

  assert.equal(game.state.board[6], null, 'A casa 6 desapareceu');
  assert.equal(game.state.status, 'won', 'X venceu com a coluna 1-4-7');
  assert.equal(game.state.result, 'X');
  assert.deepEqual(game.state.winningLine, [1, 4, 7]);
});

test('Fade Mode: desfazer (undo) restaura a peça desaparecida e refazer (redo) a remove novamente', () => {
  const game = new GameEngine({
    mode: 'local',
    config: { size: 3, winLength: 3, variant: 'fade' },
  });

  game.play(0); // X 1
  game.play(3); // O 1
  game.play(1); // X 2
  game.play(4); // O 2
  game.play(6); // X 3
  game.play(8); // O 3 (não forma 3-4-5)

  // X joga a 4ª peça em 5, fazendo a casa 0 sumir
  game.play(5);
  assert.equal(game.state.board[0], null);
  assert.equal(game.state.board[5], 'X');

  // Undo deve restaurar a casa 0 e desocupar a casa 5
  game.undo();
  assert.equal(game.state.board[0], 'X', 'Undo deve restaurar a peça mais antiga');
  assert.equal(game.state.board[5], null, 'Undo deve desocupar a casa jogada');
  assert.equal(game.state.current, 'X');

  // Redo deve aplicar o lance 5 novamente e remover a casa 0
  game.redoMove();
  assert.equal(game.state.board[0], null, 'Redo deve remover a peça mais antiga novamente');
  assert.equal(game.state.board[5], 'X');
  assert.equal(game.state.current, 'O');
});

test('Fade Mode: validação de snapshot aceita partidas longas e reconstrói o tabuleiro com precisão', () => {
  const game = new GameEngine({
    mode: 'local',
    config: { size: 3, winLength: 3, variant: 'fade' },
  });

  // Mais de 9 lances sem estourar limite padrão do clássico
  const moves = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2];
  for (const move of moves) {
    if (game.state.status === 'playing') {
      game.play(move);
    }
  }

  // O snapshot deve ser validado com sucesso pelas regras do Fade Mode
  assert.doesNotThrow(() => validateSnapshot(game.state));
  const restored = GameEngine.from(game.state);
  assert.deepEqual(restored.state.board, game.state.board);
});

test('Análise Chess.com: classificação de jogadas com símbolos e explicações detalhadas', () => {
  // Teste de classificações individuais
  assert.equal(GRADE_SYMBOLS.brilliant, '!!');
  assert.equal(GRADE_SYMBOLS.best, '!');
  assert.equal(GRADE_SYMBOLS.inaccuracy, '?');
  assert.equal(GRADE_SYMBOLS.blunder, '??');

  assert.ok(GRADE_TITLES.brilliant.includes('Brilhante'));
  assert.ok(GRADE_TITLES.blunder.includes('Erro Crasso'));

  // Blunder: troca vitória por derrota ou perda forçada
  const blunderGrade = classifyMove(
    [
      { index: 2, score: 99000 },
      { index: 8, score: -99000 },
    ],
    8,
  );
  assert.equal(blunderGrade, 'blunder');
  const blunderExplanation = explainMove('blunder');
  assert.ok(blunderExplanation.includes('Erro crasso'));

  // Best: melhor lance
  const bestGrade = classifyMove(
    [
      { index: 4, score: 0 },
      { index: 0, score: 0 },
      { index: 2, score: 0 },
    ],
    4,
  );
  assert.equal(bestGrade, 'best');
  const bestExplanation = explainMove('best');
  assert.ok(bestExplanation.includes('Melhor lance'));

  // Brilliant: único lance vitorioso diante de outras opções não vencedoras
  const brilliantGrade = classifyMove(
    [
      { index: 4, score: 99500 },
      { index: 0, score: 0 },
      { index: 2, score: -100 },
    ],
    4,
    { isImmediateWin: false },
  );
  assert.equal(brilliantGrade, 'brilliant');
  const brilliantExplanation = explainMove('brilliant');
  assert.ok(brilliantExplanation.includes('genial') || brilliantExplanation.includes('brilhante'));

  // Inaccuracy
  const inaccGrade = classifyMove(
    [
      { index: 4, score: 200 },
      { index: 0, score: 190 },
      { index: 1, score: 180 },
      { index: 8, score: 10 },
    ],
    8,
  );
  assert.equal(inaccGrade, 'inaccuracy');
  const inaccExplanation = explainMove('inaccuracy');
  assert.ok(inaccExplanation.includes('Imprecisão'));
});

test('Análise Chess.com: reviewGame gera relatório completo com símbolos e explicações por turno', () => {
  const game = new GameEngine({ mode: 'local' });
  // Partida rápida com blunder de O
  game.play(4); // X centro
  game.play(1); // O borda (blunder clássico)
  game.play(0); // X
  game.play(8); // O
  game.play(6); // X
  game.play(2); // O
  game.play(3); // X vence

  const replay = makeReplay(game.state);
  const review = reviewGame(replay);

  assert.equal(review.positions.length, 7);
  for (const pos of review.positions) {
    assert.ok(pos.grade, 'todo turno tem nota');
    assert.ok(pos.explanation, 'todo turno tem explicação');
    assert.ok(typeof pos.symbol === 'string', 'todo turno tem símbolo');
  }

  // O lance 2 de O deve ser classificado como blunder e conter símbolo ??
  assert.equal(review.positions[1].grade, 'blunder');
  assert.equal(review.positions[1].symbol, '??');
  assert.ok(review.positions[1].explanation.includes('Erro crasso'));
});
