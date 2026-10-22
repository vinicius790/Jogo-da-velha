// Relógio, variante hexagonal, ranking local e análise pós-jogo.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseMove } from '../src/core/ai/engine.js';
import { scanPosition } from '../src/core/ai/evaluate.js';
import { WIN_SCORE, alphaBeta, candidateMoves, cellDistance } from '../src/core/ai/minimax.js';
import { nextMistake, reviewGame } from '../src/core/analysis/review.js';
import { VARIANTS } from '../src/core/constants.js';
import { directionsFor, legalMoves } from '../src/core/engine/board.js';
import { clockView, createClock, isFlagged, sanitizeClock } from '../src/core/engine/clock.js';
import { GameEngine } from '../src/core/engine/game.js';
import { validateSnapshot } from '../src/core/engine/validator.js';
import { findWinningLine, winner } from '../src/core/engine/win.js';
import { decodeMoves, notationForGame } from '../src/core/notation.js';
import { decodeState, encodeState } from '../src/core/serialization/share.js';
import { applyGameResult } from '../src/features/progression.js';
import { PUZZLE_CONFIGS, generatePuzzle } from '../src/features/puzzles.js';
import {
  parseRankingKey,
  rankingKey,
  rankingRows,
  recordRanking,
  sanitizeRanking,
} from '../src/features/ranking.js';
import { makeReplay, replayFrame, validateReplay } from '../src/features/replay.js';
import { defaultProfile, sanitizeProfile } from '../src/state/profile.js';
import { TASKS } from '../src/workers/tasks.js';

const HEX4 = { size: 4, winLength: 3, variant: 'hex' };
const T0 = 1_000_000;

function played(options, moves) {
  const game = new GameEngine(options);
  for (const move of moves) game.play(move);
  return game;
}

// ---------- Variante hexagonal ----------

test('hex: a variante existe e usa três direções de linha', () => {
  assert.ok(VARIANTS.includes('hex'));
  assert.equal(directionsFor(HEX4).length, 3);
  assert.equal(directionsFor({ size: 4, winLength: 3, variant: 'classic' }).length, 4);
});

test('hex: vitória nos três eixos (linha, coluna e antidiagonal)', () => {
  const cases = [
    { moves: [0, 4, 1, 5, 2], line: [0, 1, 2] }, // mesma linha
    { moves: [0, 1, 4, 2, 8], line: [0, 4, 8] }, // mesma coluna
    { moves: [2, 0, 5, 1, 8], line: [2, 5, 8] }, // antidiagonal: casas vizinhas no hexágono
  ];
  for (const { moves, line } of cases) {
    const state = played({ mode: 'local', config: HEX4 }, moves).state;
    assert.equal(state.status, 'won', moves.join());
    assert.equal(state.result, 'X');
    assert.deepEqual(state.winningLine, line);
  }
});

test('hex: a diagonal principal do tabuleiro quadrado não é uma linha', () => {
  // 0, 5, 10 ficam alinhados no quadrado, mas não são vizinhos no hexagonal.
  const moves = [0, 1, 5, 2, 10];
  const hex = played({ mode: 'local', config: HEX4 }, moves).state;
  assert.equal(hex.status, 'playing');
  assert.equal(findWinningLine(hex.board, 10, 'X', HEX4), null);
  const classic = played({ mode: 'local', config: { ...HEX4, variant: 'classic' } }, moves).state;
  assert.equal(classic.status, 'won');
});

test('hex: validador, notação e link de compartilhamento aceitam a variante', () => {
  const game = played({ mode: 'local', config: HEX4 }, [2, 0, 5, 1, 8]);
  assert.equal(validateSnapshot(game.state), true);
  const notation = notationForGame(game.state);
  assert.equal(notation, 'XC1-OA1-XB2-OB1-XA3');
  const decoded = decodeMoves(notation, HEX4);
  assert.equal(decoded.result, 'X');
  assert.deepEqual(decoded.winningLine, [2, 5, 8]);
  assert.equal(GameEngine.from(decodeState(encodeState(game.state))).state.config.variant, 'hex');
  // Um snapshot que declara vitória pela diagonal do quadrado é rejeitado.
  const forged = played({ mode: 'local', config: HEX4 }, [0, 1, 5, 2, 10]).state;
  Object.assign(forged, { status: 'won', result: 'X', winningLine: [0, 5, 10] });
  assert.throws(() => validateSnapshot(forged), { code: 'invalid-snapshot' });
});

