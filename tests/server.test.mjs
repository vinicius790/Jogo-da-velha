// Teste de integração: sobe o servidor real em uma porta livre e conversa por WebSocket.
import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';
import { configFromEnv, createOmegaServer } from '../server/server.mjs';

const ORIGIN = 'http://localhost:4173';
const config = { size: 3, winLength: 3, variant: 'classic' };
let app;
let port;

before(async () => {
  app = createOmegaServer({ corsOrigin: ORIGIN, maxMessagesPerSecond: 15 });
  port = await app.listen(0);
});
after(() => app.close());

/** Cliente de teste: fila de mensagens recebidas e `next(tipo)` para aguardar a próxima. */
function connect(origin = ORIGIN, { target = port, headers } = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${target}`, {
      ...(origin && { origin }),
      headers,
    });
    const queue = [];
    const waiting = [];
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      const index = waiting.findIndex((item) => item.type === message.type);
      if (index >= 0) waiting.splice(index, 1)[0].resolve(message);
      else queue.push(message);
    });
    const client = {
      socket,
      send: (message) => socket.send(JSON.stringify(message)),
      next: (type) =>
        new Promise((done, fail) => {
          const index = queue.findIndex((message) => message.type === type);
          if (index >= 0) {
            done(queue.splice(index, 1)[0]);
            return;
          }
          const timer = setTimeout(() => fail(new Error(`timeout esperando "${type}"`)), 3000);
          waiting.push({
            type,
            resolve: (message) => {
              clearTimeout(timer);
              done(message);
            },
          });
        }),
      close: () => new Promise((done) => (socket.once('close', done), socket.close())),
    };
    socket.once('open', () => resolve(client));
    socket.once('error', reject);
    socket.once('unexpected-response', (_request, response) => {
      reject(Object.assign(new Error('handshake recusado'), { status: response.statusCode }));
    });
  });
}

test('endpoint de saúde responde e aplica a política de origem', async () => {
  const allowed = await fetch(`http://127.0.0.1:${port}/health`, { headers: { origin: ORIGIN } });
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).status, 'ok');
  assert.equal(allowed.headers.get('access-control-allow-origin'), ORIGIN);

  const other = await fetch(`http://127.0.0.1:${port}/`, {
    headers: { origin: 'http://evil.test' },
  });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(`http://127.0.0.1:${port}/admin`)).status, 404);
});

test('regressão: OMEGA_CORS_ORIGIN é lido do ambiente (o CORS era fixo em "*")', () => {
  assert.equal(configFromEnv({ OMEGA_CORS_ORIGIN: 'https://a.test' }).corsOrigin, 'https://a.test');
  assert.notEqual(configFromEnv({}).corsOrigin, '*');
  assert.equal(configFromEnv({ OMEGA_SERVER_PORT: '9000' }).port, 9000);
});

test('regressão: WebSocket de origem não autorizada (ou sem Origin) é recusado', async () => {
  await assert.rejects(() => connect('http://evil.test'), { status: 403 });
  await assert.rejects(() => connect(null), { status: 403 }); // cliente sem cabeçalho Origin
});

