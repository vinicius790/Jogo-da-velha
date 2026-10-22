import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { validateMessage } from './protocol.mjs';
import { RoomManager } from './room.mjs';

const DEFAULT_ORIGINS = 'http://localhost:4173,http://127.0.0.1:4173';
const RATE_WINDOW_MS = 1000;
const HEARTBEAT_MS = 30_000;
/** Frequência com que o servidor confere o relógio das salas (precisão da derrota por tempo). */
const CLOCK_TICK_MS = 200;

/** Lê a configuração do ambiente (ver .env.example). */
export function configFromEnv(env = process.env) {
  return {
    port: Number(env.OMEGA_SERVER_PORT ?? 8787),
    roomLimit: Number(env.OMEGA_ROOM_LIMIT ?? 32),
    maxRooms: Number(env.OMEGA_MAX_ROOMS ?? 500),
    maxRoomsPerIp: Number(env.OMEGA_MAX_ROOMS_PER_IP ?? 8),
    ttlMs: Number(env.OMEGA_ROOM_TTL_MS ?? 10_800_000),
    corsOrigin: env.OMEGA_CORS_ORIGIN ?? DEFAULT_ORIGINS,
    trustProxy: env.OMEGA_TRUST_PROXY === '1',
    maxMessagesPerSecond: Number(env.OMEGA_RATE_LIMIT ?? 40),
    maxConnectionsPerIp: Number(env.OMEGA_MAX_CONNECTIONS_PER_IP ?? 16),
  };
}

/**
 * Cria (sem iniciar) o servidor de salas.
 * - Origin: só as origens de `corsOrigin` (lista separada por vírgulas, ou `*`) podem abrir
 *   WebSocket e ler o endpoint HTTP.
 * - Limites por IP: conexões simultâneas, salas criadas e mensagens por segundo (somando todas
 *   as conexões).
 */