test('hex: a avaliação e a IA enxergam só os eixos hexagonais', () => {
  const board = Array(16).fill(null);
  board[0] = 'X';
  board[5] = 'X'; // diagonal do quadrado: no hexagonal não ameaça nada
  assert.equal(scanPosition(board, HEX4, 'X').mine.size, 0);
  assert.ok(scanPosition(board, { ...HEX4, variant: 'classic' }, 'X').mine.has(10));

  const attack = Array(16).fill(null);
  attack[2] = 'X';
  attack[5] = 'X'; // antidiagonal: falta a casa 8
  attack[0] = 'O';
  attack[1] = 'O'; // O não ameaça nada: a casa 2 já é de X
  const ask = (player, difficulty) =>
    chooseMove({ board: attack, config: HEX4, player, difficulty, rng: () => 0.99 }).move;
  for (const difficulty of ['hard', 'expert', 'omega']) {
    assert.equal(ask('X', difficulty), 8, difficulty);
  }
  assert.equal(ask('O', 'expert'), 8, 'O bloqueia a antidiagonal');
});

test('hex: IA × IA termina com um estado válido em vários tamanhos', () => {
  for (const config of [HEX4, { size: 5, winLength: 4, variant: 'hex' }]) {
    const game = new GameEngine({ mode: 'spectator', config });
    while (game.state.status === 'playing') {
      const { board, current } = game.state;
      const verdict = chooseMove({ board, config, player: current, difficulty: 'normal' });
      assert.ok(legalMoves(board, config).includes(verdict.move));
      game.play(verdict.move);
    }
    assert.equal(validateSnapshot(game.state), true);
  }
});

// ---------- Relógio ----------

test('relógio: sem limites não há relógio; limites são normalizados', () => {
  assert.equal(createClock(null), null);
  assert.equal(createClock({ moveMs: 0, gameMs: 0 }), null);
  assert.equal(new GameEngine().state.clock, null);
  const clock = createClock({ moveMs: 5000.7, gameMs: -3 }, T0);
  assert.deepEqual(clock, {
    moveMs: 5000,
    gameMs: 0,
    remaining: { X: 0, O: 0 },
    turnStartedAt: T0,
  });
  assert.equal(createClock({ moveMs: 1e12, gameMs: 1 }).moveMs, 600_000);
});

test('relógio: tempo por partida é descontado de quem jogou', () => {
  const game = new GameEngine({ mode: 'local', clock: { gameMs: 60_000 } });
  game.resumeClock(T0);
  game.play(0, T0 + 10_000);
  game.play(1, T0 + 15_000);
  const { clock } = game.state;
  assert.deepEqual(clock.remaining, { X: 50_000, O: 55_000 });
  assert.deepEqual(game.timeLeft(T0 + 16_000), { move: null, game: 49_000 });
  const view = clockView(clock, 'X', T0 + 16_000);
  assert.equal(view.X.game, 49_000);
  assert.equal(view.O.game, 55_000);
});

test('relógio: estourar o tempo por lance dá a vitória ao adversário', () => {
  const game = new GameEngine({ mode: 'local', clock: { moveMs: 5000 } });
  game.resumeClock(T0);
  game.play(4, T0 + 4999);
  assert.equal(game.checkClock(T0 + 9000).status, 'playing');
  const state = game.checkClock(T0 + 4999 + 5000);
  assert.equal(state.status, 'won');
  assert.equal(state.result, 'X', 'O deixou o tempo acabar');
  assert.equal(state.endReason, 'timeout');
  assert.equal(state.winningLine, null);
  assert.equal(validateSnapshot(state), true);
  assert.throws(() => game.play(0), { code: 'game-over' });
  assert.equal(game.undo().status, 'won', 'derrota no relógio não é desfeita');
});

test('relógio: lance depois do tempo é recusado e encerra a partida', () => {
  const game = new GameEngine({ mode: 'local', clock: { gameMs: 1000 } });
  game.resumeClock(T0);
  assert.throws(() => game.play(0, T0 + 1000), { code: 'time-expired' });
  const state = game.state;
  assert.equal(state.moves.length, 0);
  assert.equal(state.result, 'O');
  assert.equal(state.endReason, 'timeout');
});

