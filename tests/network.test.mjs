// Cliente de salas (src/services/network.js) contra um WebSocket falso: não precisa do pacote `ws`.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { validateMessage } from '../server/protocol.mjs';
import { CHAT_MAX_LENGTH, RealtimeClient } from '../src/services/network.js';

const config = { size: 3, winLength: 3, variant: 'classic' };
let sockets;
let originalWebSocket;

class FakeWebSocket {
  static OPEN = 1;

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    sockets.push(this);
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    });
  }

  send(raw) {
    this.sent.push(JSON.parse(raw));
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  /** Simula uma mensagem vinda do servidor. */
  receive(message) {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) });
  }
}

beforeEach(() => {
  sockets = [];
  originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = FakeWebSocket;
});
afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
});

async function connected() {
  const messages = [];
  const statuses = [];
  const client = new RealtimeClient('ws://teste', {
    onMessage: (message) => messages.push(message),
    onStatus: (status) => statuses.push(status),
  });
  await client.connect();
  return { client, socket: sockets.at(-1), messages, statuses };
}

test('cliente: host, join e watch mandam o nome; tudo o que sai passa no protocolo do servidor', async () => {
  const { client, socket } = await connected();
  client.host(config, '  Ana  ');
  client.join(' ab12cd ', 'Bia');
  client.watch('ab12cd');
  client.watch('ab12cd', 'n'.repeat(60));
  client.chat('boa sorte!');
  client.move(4);
  assert.deepEqual(socket.sent.slice(0, 3), [
    { type: 'host', config, name: 'Ana' },
    { type: 'join', code: 'AB12CD', name: 'Bia' },
    { type: 'watch', code: 'AB12CD' },
  ]);
  assert.equal(socket.sent[3].name.length, 24);
  assert.deepEqual(socket.sent.slice(4), [
    { type: 'chat', text: 'boa sorte!' },
    { type: 'move', index: 4, revision: 0 },
  ]);
  for (const message of socket.sent) assert.equal(validateMessage(message), true, message.type);
  client.close();
});

test('cliente: chat longo é cortado no limite do protocolo', async () => {
  const { client, socket } = await connected();
  client.chat('a'.repeat(CHAT_MAX_LENGTH + 50));
  assert.equal(socket.sent[0].text.length, CHAT_MAX_LENGTH);
  assert.equal(validateMessage(socket.sent[0]), true);
  client.close();
});

test('cliente: entrega sala, chat e presença; guarda token e revisão; descarta snapshot velho', async () => {
  const { client, socket, messages, statuses } = await connected();
  const entry = { id: 1, role: 'spectator', symbol: null, name: 'Caio', text: 'oi', at: 1 };
  socket.receive({ type: 'room', code: 'AB12CD', token: 't'.repeat(32), revision: 3, chat: [] });
  socket.receive({ type: 'chat', code: 'AB12CD', entry });
  socket.receive({ type: 'peer', players: [], spectators: 1, watchers: ['Caio'] });
  socket.receive({ type: 'state', revision: 2, snapshot: {} });
  socket.receive({ type: 'state', revision: 4, snapshot: {} });
  socket.receive('isto não é JSON');

  assert.deepEqual(
    messages.map((message) => message.type),
    ['room', 'chat', 'peer', 'state'],
  );
  assert.deepEqual(messages[1].entry, entry);
  assert.deepEqual(messages[2].watchers, ['Caio']);
  assert.deepEqual([client.room, client.revision], ['AB12CD', 4]);
  assert.deepEqual(statuses, ['connected', 'protocol-error']);

  client.move(0);
  assert.deepEqual(socket.sent.at(-1), { type: 'move', index: 0, revision: 4 });
  client.close();
  assert.equal(statuses.at(-1), 'closed');
});

test('regressão: ao reconectar, o jogador retoma com o token e o espectador volta a assistir', async (t) => {
  // O servidor apaga o espectador que cai; um `resume` com o token antigo era sempre recusado.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const token = 't'.repeat(32);
  const cases = [
    ['guest', 'Bia', { type: 'resume', code: 'AB12CD', token }],
    ['spectator', 'Caio', { type: 'watch', code: 'AB12CD', name: 'Caio' }],
    ['spectator', '', { type: 'watch', code: 'AB12CD' }],
  ];
  for (const [role, name, expected] of cases) {
    const { client, socket, statuses } = await connected();
    socket.receive({ type: 'room', code: 'AB12CD', token, role, name, revision: 0, chat: [] });
    socket.close(); // queda vinda da rede, não do usuário
    assert.equal(statuses.at(-1), 'reconnecting');
    t.mock.timers.tick(1000);
    await new Promise((resolve) => setImmediate(resolve));
    const again = sockets.at(-1);
    assert.notEqual(again, socket);
    assert.deepEqual(again.sent, [expected], role);
    assert.equal(validateMessage(again.sent[0]), true);
    client.close();
  }
});

test('cliente: enviar sem conexão aberta falha em vez de perder a mensagem em silêncio', async () => {
  const { client } = await connected();
  client.close();
  assert.throws(() => client.chat('oi'), /desconectado/);
  assert.throws(() => client.move(0), /desconectado/);
});

test('cliente: relógio da sala e moderação passam no protocolo; quem é expulso não reconecta', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { client, socket, messages, statuses } = await connected();
  client.host(config, 'Ana', { moveMs: 5000, gameMs: 0 });
  client.host(config, 'Ana', { moveMs: 0, gameMs: 0 }); // sem limites: não manda relógio
  client.moderate('mute', 3);
  client.moderate('kick', 3);
  assert.deepEqual(socket.sent, [
    { type: 'host', config, name: 'Ana', clock: { moveMs: 5000, gameMs: 0 } },
    { type: 'host', config, name: 'Ana' },
    { type: 'moderate', action: 'mute', target: 3 },
    { type: 'moderate', action: 'kick', target: 3 },
  ]);
  for (const message of socket.sent) assert.equal(validateMessage(message), true, message.type);

  // Expulso: a mensagem chega à tela e a sessão é esquecida (a queda não tenta voltar).
  socket.receive({ type: 'room', code: 'AB12CD', token: 't'.repeat(32), role: 'spectator' });
  socket.receive({ type: 'kicked', code: 'AB12CD' });
  assert.equal(messages.at(-1).type, 'kicked');
  assert.deepEqual([client.room, client.token], [null, null]);
  socket.close();
  t.mock.timers.tick(10_000);
  assert.equal(sockets.length, 1, 'nenhuma nova conexão');
  assert.equal(statuses.at(-1), 'closed');
});
