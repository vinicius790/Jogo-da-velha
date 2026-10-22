import assert from 'node:assert/strict';
import test from 'node:test';
import { RoomManager } from '../server/room.mjs';

const config = { size: 3, winLength: 3, variant: 'classic' };

test('criar, entrar e jogar: o servidor é a autoridade', () => {
  const rooms = new RoomManager();
  const host = rooms.create({ config });
  const guest = rooms.join(host.code);
  assert.match(host.code, /^[A-Z2-9]{6}$/);
  assert.deepEqual([host.role, host.symbol, guest.role, guest.symbol], ['host', 'X', 'guest', 'O']);
  assert.notEqual(host.token, guest.token);

  const first = rooms.move(host.code, host.token, 0, 0);
  assert.equal(first.revision, 1);
  assert.equal(first.snapshot.moves.length, 1);
  assert.equal(first.snapshot.mode, 'online');

  assert.throws(() => rooms.move(host.code, guest.token, 1, 0), { code: 'stale-revision' });
  assert.throws(() => rooms.move(host.code, host.token, 1, 1), { code: 'not-your-turn' });
  assert.throws(() => rooms.move(host.code, guest.token, 0, 1), { code: 'occupied' });
  assert.throws(() => rooms.move(host.code, 'token-falso', 1, 1), { code: 'no-session' });
  assert.equal(rooms.move(host.code, guest.token, 1, 1).snapshot.current, 'X');
});

test('partida encerrada não aceita mais lances', () => {
  const rooms = new RoomManager();
  const host = rooms.create({ config });
  const guest = rooms.join(host.code);
  const sequence = [0, 3, 1, 4, 2];
  sequence.forEach((index, i) => {
    rooms.move(host.code, i % 2 ? guest.token : host.token, index, i);
  });
  assert.equal(rooms.snapshot(host.code).snapshot.result, 'X');
  assert.throws(() => rooms.move(host.code, guest.token, 8, 5), { code: 'game-over' });
});

test('terceiro jogador é recusado; espectador entra, mas não joga', () => {
  const rooms = new RoomManager();
  const host = rooms.create({ config });
  rooms.join(host.code);
  assert.throws(() => rooms.join(host.code), { code: 'room-taken' });
  const spectator = rooms.watch(host.code);
  assert.deepEqual([spectator.role, spectator.symbol], ['spectator', null]);
  assert.throws(() => rooms.move(host.code, spectator.token, 0, 0), { code: 'spectator' });
  assert.throws(() => rooms.join('ZZZZZZ'), { code: 'room-unavailable' });
});

test('regressão: espectador que sai é removido da sala (antes ficava para sempre)', () => {
  const rooms = new RoomManager({ maxClients: 3 });
  const host = rooms.create({ config });
  rooms.join(host.code);
  const first = rooms.watch(host.code);
  assert.equal(rooms.snapshot(host.code).spectators, 1);
  assert.throws(() => rooms.watch(host.code), { code: 'room-full' });

  assert.equal(rooms.leave(host.code, first.token), true);
  assert.equal(rooms.snapshot(host.code).spectators, 0);
  assert.equal(rooms.watch(host.code).role, 'spectator', 'a vaga foi liberada');
  assert.throws(() => rooms.resume(host.code, first.token), { code: 'room-unavailable' });
});

test('jogador que cai mantém o lugar e pode retomar a sessão', () => {
  const rooms = new RoomManager();
  const host = rooms.create({ config });
  const guest = rooms.join(host.code);
  rooms.move(host.code, host.token, 4, 0);

  rooms.leave(host.code, guest.token);
  const away = rooms.snapshot(host.code).players;
  assert.deepEqual(away, [
    { id: 1, symbol: 'X', connected: true, name: '' },
    { id: 2, symbol: 'O', connected: false, name: '' },
  ]);
  assert.throws(() => rooms.join(host.code), { code: 'room-taken' }, 'o lugar continua reservado');

  const resumed = rooms.resume(host.code, guest.token);
  assert.deepEqual([resumed.symbol, resumed.revision], ['O', 1]);
  assert.equal(rooms.snapshot(host.code).players[1].connected, true);
  assert.equal(rooms.leave(host.code, 'inexistente'), false);
});