test('relógio: no Misère quem estoura o tempo também perde', () => {
  const game = new GameEngine({
    mode: 'local',
    config: { size: 3, winLength: 3, variant: 'misere' },
    clock: { moveMs: 1000 },
  });
  game.resumeClock(T0);
  assert.equal(game.checkClock(T0 + 1000).result, 'O');
});

test('relógio: snapshot com relógio é restaurado; derrota por tempo forjada é rejeitada', () => {
  const game = new GameEngine({ mode: 'ai', clock: { moveMs: 30_000, gameMs: 60_000 } });
  game.resumeClock(T0);
  game.play(0, T0 + 5000);
  const restored = GameEngine.from(JSON.parse(JSON.stringify(game.state)));
  assert.deepEqual(restored.state.clock, game.state.clock);
  restored.resumeClock(T0 + 999_999);
  assert.equal(isFlagged(restored.state.clock, 'O', T0 + 999_999), false, 'retomada não pune');

  assert.deepEqual(
    sanitizeClock({ moveMs: 1000, gameMs: 5000, remaining: { X: 9e9, O: 'x' } }, T0).remaining,
    { X: 5000, O: 5000 },
  );
  assert.equal(sanitizeClock({ moveMs: 'a' }), null);

  const timedOut = new GameEngine({ mode: 'local', clock: { moveMs: 1000 } });
  timedOut.play(0, Date.now());
  const state = timedOut.timeout();
  assert.equal(validateSnapshot(state), true);
  assert.throws(() => validateSnapshot({ ...state, result: 'O' }), { code: 'invalid-snapshot' });
  assert.throws(() => validateSnapshot({ ...state, winningLine: [0, 1, 2] }), {
    code: 'invalid-snapshot',
  });
  // Sem `endReason`, uma vitória sem linha continua sendo rejeitada.
  assert.throws(() => validateSnapshot({ ...state, endReason: null }), {
    code: 'invalid-snapshot',
  });
});

test('relógio: reset reinicia o relógio; replay guarda a derrota por tempo', () => {
  const game = new GameEngine({ mode: 'ai', clock: { gameMs: 10_000 } });
  game.resumeClock(T0);
  game.play(0, T0 + 4000);
  const lost = game.timeout(T0 + 5000);
  const replay = makeReplay(lost, 'X');
  assert.equal(replay.endReason, 'timeout');
  assert.equal(validateReplay(replay), true);
  assert.equal(replayFrame(replay, 1).result, 'X');
  assert.equal(replayFrame(replay, 0).status, 'playing');
  assert.equal(validateReplay({ ...replay, result: 'O' }), false);
  assert.deepEqual(game.reset().clock.remaining, { X: 10_000, O: 10_000 });

  const outcome = applyGameResult(defaultProfile(), lost, { player: 'X' });
  assert.equal(outcome.entry.outcome, 'win', 'vitória no relógio conta no perfil');
});

test('regressão: refazer depois do tempo encerra a partida no relógio', () => {
  // A tela de "Refazer" precisa tratar este erro como trata o de um lance comum.
  const game = new GameEngine({ mode: 'local', clock: { moveMs: 5000 } });
  game.resumeClock(T0);
  game.play(0, T0 + 1000);
  game.undo();
  game.resumeClock(T0);
  assert.equal(game.state.redo.length, 1);
  const realNow = Date.now;
  Date.now = () => T0 + 5000; // `redoMove` joga no instante atual
  try {
    assert.throws(() => game.redoMove(), { code: 'time-expired' });
  } finally {
    Date.now = realNow;
  }
  assert.deepEqual(
    [game.state.status, game.state.endReason, game.state.result],
    ['won', 'timeout', 'O'],
  );
});

test('regressão: endReason forjado em partida abortada é descartado; replay com campos inválidos é recusado', () => {
  const game = new GameEngine({ mode: 'local' });
  game.play(4);
  const aborted = { ...game.abort(), endReason: 'timeout' };
  assert.equal(validateSnapshot(aborted), true);
  assert.equal(GameEngine.from(aborted).state.endReason, null);
  assert.equal(GameEngine.from(aborted).undo().status, 'playing', 'pode desfazer como antes');

  const replay = makeReplay(played({ mode: 'local' }, [4, 0]).state, 'X');
  assert.equal(validateReplay(replay), true);
  assert.equal(validateReplay({ ...replay, player: undefined }), true, 'replays antigos');
  assert.equal(validateReplay({ ...replay, player: 'Z' }), false);
  assert.equal(validateReplay({ ...replay, endReason: 'resign' }), false);
});