test('partida completa entre duas conexões, com espectador', async () => {
  const host = await connect();
  host.send({ type: 'host', config });
  const room = await host.next('room');
  assert.deepEqual([room.role, room.symbol, room.revision], ['host', 'X', 0]);

  const guest = await connect();
  guest.send({ type: 'join', code: room.code });
  const joined = await guest.next('room');
  assert.equal(joined.symbol, 'O');

  // Regressão: o aviso de presença traz os campos que o cliente lê (antes lia `count`, inexistente).
  const peer = await host.next('peer');
  assert.equal(peer.players.length, 2);
  assert.equal(peer.spectators, 0);
  assert.ok(peer.players.every((player) => player.connected));

  const watcher = await connect();
  watcher.send({ type: 'watch', code: room.code });
  assert.equal((await watcher.next('room')).role, 'spectator');
  assert.equal((await host.next('peer')).spectators, 1);

  host.send({ type: 'move', index: 4, revision: 0 });
  for (const client of [host, guest, watcher]) {
    const state = await client.next('state');
    assert.equal(state.revision, 1);
    assert.equal(state.snapshot.board[4], 'X');
  }

  // Lance fora de vez, revisão velha e lance de espectador: erro com código, sem mudar o estado.
  host.send({ type: 'move', index: 0, revision: 1 });
  assert.equal((await host.next('error')).code, 'not-your-turn');
  guest.send({ type: 'move', index: 0, revision: 0 });
  assert.equal((await guest.next('error')).code, 'stale-revision');
  watcher.send({ type: 'move', index: 0, revision: 1 });
  assert.equal((await watcher.next('error')).code, 'spectator');
  guest.send({ type: 'move', index: 4, revision: 1 });
  assert.equal((await guest.next('error')).code, 'occupied');

  // Regressão: espectador que desconecta sai da contagem e os demais são avisados.
  await watcher.close();
  assert.equal((await host.next('peer')).spectators, 0);

  // Regressão: queda e retomada do jogador são notificadas aos outros.
  await guest.close();
  const dropped = await host.next('peer');
  assert.deepEqual(
    dropped.players.map((player) => player.connected),
    [true, false],
  );
  const back = await connect();
  back.send({ type: 'resume', code: room.code, token: joined.token });
  const resumed = await back.next('room');
  assert.deepEqual([resumed.symbol, resumed.revision], ['O', 1]);
  const returned = await host.next('peer');
  assert.deepEqual(
    returned.players.map((player) => player.connected),
    [true, true],
  );

  back.send({ type: 'move', index: 0, revision: 1 });
  assert.equal((await host.next('state')).snapshot.board[0], 'O');
  await Promise.all([host.close(), back.close()]);
});

test('mensagens inválidas são rejeitadas sem derrubar a conexão', async () => {
  const client = await connect();
  client.socket.send('isto não é json');
  assert.equal((await client.next('error')).code, 'bad-message');
  client.send({ type: 'host', config: { size: 99, winLength: 3 } });
  assert.equal((await client.next('error')).code, 'bad-message');
  client.send({ type: 'move', index: 0, revision: 0 });
  assert.equal((await client.next('error')).code, 'no-session');
  client.send({ type: 'join', code: 'ZZZZZZ' });
  assert.equal((await client.next('error')).code, 'room-unavailable');
  client.send({ type: 'ping' });
  assert.equal((await client.next('pong')).type, 'pong');
  await client.close();
});

test('regressão: o limite de mensagens vale por IP, somando todas as conexões', async () => {
  await new Promise((resolve) => setTimeout(resolve, 1100)); // nova janela de contagem
  const first = await connect();
  const second = await connect();
  // 10 mensagens em cada conexão: nenhuma passa de 15 sozinha, mas juntas passam.
  for (let i = 0; i < 10; i += 1) first.send({ type: 'ping' });
  for (let i = 0; i < 10; i += 1) second.send({ type: 'ping' });
  assert.equal((await second.next('error')).code, 'rate-limit');
  await Promise.all([first.close(), second.close()]);
});

