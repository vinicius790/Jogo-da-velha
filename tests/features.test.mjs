// Puzzles, desafio diário, conquistas e regras de registro de partidas no perfil.
import assert from 'node:assert/strict';
import test from 'node:test';
import { ACHIEVEMENTS, AI_RATING } from '../src/core/constants.js';
import { GameEngine } from '../src/core/engine/game.js';
import { findWinningLine, winner } from '../src/core/engine/win.js';
import { achievementRows, evaluateAchievements } from '../src/features/achievements.js';
import { dailyChallenge, dailyPuzzleStreak } from '../src/features/challenges.js';
import { applyEvent, applyGameResult, facedImmediateThreat } from '../src/features/progression.js';
import { PUZZLE_CONFIGS, generatePuzzle, validatePuzzle } from '../src/features/puzzles.js';
import { defaultProfile } from '../src/state/profile.js';

function finishedGame(options, moves) {
  const game = new GameEngine(options);
  for (const move of moves) game.play(move);
  return game.state;
}
const X_WINS = [0, 3, 1, 4, 2];
const O_WINS = [0, 3, 1, 4, 8, 5];
const DRAW = [0, 1, 2, 4, 3, 5, 7, 6, 8];

// ---------- Puzzles ----------

test('puzzles: todo puzzle gerado é uma posição válida com lance vencedor', () => {
  for (const config of PUZZLE_CONFIGS) {
    for (let seed = 1; seed <= 25; seed += 1) {
      const puzzle = generatePuzzle(seed, config);
      assert.equal(puzzle.board.length, config.size ** 2);
      assert.equal(winner(puzzle.board, config), null, 'ninguém venceu ainda');
      const x = puzzle.board.filter((cell) => cell === 'X').length;
      const o = puzzle.board.filter((cell) => cell === 'O').length;
      assert.equal(x - o, puzzle.toMove === 'X' ? 0 : 1, 'contagem coerente com a vez (X começa)');
      assert.ok(puzzle.answers.length >= 1);
      for (const answer of puzzle.answers) {
        const board = puzzle.board.slice();
        board[answer] = puzzle.toMove;
        assert.ok(findWinningLine(board, answer, puzzle.toMove, config));
      }
    }
  }
});

test('regressão: puzzles não são mais fixos em 3×3', () => {
  const sizes = new Set(PUZZLE_CONFIGS.map((config) => config.size));
  assert.ok(sizes.size >= 3);
  assert.equal(generatePuzzle(5, PUZZLE_CONFIGS[2]).config.size, 5);
});

test('regressão: qualquer lance vencedor resolve o puzzle (antes só um era aceito)', () => {
  const puzzle = {
    config: { size: 3, winLength: 3, variant: 'classic' },
    board: ['X', 'X', null, 'X', 'O', 'O', null, 'O', null],
    toMove: 'X',
    answers: [2, 6],
  };
  assert.equal(validatePuzzle(puzzle, 2), true);
  assert.equal(validatePuzzle(puzzle, 6), true);
  assert.equal(validatePuzzle(puzzle, 8), false);
  assert.equal(validatePuzzle(puzzle, 0), false);
  assert.equal(validatePuzzle(null, 2), false);
});

test('puzzles são determinísticos por semente', () => {
  assert.deepEqual(generatePuzzle(77, PUZZLE_CONFIGS[1]), generatePuzzle(77, PUZZLE_CONFIGS[1]));
});

test('regressão: o desafio diário é um puzzle completo (tinha só metadados e quebrava a tela)', () => {
  const day = new Date('2026-10-01T15:00:00Z');
  const challenge = dailyChallenge(day);
  assert.equal(challenge.id, 'daily-2026-10-01');
  assert.ok(Array.isArray(challenge.board));
  assert.equal(challenge.board.length, challenge.config.size ** 2);
  assert.ok(validatePuzzle(challenge, challenge.answers[0]));
  // Igual para todos no mesmo dia (UTC) e diferente no dia seguinte.
  assert.deepEqual(dailyChallenge(new Date('2026-10-01T23:59:00Z')), challenge);
  assert.notEqual(dailyChallenge(new Date('2026-10-02T00:00:00Z')).id, challenge.id);
});