export function createOmegaServer(options = {}) {
  const config = { ...configFromEnv({}), ...options };
  const allowAll = config.corsOrigin.trim() === '*';
  const allowed = new Set(
    config.corsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const originAllowed = (origin) => allowAll || (Boolean(origin) && allowed.has(origin));

  const rooms = new RoomManager({
    maxClients: config.roomLimit,
    maxRooms: config.maxRooms,
    maxRoomsPerOwner: config.maxRoomsPerIp,
    ttlMs: config.ttlMs,
  });
  const sessions = new Map(); // socket → { ip, room, token }
  const perIp = new Map(); // ip → { connections, windowStart, count }

  // Com proxy, vale o último endereço de X-Forwarded-For: é o que o proxy confiável acrescentou.
  // O primeiro é escrito pelo próprio cliente e serviria para burlar os limites por IP.
  const clientIp = (request) => {
    const forwarded = config.trustProxy ? request.headers['x-forwarded-for'] : null;
    const last = forwarded ? String(forwarded).split(',').at(-1).trim() : '';
    return last || request.socket.remoteAddress;
  };

  const server = http.createServer((request, response) => {
    const origin = request.headers.origin;
    const headers = {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      vary: 'Origin',
    };
    if (allowAll) headers['access-control-allow-origin'] = '*';
    else if (originAllowed(origin)) headers['access-control-allow-origin'] = origin;

    // Sem `new URL`: um alvo malformado (ex.: `GET http://a:99999/`) lançaria fora do try e
    // derrubaria o processo.
    const path = String(request.url ?? '').split('?')[0];
    if (request.method !== 'GET' || (path !== '/' && path !== '/health')) {
      response.writeHead(404, headers);
      response.end(JSON.stringify({ error: 'not-found' }));
      return;
    }
    response.writeHead(200, headers);
    response.end(
      JSON.stringify({
        service: 'omega-tictactoe',
        status: 'ok',
        rooms: rooms.rooms.size,
        connections: sessions.size,
      }),
    );
  });

  const wss = new WebSocketServer({
    server,
    maxPayload: 4096,
    verifyClient: ({ origin, req }, done) => {
      if (!originAllowed(origin)) return done(false, 403, 'Origin not allowed');
      const usage = perIp.get(clientIp(req));
      if (usage && usage.connections >= config.maxConnectionsPerIp) {
        return done(false, 429, 'Too many connections');
      }
      return done(true);
    },
  });

  const send = (socket, message) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  };
  const sendError = (socket, code, message) => send(socket, { type: 'error', code, message });
  const broadcast = (code, message, except = null) => {
    for (const [socket, session] of sessions) {
      if (session.room === code && socket !== except) send(socket, message);
    }
  };
  /** Avisa todos da sala sobre quem está presente (entrada, saída, reconexão). */
  const broadcastPeers = (code, except = null) => {
    if (!rooms.get(code)) return;
    const { players, spectators, watchers } = rooms.snapshot(code);
    broadcast(code, { type: 'peer', code, players, spectators, watchers }, except);
  };
  /** Sai da sala atual (se houver) antes de entrar em outra com a mesma conexão. */
  const leaveCurrent = (session) => {
    if (!session.room) return;
    rooms.leave(session.room, session.token);
    const previous = session.room;
    session.room = null;
    session.token = null;
    broadcastPeers(previous);
  };

  /** Estado atual da sala para todos (ou todos menos `except`). */
  const broadcastState = (code, except = null) => {
    if (rooms.get(code)) broadcast(code, { type: 'state', ...rooms.snapshot(code) }, except);
  };

  const handlers = {
    host(socket, session, message) {
      leaveCurrent(session);
      const view = rooms.create({
        config: message.config,
        owner: session.ip,
        name: message.name,
        clock: message.clock ?? null,
      });
      Object.assign(session, { room: view.code, token: view.token });
      send(socket, { type: 'room', ...view });
    },
    join(socket, session, message) {
      leaveCurrent(session);
      const view = rooms.join(message.code, message.name, { origin: session.ip });
      Object.assign(session, { room: view.code, token: view.token });
      send(socket, { type: 'room', ...view });
      broadcastPeers(view.code);
      // Com relógio, a entrada do segundo jogador dá a partida: todos recebem o relógio correndo.
      if (view.snapshot.clock) broadcastState(view.code, socket);
    },
    watch(socket, session, message) {
      leaveCurrent(session);
      const view = rooms.watch(message.code, message.name, { origin: session.ip });
      Object.assign(session, { room: view.code, token: view.token });
      send(socket, { type: 'room', ...view });
      broadcastPeers(view.code);
    },
    resume(socket, session, message) {
      leaveCurrent(session);
      const view = rooms.resume(message.code, message.token);
      // A conexão antiga do mesmo participante (se ainda existir) deixa de receber a sala.
      for (const other of sessions.values()) {
        if (other !== session && other.token === view.token) {
          other.room = null;
          other.token = null;
        }
      }
      Object.assign(session, { room: view.code, token: view.token });
      send(socket, { type: 'room', ...view });
      broadcastPeers(view.code);
    },
    move(socket, session, message) {
      if (!session.room) {
        sendError(socket, 'no-session', 'Sessão online inexistente.');
        return;
      }
      const update = rooms.move(session.room, session.token, message.index, message.revision);
      broadcast(update.code, { type: 'state', ...update });
    },
    /** Chat da sala: vale para jogadores e espectadores; todos na sala recebem a mensagem. */
    chat(socket, session, message) {
      if (!session.room) {
        sendError(socket, 'no-session', 'Sessão online inexistente.');
        return;
      }
      const update = rooms.chat(session.room, session.token, message.text);
      broadcast(update.code, { type: 'chat', ...update });
    },
    /** Moderação (só o dono da sala): silenciar, liberar ou expulsar um espectador. */
    moderate(socket, session, message) {
      if (!session.room) {
        sendError(socket, 'no-session', 'Sessão online inexistente.');
        return;
      }
      const result = rooms.moderate(session.room, session.token, message.action, message.target);
      if (result.token) {
        for (const [other, otherSession] of sessions) {
          if (otherSession.token !== result.token) continue;
          otherSession.room = null;
          otherSession.token = null;
          send(other, { type: 'kicked', code: result.code });
        }
      }
      broadcastPeers(result.code);
    },
    ping(socket) {
      send(socket, { type: 'pong', at: Date.now() });
    },
  };

  wss.on('connection', (socket, request) => {
    const ip = clientIp(request);
    const usage = perIp.get(ip) ?? { connections: 0, windowStart: Date.now(), count: 0 };
    usage.connections += 1;
    perIp.set(ip, usage);
    const session = { ip, room: null, token: null };
    sessions.set(socket, session);
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', (raw) => {
      const now = Date.now();
      if (now - usage.windowStart > RATE_WINDOW_MS) {
        usage.windowStart = now;
        usage.count = 0;
      }
      usage.count += 1;
      if (usage.count > config.maxMessagesPerSecond) {
        sendError(socket, 'rate-limit', 'Limite de mensagens excedido.');
        return;
      }
      try {
        const message = JSON.parse(raw.toString('utf8'));
        if (!validateMessage(message)) {
          sendError(socket, 'bad-message', 'Mensagem rejeitada.');
          return;
        }
        handlers[message.type](socket, session, message);
      } catch (error) {
        sendError(socket, error.code ?? 'bad-message', error.message ?? 'Mensagem inválida.');
      }
    });

    socket.on('close', () => {
      sessions.delete(socket);
      usage.connections -= 1;
      if (usage.connections <= 0) perIp.delete(ip);
      leaveCurrent(session);
    });
  });

  // Derruba conexões que pararam de responder e varre salas expiradas.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
    rooms.sweep();
  }, HEARTBEAT_MS);
  heartbeat.unref();

  // Relógio autoritativo: a derrota por tempo é decidida aqui e enviada a todos na sala.
  const clockTimer = setInterval(() => {
    for (const code of rooms.checkClocks()) broadcastState(code);
  }, CLOCK_TICK_MS);
  clockTimer.unref();

  return {
    server,
    rooms,
    listen: (port = config.port) =>
      new Promise((resolve) => {
        server.listen(port, () => resolve(server.address().port));
      }),
    close: () =>
      new Promise((resolve) => {
        clearInterval(heartbeat);
        clearInterval(clockTimer);
        for (const socket of wss.clients) socket.terminate();
        wss.close(() => server.close(() => resolve()));
      }),
  };
}

// Execução direta: `node server/server.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = configFromEnv();
  const port = await createOmegaServer(config).listen();
  console.log(`OMEGA multiplayer ouvindo na porta ${port} (origens: ${config.corsOrigin})`);
}
