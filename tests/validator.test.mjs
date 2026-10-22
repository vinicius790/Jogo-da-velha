// Validação de dados não confiáveis: snapshots, perfil, estado importado e mensagens entre abas.
import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from '../src/core/engine/game.js';
import { validateSnapshot } from '../src/core/engine/validator.js';
import { makeReplay } from '../src/features/replay.js';
import { applySyncMessage, normalizeState } from '../src/state/normalize.js';
import { defaultProfile, sanitizeProfile } from '../src/state/profile.js';

function snapshotAfter(moves, options = {}) {
  const game = new GameEngine({ mode: 'local', ...options });
  for (const move of moves) game.play(move);
  return game.state;
}

test('snapshot gerado pelo motor é aceito (em andamento, vencido e abortado)', () => {
  assert.equal(validateSnapshot(snapshotAfter([])), true);
  assert.equal(validateSnapshot(snapshotAfter([0, 3, 1, 4, 2])), true);
  const game = new GameEngine();
  game.play(0);
  assert.equal(validateSnapshot(game.abort()), true);
});

test('snapshot com tabuleiro forjado, turno errado ou resultado falso é rejeitado', () => {
  const base = snapshotAfter([0, 4]);
  const cases = {
    'tabuleiro que não bate com o histórico': { ...base, board: base.board.with(8, 'X') },
    'vez errada': { ...base, current: 'O' },
    'vitória inventada': { ...base, status: 'won', result: 'X', winningLine: [0, 1, 2] },
    'tamanho errado': { ...base, board: [null] },
    'marcador inválido': { ...base, board: base.board.with(8, 'Z') },
    'modo desconhecido': { ...base, mode: 'admin' },
    'dificuldade desconhecida': { ...base, difficulty: 'god' },
    'lance repetido': { ...base, moves: [...base.moves, { index: 0, mark: 'X' }] },
    'configuração inválida': { ...base, config: { size: 99, winLength: 3 } },
  };
  for (const [name, forged] of Object.entries(cases)) {
    assert.throws(() => validateSnapshot(forged), undefined, name);
    assert.throws(() => GameEngine.from(forged), undefined, name);
  }
  assert.throws(() => validateSnapshot(null));
});

test('GameEngine.from reconstrói a partida e continua jogável', () => {
  const restored = GameEngine.from(snapshotAfter([0, 4]));
  assert.equal(restored.play(8).moves.length, 3);
  // Pilha de refazer malformada é descartada em vez de quebrar.
  const odd = GameEngine.from({ ...snapshotAfter([0]), redo: 'lixo' });
  assert.deepEqual(odd.state.redo, []);
});

test('regressão: existe uma única definição de perfil, com o mesmo formato sempre', () => {
  const fresh = defaultProfile();
  assert.deepEqual(sanitizeProfile(null), fresh);
  assert.deepEqual(sanitizeProfile(fresh), fresh);
  assert.deepEqual(Object.keys(sanitizeProfile({ extra: 1 })).sort(), Object.keys(fresh).sort());
  assert.deepEqual(fresh.glicko, { rating: 1500, deviation: 350, volatility: 0.06 });
});

test('perfil: valores fora da faixa e campos estranhos são corrigidos', () => {
  const profile = sanitizeProfile({
    name: 'x'.repeat(100),
    rating: 99999,
    played: -2,
    xp: 'muito',
    achievements: ['puzzle', 'puzzle', 'inexistente', 7],
    history: [{ id: 'a' }, 'lixo', null],
    settings: { theme: 'neon', language: 'xx', sound: false, motion: 'none' },
    glicko: { rating: -5, deviation: 9999 },
  });
  assert.equal(profile.name.length, 40);
  assert.equal(profile.rating, 5000);
  assert.equal(profile.played, 0);
  assert.equal(profile.xp, 0);
  assert.deepEqual(profile.achievements, ['puzzle']);
  assert.deepEqual(profile.history, []);
  assert.deepEqual(profile.settings, {
    theme: 'dark',
    sound: false,
    language: 'pt-BR',
    motion: 'full',
  });
  assert.deepEqual(profile.glicko, { rating: 100, deviation: 350, volatility: 0.06 });
});

test('perfil: histórico anterior à versão 12 (sem "outcome") é migrado', () => {
  const legacy = {
    id: 'g1',
    finishedAt: 1,
    mode: 'ai',
    config: { size: 3, winLength: 3 },
    result: 'O',
    player: 'X',
    moves: 6,
    ratingDelta: -12,
  };
  const [entry] = sanitizeProfile({ history: [legacy] }).history;
  assert.equal(entry.outcome, 'loss');
  assert.equal(entry.config.variant, 'classic');
});

test('normalizeState descarta tudo o que não passa na validação', () => {
  const good = snapshotAfter([0, 3, 1, 4, 2]);
  const state = normalizeState({
    profile: { name: 'Ana', rating: 1234 },
    game: { ...snapshotAfter([0]), board: Array(9).fill('X') },
    replays: [makeReplay(good), { id: 'falso', moves: [{ index: 0, mark: 'O' }] }, 'lixo'],
    tournaments: [{ id: 't', players: ['hacker'] }],
    puzzles: ['daily-2026-10-01', 42, 'daily-2026-10-01', 'x'.repeat(100)],
  });
  assert.equal(state.profile.name, 'Ana');
  assert.equal(state.game, null);
  assert.equal(state.replays.length, 1);
  assert.deepEqual(state.tournaments, []);
  assert.deepEqual(state.puzzles, ['daily-2026-10-01']);
  assert.deepEqual(normalizeState(undefined).profile, defaultProfile());
});

test('regressão: mensagens do BroadcastChannel são validadas antes de entrar no estado', () => {
  const state = normalizeState(null);
  const game = snapshotAfter([0]);
  const withGame = { ...state, game };

  // Origem desconhecida ou formato estranho: ignorada (mesma referência).
  assert.equal(applySyncMessage(state, { source: 'outro', type: 'profile', payload: {} }), state);
  assert.equal(applySyncMessage(state, 'texto'), state);
  assert.equal(applySyncMessage(state, { source: 'omega', type: 'desconhecido' }), state);

  // Perfil forjado é saneado.
  const profile = applySyncMessage(state, {
    source: 'omega',
    type: 'profile',
    payload: { rating: 1e9, achievements: ['x'], name: 42 },
  }).profile;
  assert.equal(profile.rating, 5000);
  assert.deepEqual(profile.achievements, []);
  assert.equal(profile.name, 'Omega Player');

  // Replays inválidos e payload nulo não entram (antes eram aceitos como vieram).
  const replays = applySyncMessage(state, {
    source: 'omega',
    type: 'replays',
    payload: [{ html: '<script>' }, makeReplay(snapshotAfter([0, 3, 1, 4, 2]))],
  }).replays;
  assert.equal(replays.length, 1);
  assert.deepEqual(applySyncMessage(state, { source: 'omega', type: 'replays' }).replays, []);

  // "state" de outra aba é normalizado e não substitui a partida desta aba.
  const next = applySyncMessage(withGame, {
    source: 'omega',
    type: 'state',
    payload: { profile: { rating: -50 }, game: { forjado: true }, tournaments: 'x' },
  });
  assert.equal(next.profile.rating, 0);
  assert.deepEqual(next.game, game);
  assert.deepEqual(next.tournaments, []);
});