// ---------- Ranking local ----------

function entry(fields = {}) {
  return {
    config: { size: 3, winLength: 3, variant: 'classic' },
    mode: 'ai',
    difficulty: 'normal',
    outcome: 'win',
    rated: true,
    moves: 5,
    durationMs: 9000,
    finishedAt: 1,
    ...fields,
  };
}

test('ranking: um quadro por tamanho de tabuleiro e variante', () => {
  assert.equal(rankingKey({ size: 5, winLength: 4, variant: 'hex' }), '5-hex');
  assert.deepEqual(parseRankingKey('12-gravity'), { size: 12, variant: 'gravity' });
  for (const bad of ['2-classic', '13-classic', '3-chess', 'x', '3-classic-1']) {
    assert.equal(parseRankingKey(bad), null, bad);
  }

  let ranking = recordRanking({}, entry(), 'Ana');
  ranking = recordRanking(ranking, entry({ outcome: 'loss', finishedAt: 2 }), 'Ana');
  ranking = recordRanking(ranking, entry({ config: HEX4, moves: 7, finishedAt: 3 }), 'Ana');
  assert.deepEqual(Object.keys(ranking).sort(), ['3-classic', '4-hex']);
  const classic = ranking['3-classic'];
  assert.equal(classic.played, 2);
  assert.equal(classic.wins, 1);
  assert.equal(classic.losses, 1);
  assert.equal(classic.streak, 0);
  assert.equal(classic.bestStreak, 1);
  assert.equal(classic.top.length, 1);
  assert.ok(ranking['4-hex'].rating > 1000);

  const rows = rankingRows(ranking);
  assert.deepEqual(
    rows.map((row) => [row.position, row.key]),
    [
      [1, '4-hex'],
      [2, '3-classic'],
    ],
  );
  assert.equal(rows[0].variant, 'hex');
});

test('ranking: Elo só muda em partida com rating; melhores vitórias ficam ordenadas', () => {
  let ranking = recordRanking({}, entry({ mode: 'online', rated: false }), 'Ana');
  assert.equal(ranking['3-classic'].rating, 1000);
  assert.equal(ranking['3-classic'].top[0].difficulty, null);
  for (const [moves, durationMs] of [
    [4, 9000],
    [3, 8000],
    [3, 2000],
    [6, 100],
    [5, 100],
    [9, 100],
  ]) {
    ranking = recordRanking(ranking, entry({ moves, durationMs }), 'Ana');
  }
  const top = ranking['3-classic'].top;
  assert.equal(top.length, 5, 'só as cinco melhores');
  assert.deepEqual(
    top.map((record) => [record.moves, record.durationMs]),
    [
      [3, 2000],
      [3, 8000],
      [4, 9000],
      [5, 100],
      [5, 9000],
    ],
  );
});

test('ranking: o perfil registra a partida no quadro certo e sobrevive à normalização', () => {
  const game = played({ mode: 'ai', config: HEX4, meta: { human: 'X' } }, [2, 0, 5, 1, 8]);
  const { profile } = applyGameResult(defaultProfile(), game.state, {
    player: 'X',
    durationMs: 4321,
    now: 77,
  });
  assert.deepEqual(Object.keys(profile.ranking), ['4-hex']);
  assert.deepEqual(profile.ranking['4-hex'].top, [
    { name: 'Omega Player', moves: 5, durationMs: 4321, difficulty: 'normal', at: 77 },
  ]);
  assert.deepEqual(sanitizeProfile(JSON.parse(JSON.stringify(profile))).ranking, profile.ranking);
  assert.deepEqual(defaultProfile().ranking, {});
  assert.deepEqual(sanitizeProfile({}).ranking, {}, 'perfil antigo, sem ranking');
});

test('ranking: entrada adulterada é descartada ou corrigida', () => {
  const clean = sanitizeRanking({
    '3-classic': {
      played: -4,
      wins: 'x',
      rating: 99999,
      top: [{ moves: 0 }, { moves: 3, name: 7 }],
    },
    '99-classic': { played: 1 },
    '3-hex': null,
    __proto__: { played: 1 },
  });
  assert.deepEqual(Object.keys(clean), ['3-classic']);
  assert.equal(clean['3-classic'].played, 0);
  assert.equal(clean['3-classic'].rating, 5000);
  assert.deepEqual(clean['3-classic'].top, [
    { name: '', moves: 3, durationMs: 0, difficulty: null, at: 0 },
  ]);
  assert.deepEqual(sanitizeRanking('lixo'), {});
});