test('snapshot público não expõe tokens', () => {
  const rooms = new RoomManager();
  const host = rooms.create({ config });
  assert.ok(!JSON.stringify(rooms.snapshot(host.code)).includes(host.token));
});

test('salas expiram e há limite de salas', () => {
  const rooms = new RoomManager({ ttlMs: 60_000, maxRooms: 2 });
  const a = rooms.create({ config });
  rooms.create({ config });
  assert.throws(() => rooms.create({ config }), { code: 'server-full' });
  assert.equal(rooms.sweep(Date.now() + 61_000), 2);
  assert.equal(rooms.get(a.code), null);
  assert.equal(rooms.create({ config }).role, 'host');
});

test('chat: jogadores e espectadores conversam; o histórico chega a quem entra depois', () => {
  const rooms = new RoomManager({ chatCooldownMs: 0 });
  const host = rooms.create({ config, name: '  Ana  ' });
  const guest = rooms.join(host.code, 'Bia');
  assert.equal(host.name, 'Ana');
  assert.deepEqual(host.chat, []);

  const first = rooms.chat(host.code, host.token, '  boa   sorte! ', 1000);
  assert.equal(first.code, host.code);
  assert.deepEqual(first.entry, {
    id: 1,
    role: 'host',
    symbol: 'X',
    name: 'Ana',
    text: 'boa sorte!',
    at: 1000,
  });
  rooms.chat(host.code, guest.token, 'valeu', 2000);

  const watcher = rooms.watch(host.code, 'Caio');
  assert.deepEqual(
    watcher.chat.map((entry) => [entry.id, entry.name, entry.text]),
    [
      [1, 'Ana', 'boa sorte!'],
      [2, 'Bia', 'valeu'],
    ],
  );
  const fromWatcher = rooms.chat(host.code, watcher.token, 'assistindo', 3000).entry;
  assert.deepEqual([fromWatcher.role, fromWatcher.symbol], ['spectator', null]);

  const snapshot = rooms.snapshot(host.code);
  assert.deepEqual(snapshot.watchers, [{ id: 3, name: 'Caio', muted: false }]);
  assert.deepEqual(
    snapshot.players.map((player) => player.name),
    ['Ana', 'Bia'],
  );
  // O chat não mexe na partida.
  assert.equal(snapshot.revision, 0);
  assert.ok(!JSON.stringify(watcher.chat).includes(host.token));
});

test('chat: texto é limpo e limitado; vazio, intruso e rajada são recusados', () => {
  const rooms = new RoomManager({ chatCooldownMs: 500 });
  const host = rooms.create({ config, name: 'x'.repeat(100) });
  assert.equal(host.name.length, 24);

  const dirty = rooms.chat(host.code, host.token, `<b>oi</b>\u0000\n‮ ${'a'.repeat(300)}`, 0);
  assert.equal(dirty.entry.text.length, 200);
  assert.ok(dirty.entry.text.startsWith('<b>oi</b> a'), 'o texto é dado, não HTML: fica como veio');
  assert.ok(!/[\p{Cc}\p{Cf}]/u.test(dirty.entry.text), 'sem controles nem U+202E');

  assert.throws(() => rooms.chat(host.code, host.token, 'de novo', 499), {
    code: 'chat-too-fast',
  });
  assert.equal(rooms.chat(host.code, host.token, 'agora sim', 500).entry.id, 2);
  assert.throws(() => rooms.chat(host.code, host.token, ' \n\t ', 5000), { code: 'bad-message' });
  assert.throws(() => rooms.chat(host.code, 'token-falso', 'oi', 5000), { code: 'no-session' });
  assert.throws(() => rooms.chat('ZZZZZZ', host.token, 'oi', 5000), { code: 'room-unavailable' });
});

