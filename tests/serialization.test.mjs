// Replays, notação, compartilhamento, backups e estudo de partidas.
import assert from 'node:assert/strict';
import test from 'node:test';
import { gradeReplay } from '../src/core/analysis/move-grader.js';
import { GameEngine } from '../src/core/engine/game.js';
import { decodeMoves, notationForGame } from '../src/core/notation.js';
import { createBackup, verifyBackup } from '../src/core/serialization/backup.js';
import { fromJSONL, toJSONL } from '../src/core/serialization/jsonl.js';
import { decryptBackup, encryptBackup } from '../src/core/serialization/secure-backup.js';
import { SHARE_PREFIX, decodeState, encodeState } from '../src/core/serialization/share.js';
import { buildOpeningExplorer, openingStats } from '../src/features/opening-explorer.js';
import { makeReplay, replayFrame, validateReplay } from '../src/features/replay.js';
import { lessonsFromReport } from '../src/features/study.js';

function play(moves, options = {}) {
  const game = new GameEngine({ mode: 'local', ...options });
  for (const move of moves) game.play(move);
  return game.state;
}
const X_WINS = [0, 3, 1, 4, 2];

test('replay reconstrói qualquer ponto da partida', () => {
  const state = play(X_WINS);
  const replay = makeReplay(state, 'X');
  assert.equal(replay.player, 'X');
  assert.deepEqual(replayFrame(replay, 5).board, state.board);
  assert.deepEqual(replayFrame(replay, 0).board, Array(9).fill(null));
  assert.equal(replayFrame(replay, 2).current, 'X');
});

test('replay em Gravity usa as casas de pouso', () => {
  const state = play([0, 0, 1], { config: { size: 4, winLength: 3, variant: 'gravity' } });
  const replay = makeReplay(state);
  assert.deepEqual(replayFrame(replay, 3).board, state.board);
  assert.equal(validateReplay(replay), true);
});

test('replay com resultado falso, lance ilegal ou formato estranho é recusado', () => {
  const replay = makeReplay(play(X_WINS));
  assert.equal(validateReplay(replay), true);
  assert.equal(validateReplay({ ...replay, result: 'O' }), false);
  assert.equal(validateReplay({ ...replay, moves: [...replay.moves, replay.moves[0]] }), false);
  assert.equal(validateReplay({ ...replay, mode: 'root' }), false);
  assert.equal(validateReplay({ ...replay, id: '' }), false);
  assert.equal(validateReplay({ ...replay, moves: 'nenhum' }), false);
  assert.equal(validateReplay(null), false);
});

test('notação: ida e volta, e rejeição de turno fora de ordem', () => {
  const state = play([0, 4, 1]);
  assert.equal(notationForGame(state), 'XA1-OB2-XB1');
  assert.deepEqual(decodeMoves('XA1-OB2-XB1', state.config).board, state.board);
  assert.throws(() => decodeMoves('OA1', state.config), { code: 'bad-notation' });
  assert.throws(() => decodeMoves('XA1-OA1', state.config), { code: 'occupied' });
});

test('código de compartilhamento: ida e volta, com prefixo próprio do formato', () => {
  const state = play([0, 4]);
  const code = encodeState(state);
  assert.ok(code.startsWith(`${SHARE_PREFIX}.`));
  assert.deepEqual(GameEngine.from(decodeState(code)).state, state);
});

test('código de compartilhamento inválido, adulterado ou de outro formato é recusado', () => {
  assert.throws(() => decodeState('qualquer coisa'), { code: 'bad-share-code' });
  assert.throws(() => decodeState(`${SHARE_PREFIX}.@@@`), { code: 'bad-share-code' });
  assert.throws(() => decodeState(undefined), { code: 'bad-share-code' });
  // Conteúdo bem formado, mas com tabuleiro forjado: barrado pela validação do motor.
  const forged = { ...play([0]), board: Array(9).fill('X') };
  assert.throws(() => GameEngine.from(decodeState(encodeState(forged))));
});