test('sequência diária: atual, melhor histórica, tolerância de um dia e datas UTC', () => {
  const ids = ['daily-2026-10-01', 'daily-2026-10-02', 'daily-2026-10-04', 'daily-invalido'];
  assert.deepEqual(dailyPuzzleStreak(ids, new Date('2026-10-04T23:59:00Z')),
    { current: 1, best: 2, solvedToday: true });
  assert.deepEqual(dailyPuzzleStreak(ids, new Date('2026-10-05T00:00:00Z')),
    { current: 1, best: 2, solvedToday: false });
  assert.deepEqual(dailyPuzzleStreak([], new Date('2026-10-04T00:00:00Z')),
    { current: 0, best: 0, solvedToday: false });
  assert.deepEqual(dailyPuzzleStreak(['daily-2026-10-05', 'daily-2026-10-07'], new Date('2026-10-04T00:00:00Z')),
    { current: 0, best: 0, solvedToday: false });
});

// ---------- Registro de partidas ----------

test('partida contra a IA: Elo calculado contra o rating do nível, não contra 1000 fixo', () => {
  const profile = defaultProfile();
  const easy = applyGameResult(profile, finishedGame({ mode: 'ai', difficulty: 'easy' }, X_WINS), {
    player: 'X',
  });
  const omega = applyGameResult(
    profile,
    finishedGame({ mode: 'ai', difficulty: 'omega' }, X_WINS),
    { player: 'X' },
  );
  assert.ok(AI_RATING.easy.elo < AI_RATING.omega.elo);
  assert.ok(omega.entry.ratingDelta > easy.entry.ratingDelta, 'vencer nível forte vale mais');
  assert.equal(easy.profile.rating, profile.rating + easy.entry.ratingDelta);
  assert.equal(easy.profile.wins, 1);
  assert.equal(easy.profile.played, 1);
  assert.equal(easy.profile.streak, 1);
  assert.equal(easy.entry.rated, true);
  assert.ok(easy.profile.glicko.deviation < profile.glicko.deviation, 'a incerteza diminui');
});

test('derrota e empate atualizam os contadores certos', () => {
  const profile = { ...defaultProfile(), streak: 4, bestStreak: 4 };
  const loss = applyGameResult(profile, finishedGame({ mode: 'ai' }, O_WINS), { player: 'X' });
  assert.equal(loss.entry.outcome, 'loss');
  assert.equal(loss.profile.losses, 1);
  assert.equal(loss.profile.streak, 0);
  assert.equal(loss.profile.bestStreak, 4);
  assert.ok(loss.entry.ratingDelta < 0);

  const draw = applyGameResult(profile, finishedGame({ mode: 'ai' }, DRAW), { player: 'O' });
  assert.equal(draw.entry.outcome, 'draw');
  assert.equal(draw.profile.draws, 1);
});

test('regressão: modos sem jogador humano identificado não mexem no perfil', () => {
  const profile = defaultProfile();
  for (const mode of ['local', 'spectator']) {
    assert.equal(applyGameResult(profile, finishedGame({ mode }, X_WINS), { player: 'X' }), null);
  }
  // Espectador de sala online: não há símbolo do jogador.
  const online = finishedGame({ mode: 'online' }, X_WINS);
  assert.equal(applyGameResult(profile, online, { player: null }), null);
});

test('regressão: partida aberta por link de compartilhamento não é registrada', () => {
  const state = finishedGame({ mode: 'ai' }, X_WINS);
  assert.equal(applyGameResult(defaultProfile(), state, { player: 'X', unrated: true }), null);
});

test('regressão: partida online conta no histórico, mas não altera o rating', () => {
  const profile = defaultProfile();
  const result = applyGameResult(profile, finishedGame({ mode: 'online' }, X_WINS), {
    player: 'O',
  });
  assert.equal(result.entry.outcome, 'loss');
  assert.equal(result.entry.rated, false);
  assert.equal(result.entry.ratingDelta, 0);
  assert.equal(result.profile.rating, profile.rating);
  assert.deepEqual(result.profile.glicko, profile.glicko);
  assert.equal(result.profile.played, 1);
});