test('chat: só as últimas 50 mensagens ficam guardadas', () => {
  const rooms = new RoomManager({ chatCooldownMs: 0 });
  const host = rooms.create({ config });
  for (let i = 1; i <= 60; i += 1) rooms.chat(host.code, host.token, `m${i}`, i);
  const { chat } = rooms.resume(host.code, host.token);
  assert.equal(chat.length, 50);
  assert.deepEqual([chat[0].text, chat.at(-1).text, chat.at(-1).id], ['m11', 'm60', 60]);
  // Espectador que sai e volta recebe o histórico de novo.
  const watcher = rooms.watch(host.code);
  rooms.leave(host.code, watcher.token);
  assert.equal(rooms.snapshot(host.code).spectators, 0);
  assert.equal(rooms.watch(host.code).chat.length, 50);
});

// ---------- Relógio autoritativo ----------

const T0 = 1_000_000;

test('relógio: só corre depois que o segundo jogador entra; o servidor decide a derrota', () => {
  const rooms = new RoomManager();
  const host = rooms.create({ config, clock: { moveMs: 5000, gameMs: 0 } });
  assert.deepEqual(host.snapshot.clock.moveMs, 5000);
  assert.equal(host.clockStarted, false);
  assert.throws(() => rooms.move(host.code, host.token, 4, 0, T0), { code: 'waiting-opponent' });
  // Ninguém perde por tempo enquanto espera o adversário.
  assert.deepEqual(rooms.checkClocks(T0 + 3_600_000), []);

  const guest = rooms.join(host.code, 'Bia', { now: T0 });
  assert.equal(guest.clockStarted, true);
  assert.equal(guest.snapshot.clock.turnStartedAt, T0);
  const first = rooms.move(host.code, host.token, 4, 0, T0 + 4000);
  assert.equal(first.snapshot.clock.turnStartedAt, T0 + 4000);
  assert.equal(first.clockStarted, true);
  assert.equal(typeof first.serverNow, 'number');

  assert.deepEqual(rooms.checkClocks(T0 + 8999), [], 'O ainda tem tempo');
  assert.deepEqual(rooms.checkClocks(T0 + 9000), [host.code]);
  const { snapshot, revision } = rooms.snapshot(host.code);
  assert.deepEqual([snapshot.status, snapshot.result, snapshot.endReason], ['won', 'X', 'timeout']);
  assert.equal(revision, 2, 'a derrota por tempo é uma nova revisão');
  assert.deepEqual(rooms.checkClocks(T0 + 20_000), [], 'encerrada uma vez só');
  assert.throws(() => rooms.move(host.code, guest.token, 0, 2, T0 + 20_000), {
    code: 'game-over',
  });
});

test('relógio: lance atrasado vira derrota por tempo para todos, sem aplicar o lance', () => {
  const rooms = new RoomManager();
  const host = rooms.create({ config, clock: { moveMs: 0, gameMs: 10_000 } });
  const guest = rooms.join(host.code, '', { now: T0 });
  rooms.move(host.code, host.token, 4, 0, T0 + 1000);
  const late = rooms.move(host.code, guest.token, 0, 1, T0 + 1000 + 10_000);
  assert.equal(late.revision, 2);
  assert.equal(late.snapshot.moves.length, 1);
  assert.deepEqual([late.snapshot.result, late.snapshot.endReason], ['X', 'timeout']);
  assert.deepEqual(late.snapshot.clock.remaining, { X: 9000, O: 0 });
});

test('relógio: continua correndo com o jogador desconectado; a retomada traz o tempo certo', () => {
  const rooms = new RoomManager();
  const host = rooms.create({ config, clock: { moveMs: 0, gameMs: 60_000 } });
  const guest = rooms.join(host.code, '', { now: T0 });
  rooms.move(host.code, host.token, 4, 0, T0 + 2000);
  rooms.leave(host.code, guest.token);
  const back = rooms.resume(host.code, guest.token);
  assert.equal(back.clockStarted, true);
  assert.equal(back.snapshot.clock.turnStartedAt, T0 + 2000, 'a queda não reinicia o relógio');
  assert.deepEqual(back.snapshot.clock.remaining, { X: 58_000, O: 60_000 });
  assert.deepEqual(rooms.checkClocks(T0 + 62_000), [host.code]);
  assert.equal(rooms.snapshot(host.code).snapshot.result, 'X');
});