/** Envia uma requisição HTTP crua e devolve a linha de status. */
function rawRequest(target) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      socket.write(`GET ${target} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
    });
    let data = '';
    socket.on('data', (chunk) => (data += chunk));
    socket.on('close', () => resolve(data.split('\r\n')[0]));
    socket.on('error', reject);
  });
}

test('regressão: alvo HTTP malformado responde 404 em vez de derrubar o processo', async () => {
  // Antes, `new URL(request.url)` lançava fora de qualquer try e encerrava o servidor.
  assert.match(await rawRequest('http://a:99999/'), / 404 /);
  assert.match(await rawRequest('//'), / 404 /);
  assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
});

test('regressão: uma conexão não esgota as salas do servidor (limite de salas por IP)', async () => {
  const small = createOmegaServer({ corsOrigin: ORIGIN, maxRoomsPerIp: 2 });
  const target = await small.listen(0);
  try {
    const client = await connect(ORIGIN, { target });
    for (let i = 0; i < 2; i += 1) {
      client.send({ type: 'host', config });
      await client.next('room');
    }
    client.send({ type: 'host', config });
    assert.equal((await client.next('error')).code, 'too-many-rooms');
    await client.close();
    // Reconectar não zera a conta: as salas antigas continuam existindo.
    const again = await connect(ORIGIN, { target });
    again.send({ type: 'host', config });
    assert.equal((await again.next('error')).code, 'too-many-rooms');
    await again.close();
    assert.equal(small.rooms.rooms.size, 2);
  } finally {
    await small.close();
  }
});

test('regressão: atrás de proxy, o IP é o último de X-Forwarded-For (o primeiro é forjável)', async () => {
  const proxied = createOmegaServer({
    corsOrigin: ORIGIN,
    trustProxy: true,
    maxConnectionsPerIp: 1,
  });
  const target = await proxied.listen(0);
  try {
    // O proxy acrescenta o IP real (10.0.0.5) ao valor que o cliente mandou.
    const first = await connect(ORIGIN, {
      target,
      headers: { 'x-forwarded-for': '1.1.1.1, 10.0.0.5' },
    });
    await assert.rejects(
      () => connect(ORIGIN, { target, headers: { 'x-forwarded-for': '2.2.2.2, 10.0.0.5' } }),
      { status: 429 },
    );
    await first.close();
  } finally {
    await proxied.close();
  }
});

test('chat: jogadores e espectadores conversam e quem entra depois recebe o histórico', async () => {
  const host = await connect();
  host.send({ type: 'host', config, name: 'Ana' });
  const room = await host.next('room');
  assert.deepEqual([room.name, room.chat], ['Ana', []]);

  const guest = await connect();
  guest.send({ type: 'join', code: room.code, name: 'Bia' });
  await guest.next('room');
  await host.next('peer');

  host.send({ type: 'chat', text: '  boa   sorte! ' });
  for (const client of [host, guest]) {
    const message = await client.next('chat');
    assert.equal(message.code, room.code);
    assert.deepEqual(
      [message.entry.id, message.entry.role, message.entry.symbol, message.entry.name],
      [1, 'host', 'X', 'Ana'],
    );
    assert.equal(message.entry.text, 'boa sorte!');
  }

  // Espectador: recebe o histórico ao entrar, aparece na lista de presentes e pode falar.
  const watcher = await connect();
  watcher.send({ type: 'watch', code: room.code, name: 'Caio' });
  const watching = await watcher.next('room');
  assert.deepEqual(
    watching.chat.map((entry) => entry.text),
    ['boa sorte!'],
  );
  const peer = await host.next('peer');
  assert.deepEqual([peer.spectators, peer.watchers], [1, [{ id: 3, name: 'Caio', muted: false }]]);
  assert.deepEqual(
    peer.players.map((player) => player.name),
    ['Ana', 'Bia'],
  );

  watcher.send({ type: 'chat', text: 'torcendo daqui' });
  for (const client of [host, guest, watcher]) {
    const message = await client.next('chat');
    assert.deepEqual(
      [message.entry.role, message.entry.symbol, message.entry.name, message.entry.text],
      ['spectator', null, 'Caio', 'torcendo daqui'],
    );
  }

  // O chat não altera a partida: a revisão continua 0 e o lance seguinte é aceito.
  host.send({ type: 'move', index: 4, revision: 0 });
  assert.equal((await guest.next('state')).revision, 1);
  await Promise.all([host.close(), guest.close(), watcher.close()]);
});

test('chat: mensagem inválida, fora de sala ou em rajada recebe erro com código', async () => {
  const client = await connect();
  client.send({ type: 'chat', text: 'tem alguém?' });
  assert.equal((await client.next('error')).code, 'no-session');

  client.send({ type: 'host', config });
  const room = await client.next('room');
  for (const text of ['', '   ', 'a'.repeat(201), 42]) {
    client.send({ type: 'chat', text });
    assert.equal((await client.next('error')).code, 'bad-message');
  }
  client.send({ type: 'host', config, name: 'n'.repeat(25) });
  assert.equal((await client.next('error')).code, 'bad-message');

  client.send({ type: 'chat', text: 'primeira' });
  client.send({ type: 'chat', text: 'segunda, cedo demais' });
  assert.equal((await client.next('chat')).entry.text, 'primeira');
  assert.equal((await client.next('error')).code, 'chat-too-fast');
  assert.equal(app.rooms.get(room.code).chat.length, 1);
  await client.close();
});

test('relógio online: o servidor começa a contar quando o O entra e decide a derrota por tempo', async () => {
  const host = await connect();
  host.send({ type: 'host', config, clock: { moveMs: 1000, gameMs: 0 } });
  const room = await host.next('room');
  assert.deepEqual([room.snapshot.clock.moveMs, room.clockStarted], [1000, false]);
  host.send({ type: 'move', index: 4, revision: 0 });
  assert.equal((await host.next('error')).code, 'waiting-opponent');

  const guest = await connect();
  guest.send({ type: 'join', code: room.code });
  const joined = await guest.next('room');
  assert.equal(joined.clockStarted, true);
  assert.equal(typeof joined.serverNow, 'number');
  // O host recebe o relógio já correndo (mesma revisão, novo início do lance).
  const started = await host.next('state');
  assert.deepEqual([started.revision, started.clockStarted], [0, true]);

  const watcher = await connect();
  watcher.send({ type: 'watch', code: room.code });
  await watcher.next('room');

  // Ninguém joga: X perde no relógio e todos recebem a mesma derrota.
  for (const client of [host, guest, watcher]) {
    const ended = await client.next('state');
    assert.deepEqual(
      [ended.revision, ended.snapshot.status, ended.snapshot.result, ended.snapshot.endReason],
      [1, 'won', 'O', 'timeout'],
    );
  }
  host.send({ type: 'move', index: 4, revision: 1 });
  assert.equal((await host.next('error')).code, 'game-over');

  // Reconexão depois do fim: a retomada traz o resultado decidido pelo servidor.
  await guest.close();
  const back = await connect();
  back.send({ type: 'resume', code: room.code, token: joined.token });
  const resumed = await back.next('room');
  assert.deepEqual([resumed.snapshot.endReason, resumed.revision], ['timeout', 1]);
  await Promise.all([host.close(), back.close(), watcher.close()]);
});

test('relógio online: limites inválidos são recusados', async () => {
  const client = await connect();
  client.send({ type: 'host', config, clock: { moveMs: 10, gameMs: 0 } });
  assert.equal((await client.next('error')).code, 'bad-message');
  await client.close();
});

test('moderação: o dono silencia e expulsa; o expulso não volta a assistir; spam é recusado', async () => {
  const host = await connect();
  host.send({ type: 'host', config, name: 'Ana' });
  const room = await host.next('room');
  const watcher = await connect();
  watcher.send({ type: 'watch', code: room.code, name: 'Caio' });
  const watching = await watcher.next('room');
  const { watchers } = await host.next('peer');
  assert.deepEqual(watchers, [{ id: watching.id, name: 'Caio', muted: false }]);

  watcher.send({ type: 'moderate', action: 'kick', target: room.id });
  assert.equal((await watcher.next('error')).code, 'not-host');

  host.send({ type: 'moderate', action: 'mute', target: watching.id });
  assert.equal((await host.next('peer')).watchers[0].muted, true);
  watcher.send({ type: 'chat', text: 'oi' });
  assert.equal((await watcher.next('error')).code, 'muted');

  host.send({ type: 'chat', text: 'regras da sala' });
  await host.next('chat');
  await new Promise((resolve) => setTimeout(resolve, 450)); // passa o intervalo mínimo
  host.send({ type: 'chat', text: 'REGRAS da sala' });
  assert.equal((await host.next('error')).code, 'chat-repeated');

  host.send({ type: 'moderate', action: 'kick', target: watching.id });
  assert.equal((await watcher.next('kicked')).code, room.code);
  assert.equal((await host.next('peer')).spectators, 0);
  watcher.send({ type: 'chat', text: 'ainda estou aqui?' });
  assert.equal((await watcher.next('error')).code, 'no-session');
  watcher.send({ type: 'watch', code: room.code, name: 'Caio' });
  assert.equal((await watcher.next('error')).code, 'banned');
  await Promise.all([host.close(), watcher.close()]);
});