// ---------- Análise pós-jogo ----------

test('análise: cada posição traz o lance jogado, a nota e alternativas ordenadas', () => {
  // X abre no centro, O responde na borda (erro conhecido no 3×3) e X vence.
  const game = played({ mode: 'local' }, [4, 1, 0, 8, 6, 2, 3]);
  assert.equal(game.state.result, 'X');
  const replay = makeReplay(game.state);
  const review = reviewGame(replay);
  assert.equal(review.positions.length, replay.moves.length);
  for (const [i, position] of review.positions.entries()) {
    assert.equal(position.turn, i + 1);
    assert.equal(position.played, replay.moves[i].index);
    assert.equal(position.mark, replay.moves[i].mark);
    assert.ok(position.alternatives.length <= 3);
    assert.ok(!position.alternatives.some((alt) => alt.index === position.played));
    const scores = position.alternatives.map((alt) => alt.score);
    assert.deepEqual(
      scores,
      [...scores].sort((a, b) => b - a),
      'do melhor para o pior',
    );
  }
  const last = review.positions.at(-1);
  assert.equal(last.grade, 'best');
  assert.ok(last.playedScore > 90000, 'vitória imediata tem pontuação de vitória');
  assert.ok(last.wins.includes(3), 'o analisador vê o lance vencedor');
  assert.equal(last.alternatives.length, 2, 'só restavam três casas');
  // O lance 2 (borda contra abertura no centro) perde à força: é erro grave.
  assert.equal(review.positions[1].grade, 'blunder');
  assert.ok([0, 2, 6, 8].includes(review.positions[1].best), 'o correto era um canto');
  assert.equal(review.summary.O.blunder >= 1, true);
  assert.equal(review.summary.X.total, 4);
});

test('análise: nextMistake navega pelos erros; partida limpa não tem nenhum', () => {
  const review = reviewGame(makeReplay(played({ mode: 'local' }, [4, 1, 0, 8, 6, 2, 3]).state));
  assert.equal(nextMistake(review, 0), 2);
  const after = nextMistake(review, 2);
  assert.ok(after === -1 || after > 2);
  assert.equal(nextMistake(review, review.positions.length), -1);

  const draw = played({ mode: 'local' }, [4, 0, 8, 2, 1, 7, 3, 5, 6]);
  assert.equal(draw.state.result, 'draw');
  const clean = reviewGame(makeReplay(draw.state));
  assert.equal(clean.summary.X.blunder + clean.summary.O.blunder, 0);
});

test('análise: funciona em Gravity e no hexagonal, e está disponível como tarefa do worker', () => {
  const gravity = played(
    { mode: 'local', config: { size: 4, winLength: 3, variant: 'gravity' } },
    [0, 1, 0, 1, 0],
  );
  const review = TASKS.review({ replay: makeReplay(gravity.state) });
  assert.equal(review.positions.length, 5);
  assert.equal(review.positions[4].played, 4, 'índice da casa de pouso');
  assert.equal(review.positions[4].grade, 'best');

  const hex = played({ mode: 'local', config: HEX4 }, [2, 0, 5, 1, 8]);
  const hexReview = reviewGame(makeReplay(hex.state), { alternatives: 2 });
  assert.ok(hexReview.positions.every((position) => position.alternatives.length <= 2));
  assert.notEqual(hexReview.positions[3].grade, 'best', 'O não bloqueou a antidiagonal');
  assert.equal(hexReview.positions[3].best, 8);
});