test('a mesma partida nunca é registrada duas vezes; partida em andamento não é registrada', () => {
  const state = finishedGame({ mode: 'ai' }, X_WINS);
  const first = applyGameResult(defaultProfile(), state, { player: 'X' });
  assert.equal(applyGameResult(first.profile, state, { player: 'X' }), null);
  assert.equal(
    applyGameResult(defaultProfile(), finishedGame({ mode: 'ai' }, [0, 1]), { player: 'X' }),
    null,
  );
});

// ---------- Conquistas ----------

test('regressão: derrota e empate não desbloqueiam conquistas de vitória', () => {
  const loss = applyGameResult(
    defaultProfile(),
    finishedGame({ mode: 'ai', difficulty: 'omega' }, O_WINS),
    { player: 'X' },
  );
  for (const id of ['first-win', 'perfect', 'omega', 'speed', 'comeback']) {
    assert.ok(!loss.unlocked.includes(id), `${id} não pode sair em derrota`);
  }
  const draw = applyGameResult(
    defaultProfile(),
    finishedGame({ mode: 'ai', difficulty: 'omega' }, DRAW),
    { player: 'X' },
  );
  assert.deepEqual(draw.unlocked, []);
});

test('vitória rápida contra o OMEGA desbloqueia as conquistas corretas, uma única vez', () => {
  const state = finishedGame({ mode: 'ai', difficulty: 'omega' }, X_WINS);
  const result = applyGameResult(defaultProfile(), state, { player: 'X', offline: true });
  for (const id of ['first-win', 'omega', 'speed', 'offline']) {
    assert.ok(result.unlocked.includes(id), id);
  }
  assert.ok(!result.unlocked.includes('custom'), '3×3 clássico não é configuração personalizada');
  assert.ok(!result.unlocked.includes('perfect'), 'invicto exige 5 partidas');
  const again = evaluateAchievements(result.profile, {
    game: { outcome: 'win', config: state.config },
  });
  assert.ok(!again.includes('first-win'));
});

test('"virada" exige ter estado sob ameaça imediata', () => {
  // X vence sem que O chegue a ameaçar.
  const calm = finishedGame({ mode: 'ai' }, [4, 0, 2, 7, 6]);
  assert.equal(facedImmediateThreat(calm, 'X'), false);
  // O alinha duas (3 e 4) antes do último lance de X.
  assert.equal(facedImmediateThreat(finishedGame({ mode: 'ai' }, X_WINS), 'X'), true);
});

test('regressão: conquistas de evento (importação, torneio, replay, laboratório) são avaliadas', () => {
  const events = {
    import: { imported: true },
    tournament: { tournamentCompleted: true },
    replay: { replayWatched: true },
    engineer: { labRun: true },
    puzzle: { puzzleSolved: true },
  };
  for (const [id, event] of Object.entries(events)) {
    const { profile, unlocked } = applyEvent(defaultProfile(), event);
    assert.deepEqual(unlocked, [id]);
    assert.deepEqual(profile.achievements, [id]);
  }
  assert.deepEqual(applyEvent(defaultProfile(), {}).unlocked, []);
});

test('regressão: "polímata" exige vitória nas três variantes', () => {
  const win = (variant) => ({ outcome: 'win', config: { size: 3, winLength: 3, variant } });
  const two = { ...defaultProfile(), history: [win('classic'), win('misere'), win('classic')] };
  assert.ok(!evaluateAchievements(two, {}).includes('variant-master'));
  const three = { ...two, history: [...two.history, win('gravity')] };
  assert.ok(evaluateAchievements(three, {}).includes('variant-master'));
});

test('"gigante" e "arquiteto" dependem da configuração da partida concluída', () => {
  const config = { size: 12, winLength: 5, variant: 'classic' };
  const unlocked = evaluateAchievements(defaultProfile(), { game: { outcome: 'loss', config } });
  assert.ok(unlocked.includes('giant'));
  assert.ok(unlocked.includes('custom'));
});

test('regressão: o total de conquistas vem da lista (não de um número fixo)', () => {
  const rows = achievementRows(['puzzle']);
  assert.equal(rows.length, ACHIEVEMENTS.length);
  assert.equal(rows.filter((row) => row.unlocked).length, 1);
  assert.equal(new Set(ACHIEVEMENTS.map((item) => item.id)).size, ACHIEVEMENTS.length);
});