test('links da versão 11 (prefixo OMEGA11) continuam abrindo', () => {
  const state = play([0, 4]);
  const legacy = encodeState(state).replace(SHARE_PREFIX, 'OMEGA11');
  assert.deepEqual(decodeState(legacy), state);
});

test('backup simples: soma confere e adulteração é detectada', async () => {
  const backup = await createBackup({ state: { x: 1 } });
  assert.match(backup.sha256, /^[0-9a-f]{64}$/);
  assert.equal(await verifyBackup(backup), true);
  assert.equal(await verifyBackup({ ...backup, payload: { state: { x: 2 } } }), false);
  assert.equal(await verifyBackup({ ...backup, format: 'OUTRO' }), false);
  assert.equal(await verifyBackup({ ...backup, sha256: 123 }), false);
  assert.equal(await verifyBackup(null), false);
});

test('backup cifrado: ida e volta, senha errada, adulteração e senha fraca', async () => {
  const payload = { app: '12.0.0', state: { profile: { name: 'Ana' } } };
  const bundle = await encryptBackup(payload, 'senha-super-segura');
  assert.equal(bundle.cipher, 'AES-256-GCM');
  assert.ok(!JSON.stringify(bundle).includes('Ana'), 'o conteúdo não aparece em claro');
  assert.deepEqual(await decryptBackup(bundle, 'senha-super-segura'), payload);
  await assert.rejects(() => decryptBackup(bundle, 'senha-errada'), { code: 'wrong-password' });
  const tampered = {
    ...bundle,
    ciphertext: bundle.ciphertext.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')),
  };
  await assert.rejects(() => decryptBackup(tampered, 'senha-super-segura'), {
    code: 'wrong-password',
  });
  await assert.rejects(() => encryptBackup(payload, 'curta'), { code: 'weak-password' });
  await assert.rejects(() => decryptBackup({ format: 'X' }, 'senha-super-segura'), {
    code: 'invalid-backup',
  });
});

test('JSONL: um registro por linha, ida e volta', () => {
  const records = [makeReplay(play(X_WINS)), makeReplay(play([4, 0]))];
  const text = toJSONL(records);
  assert.equal(text.trimEnd().split('\n').length, 2);
  assert.deepEqual(fromJSONL(text), records);
  assert.equal(toJSONL([]), '');
});

test('estudo: o lance que entrega a partida é classificado como erro grave', () => {
  // X: A1, B1 (ameaça C1). O ignora e joga C3; X completa a linha.
  const replay = makeReplay(play([0, 4, 1, 8, 2]), 'O');
  const report = gradeReplay(replay, { depth: 9, timeBudgetMs: 5000 });
  assert.equal(report.grades.length, 5);
  const blunder = report.grades[3];
  assert.equal(blunder.grade, 'blunder');
  assert.equal(blunder.best, 2);
  assert.equal(report.grades[4].grade, 'best', 'o lance vencedor é o melhor');
  assert.equal(report.summary.O.blunder, 1);

  const lessons = lessonsFromReport(replay, report, 'O');
  assert.deepEqual(lessons, [
    { source: replay.id, turn: 4, mark: 'O', played: 8, best: 2, severity: 'blunder' },
  ]);
  assert.deepEqual(lessonsFromReport(replay, report, 'X'), []);
});

test('explorador de aberturas só mistura partidas da mesma configuração', () => {
  const classic = { size: 3, winLength: 3, variant: 'classic' };
  const replays = [
    makeReplay(play(X_WINS)),
    makeReplay(play([0, 4, 8])),
    makeReplay(play([4, 0])),
    makeReplay(play([0, 1], { config: { size: 4, winLength: 3 } })),
  ];
  const stats = openingStats(replays, classic);
  assert.equal(stats.games, 3);
  assert.equal(stats.firstMoves, 2);
  assert.deepEqual(
    [stats.mostPlayed.prefix, stats.mostPlayed.games, stats.mostPlayed.winsX],
    ['0', 2, 1],
  );
  assert.equal(buildOpeningExplorer(replays, { depth: 1 }).length, 2);
  assert.equal(openingStats([], classic).mostPlayed, null);
});