test('relógio: derrota por tempo antes do primeiro lance conta no perfil e no ranking', () => {
  const game = new GameEngine({ mode: 'ai', meta: { human: 'X' }, clock: { moveMs: 5000 } });
  game.resumeClock(T0);
  const lost = game.checkClock(T0 + 5000);
  assert.deepEqual([lost.moves.length, lost.result, lost.endReason], [0, 'O', 'timeout']);
  const { profile, entry } = applyGameResult(defaultProfile(), lost, { player: 'X', now: 5 });
  assert.deepEqual([entry.outcome, entry.moves, entry.endReason], ['loss', 0, 'timeout']);
  assert.deepEqual([profile.played, profile.losses], [1, 1]);
  assert.ok(profile.rating < 1000, 'derrota com rating');
  assert.deepEqual(profile.ranking['3-classic'].losses, 1);
  // O registro sobrevive à normalização (backup, outra aba).
  const again = sanitizeProfile(JSON.parse(JSON.stringify(profile)));
  assert.equal(again.history[0].endReason, 'timeout');
  assert.deepEqual(again.ranking, profile.ranking);
  // O replay de uma partida sem lances também é válido.
  const replay = makeReplay(lost, 'X');
  assert.equal(validateReplay(replay), true);
  assert.equal(replayFrame(replay, 0).endReason, 'timeout');

  // Partida sem lances que não acabou no relógio continua fora do perfil.
  const abandoned = new GameEngine({ mode: 'ai' });
  assert.equal(applyGameResult(defaultProfile(), abandoned.abort(), { player: 'X' }), null);
});

test('ranking: vitória no relógio conta no V-E-D, mas não entra nas melhores vitórias', () => {
  // A IA (X) deixou o tempo acabar antes de jogar: vitória de O sem nenhum lance.
  const game = new GameEngine({ mode: 'ai', meta: { human: 'O' }, clock: { moveMs: 5000 } });
  game.resumeClock(T0);
  const won = game.checkClock(T0 + 5000);
  const { profile } = applyGameResult(defaultProfile(), won, { player: 'O' });
  const board = profile.ranking['3-classic'];
  assert.deepEqual([board.wins, board.top.length], [1, 0]);
  const timed = recordRanking({}, entry({ endReason: 'timeout', moves: 3 }));
  assert.deepEqual([timed['3-classic'].wins, timed['3-classic'].top.length], [1, 0]);
});

test('hex: o corte de candidatos usa a vizinhança hexagonal (seis vizinhas)', () => {
  const config = { size: 7, winLength: 4, variant: 'hex' };
  const board = Array(49).fill(null);
  board[24] = 'X'; // centro (linha 3, coluna 3)
  const hex = candidateMoves(board, config);
  // Raio 2 no hexágono: 19 casas menos a ocupada. No quadrado seriam 24.
  assert.equal(hex.length, 18);
  assert.ok(!hex.includes(8), '(1, 1) está a 4 passos no hexágono');
  assert.ok(hex.includes(12), '(1, 5) está a 2 passos no hexágono');
  assert.equal(candidateMoves(board, { ...config, variant: 'classic' }).length, 24);

  const big = { size: 9, winLength: 5, variant: 'hex' };
  const lone = Array(81).fill(null);
  lone[40] = 'O'; // centro (4, 4): raio 1 = as seis vizinhas
  assert.deepEqual(
    candidateMoves(lone, big).sort((a, b) => a - b),
    [31, 32, 39, 41, 48, 49],
  );
  assert.equal(cellDistance(1, -1, true), 1);
  assert.equal(cellDistance(1, 1, true), 2);
  assert.equal(cellDistance(1, 1), 1);
});

test('puzzles hexagonais: posição alcançável e respostas iguais às vitórias que o solver vê', () => {
  const hexConfigs = PUZZLE_CONFIGS.filter((config) => config.variant === 'hex');
  assert.ok(hexConfigs.length >= 2);
  for (const config of hexConfigs) {
    for (let seed = 1; seed <= 20; seed += 1) {
      const puzzle = generatePuzzle(seed, config);
      assert.match(puzzle.id, /-hex-/);
      assert.equal(winner(puzzle.board, config), null);
      const search = alphaBeta(puzzle.board, config, puzzle.toMove, {
        depth: 1,
        timeBudgetMs: 10_000,
      });
      const wins = search.candidates
        .filter((candidate) => candidate.score === WIN_SCORE - 1)
        .map((candidate) => candidate.index);
      assert.deepEqual(
        [...puzzle.answers].sort((a, b) => a - b),
        wins.sort((a, b) => a - b),
        `${config.size}-${seed}`,
      );
    }
  }
  // Ids da clássica não mudaram (os puzzles resolvidos ficam guardados por id).
  assert.equal(generatePuzzle(7, PUZZLE_CONFIGS[0]).id, 'puzzle-3x3-7');
});