test('relógio: sala sem relógio não é afetada', () => {
  const rooms = new RoomManager();
  const host = rooms.create({ config });
  rooms.join(host.code);
  assert.equal(host.snapshot.clock, null);
  assert.equal(rooms.move(host.code, host.token, 0, 0).revision, 1);
  assert.deepEqual(rooms.checkClocks(Date.now() + 1e9), []);
});

// ---------- Moderação e spam ----------

test('moderação: o dono silencia, libera e expulsa espectador; a origem expulsa não volta', () => {
  const rooms = new RoomManager({ chatCooldownMs: 0 });
  const host = rooms.create({ config, owner: '10.0.0.1' });
  const guest = rooms.join(host.code, 'Bia', { origin: '10.0.0.2' });
  const watcher = rooms.watch(host.code, 'Caio', { origin: '10.0.0.3' });
  assert.equal(watcher.id, 3);

  assert.deepEqual(rooms.moderate(host.code, host.token, 'mute', watcher.id), {
    code: host.code,
    action: 'mute',
    target: 3,
    token: null,
  });
  assert.deepEqual(rooms.snapshot(host.code).watchers, [{ id: 3, name: 'Caio', muted: true }]);
  assert.throws(() => rooms.chat(host.code, watcher.token, 'oi', 1), { code: 'muted' });
  rooms.moderate(host.code, host.token, 'unmute', watcher.id);
  assert.equal(rooms.chat(host.code, watcher.token, 'oi', 2).entry.name, 'Caio');

  const kicked = rooms.moderate(host.code, host.token, 'kick', watcher.id);
  assert.equal(kicked.token, watcher.token);
  assert.equal(rooms.snapshot(host.code).spectators, 0);
  assert.throws(() => rooms.chat(host.code, watcher.token, 'voltei', 3), { code: 'no-session' });
  assert.throws(() => rooms.resume(host.code, watcher.token), { code: 'room-unavailable' });
  assert.throws(() => rooms.watch(host.code, 'Caio', { origin: '10.0.0.3' }), { code: 'banned' });
  assert.equal(rooms.watch(host.code, 'Duda', { origin: '10.0.0.4' }).role, 'spectator');
  assert.ok(!JSON.stringify(rooms.snapshot(host.code)).includes('10.0.0'), 'IP nunca sai');

  // Só o dono modera, e só espectadores podem ser moderados.
  assert.throws(() => rooms.moderate(host.code, guest.token, 'mute', 4), { code: 'not-host' });
  assert.throws(() => rooms.moderate(host.code, host.token, 'kick', guest.id), {
    code: 'bad-target',
  });
  assert.throws(() => rooms.moderate(host.code, host.token, 'kick', 99), { code: 'bad-target' });
  assert.throws(() => rooms.moderate(host.code, host.token, 'ban', 4), { code: 'bad-message' });
  assert.throws(() => rooms.moderate(host.code, 'token-falso', 'mute', 4), { code: 'no-session' });
});

test('spam: a mesma mensagem repetida logo em seguida é recusada', () => {
  const rooms = new RoomManager({ chatCooldownMs: 0, repeatWindowMs: 30_000 });
  const host = rooms.create({ config });
  rooms.chat(host.code, host.token, 'GG', 1000);
  assert.throws(() => rooms.chat(host.code, host.token, '  gg ', 2000), { code: 'chat-repeated' });
  assert.equal(rooms.chat(host.code, host.token, 'boa partida', 3000).entry.id, 2);
  assert.equal(rooms.chat(host.code, host.token, 'GG', 4000).entry.id, 3, 'intercalada passa');
  assert.equal(rooms.chat(host.code, host.token, 'gg', 34_000).entry.id, 4, 'depois da janela');
  assert.equal(rooms.get(host.code).chat.length, 4);
});
