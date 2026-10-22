import crypto from 'node:crypto';
import { GameEngine } from '../src/core/engine/game.js';
import { OmegaError } from '../src/core/types.js';
import { CHAT_MAX_LENGTH, NAME_MAX_LENGTH, cleanText } from './protocol.mjs';

const CHAT_HISTORY = 50;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, fáceis de confundir

function randomCode() {
  return Array.from(crypto.randomBytes(6), (byte) => CODE_ALPHABET[byte % 32]).join('');
}

function randomToken() {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Salas em memória. O estado da partida vive só aqui: os clientes enviam a intenção de lance
 * e recebem snapshots. Cada participante é identificado por um token secreto emitido ao entrar
 * e por um número público (`id`), usado na moderação.
 * Jogadores e espectadores conversam pelo chat da sala; as últimas mensagens ficam guardadas
 * para quem entrar depois. Quem criou a sala pode silenciar ou expulsar espectadores.
 *
 * Relógio (opcional, escolhido por quem cria a sala): o servidor é a autoridade. Ele começa a
 * correr quando o segundo jogador entra, continua correndo se alguém cair, e a derrota por tempo
 * é decidida aqui (`checkClocks`, chamado periodicamente pelo servidor, ou no lance atrasado).
 */
export class RoomManager {
  constructor({
    maxClients = 32,
    maxRooms = 500,
    maxRoomsPerOwner = Infinity,
    ttlMs = 3 * 60 * 60_000,
    chatCooldownMs = 400,
    repeatWindowMs = 30_000,
  } = {}) {
    this.maxClients = maxClients;
    this.maxRooms = maxRooms;
    this.maxRoomsPerOwner = maxRoomsPerOwner;
    this.ttlMs = ttlMs;
    this.chatCooldownMs = chatCooldownMs;
    /** A mesma mensagem do mesmo participante dentro desta janela é recusada (spam). */
    this.repeatWindowMs = repeatWindowMs;
    this.rooms = new Map();
  }

  /**
   * `owner` identifica quem criou a sala (o servidor passa o IP). Sem o limite por dono, uma
   * única conexão enchia todas as `maxRooms` vagas em segundos e bloqueava o servidor até o TTL.
   * `clock` (`{ moveMs, gameMs }`, opcional) liga o relógio da sala.
   */
  create({ config, owner = null, name = '', clock = null }) {
    this.sweep();
    if (this.rooms.size >= this.maxRooms) {
      throw new OmegaError('server-full', 'Limite de salas atingido.');
    }
    if (owner !== null) {
      let owned = 0;
      for (const room of this.rooms.values()) if (room.owner === owner) owned += 1;
      if (owned >= this.maxRoomsPerOwner) {
        throw new OmegaError('too-many-rooms', 'Limite de salas por endereço atingido.');
      }
    }
    const game = new GameEngine({ mode: 'online', config, starter: 'X', clock });
    let code;
    do code = randomCode();
    while (this.rooms.has(code));
    const token = randomToken();
    const room = {
      code,
      owner,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
      game,
      revision: 0,
      /** Com relógio, ele só corre depois que o segundo jogador entra. */
      clockStarted: false,
      chat: [],
      chatSeq: 0,
      nextId: 1,
      /** Origens (IPs) de espectadores expulsos: não voltam a assistir esta sala. */
      banned: new Set(),
      participants: new Map(),
    };
    room.participants.set(
      token,
      this.#participant(room, { role: 'host', symbol: 'X', name, origin: owner }),
    );
    this.rooms.set(code, room);
    return this.#view(room, token);
  }

  /** `origin` identifica a conexão (o servidor passa o IP); `now` só importa com relógio. */
  join(code, name = '', { origin = null, now = Date.now() } = {}) {
    const room = this.#require(code);
    const hasGuest = [...room.participants.values()].some((p) => p.role === 'guest');
    if (hasGuest) throw new OmegaError('room-taken', 'A sala já possui dois jogadores.');
    const view = this.#enter(room, { role: 'guest', symbol: 'O', name, origin });
    if (room.game.state.clock && !room.clockStarted) {
      room.game.resumeClock(now);
      room.clockStarted = true;
      Object.assign(view, { snapshot: room.game.state, clockStarted: true });
    }
    return view;
  }

  watch(code, name = '', { origin = null } = {}) {
    const room = this.#require(code);
    if (origin !== null && room.banned.has(origin)) {
      throw new OmegaError('banned', 'Você foi removido desta sala.');
    }
    return this.#enter(room, { role: 'spectator', symbol: null, name, origin });
  }

  /** Retoma uma sessão (reconexão) com o token recebido ao entrar. O relógio não para. */
  resume(code, token) {
    const room = this.get(code);
    const participant = room?.participants.get(token);
    if (!participant) throw new OmegaError('room-unavailable', 'Sessão não encontrada.');
    participant.connected = true;
    room.expiresAt = Date.now() + this.ttlMs;
    return this.#view(room, token);
  }

  /**
   * Conexão encerrada. Espectadores saem da sala; jogadores mantêm o lugar (podem voltar com
   * `resume`), apenas marcados como desconectados.
   */
  leave(code, token) {
    const room = this.get(code);
    const participant = room?.participants.get(token);
    if (!participant) return false;
    if (participant.role === 'spectator') room.participants.delete(token);
    else participant.connected = false;
    return true;
  }

  get(code) {
    const room = this.rooms.get(String(code ?? '').toUpperCase());
    if (room && room.expiresAt <= Date.now()) {
      this.rooms.delete(room.code);
      return null;
    }
    return room ?? null;
  }

  /** Aplica um lance depois de checar autenticação, papel, revisão, turno e relógio. */
  move(code, token, index, baseRevision, now = Date.now()) {
    const room = this.#require(code);
    const participant = room.participants.get(token);
    if (!participant) throw new OmegaError('no-session', 'Não autorizado.');
    if (participant.role === 'spectator') {
      throw new OmegaError('spectator', 'Espectador não pode jogar.');
    }
    if (baseRevision !== room.revision) {
      throw new OmegaError('stale-revision', 'Estado desatualizado. Sincronize a partida.');
    }
    const state = room.game.state;
    if (state.status !== 'playing') throw new OmegaError('game-over', 'Partida encerrada.');
    if (state.current !== participant.symbol) {
      throw new OmegaError('not-your-turn', 'Não é sua vez.');
    }
    if (state.clock && !room.clockStarted) {
      throw new OmegaError('waiting-opponent', 'Aguarde o segundo jogador para começar.');
    }
    try {
      room.game.play(index, now); // lança OmegaError se o lance for ilegal
    } catch (error) {
      // Lance depois do tempo: o motor já encerrou a partida; todos recebem a derrota por tempo.
      if (error.code !== 'time-expired') throw error;
    }
    room.revision += 1;
    room.expiresAt = Date.now() + this.ttlMs;
    return this.snapshot(code);
  }

  /**
   * Mensagem de chat de um participante (jogador ou espectador). O texto é limpo aqui, mesmo
   * que o protocolo já o tenha validado: a sala não depende de quem a chama.
   */
  chat(code, token, text, now = Date.now()) {
    const room = this.#require(code);
    const participant = room.participants.get(token);
    if (!participant) throw new OmegaError('no-session', 'Não autorizado.');
    const clean = cleanText(text, CHAT_MAX_LENGTH);
    if (!clean) throw new OmegaError('bad-message', 'Mensagem vazia.');
    if (participant.muted) throw new OmegaError('muted', 'Você foi silenciado nesta sala.');
    if (now - participant.lastChatAt < this.chatCooldownMs) {
      throw new OmegaError('chat-too-fast', 'Aguarde antes de enviar outra mensagem.');
    }
    // Filtro de spam: repetir a própria mensagem (sem diferença de maiúsculas) logo em seguida.
    const repeatKey = clean.toLowerCase();
    if (repeatKey === participant.lastText && now - participant.lastChatAt < this.repeatWindowMs) {
      throw new OmegaError('chat-repeated', 'Mensagem repetida.');
    }
    participant.lastChatAt = now;
    participant.lastText = repeatKey;
    room.chatSeq += 1;
    const entry = {
      id: room.chatSeq,
      role: participant.role,
      symbol: participant.symbol,
      name: participant.name,
      text: clean,
      at: now,
    };
    room.chat.push(entry);
    if (room.chat.length > CHAT_HISTORY) room.chat.shift();
    room.expiresAt = Date.now() + this.ttlMs;
    return { code: room.code, entry: { ...entry } };
  }

  /**
   * Moderação pelo dono da sala (`host`), sempre sobre um espectador (`targetId` público):
   * `mute`/`unmute` ligam o silêncio no chat; `kick` remove o espectador e impede que a mesma
   * origem volte a assistir. Devolve o token removido (no `kick`) para o servidor desligá-lo.
   */
  moderate(code, token, action, targetId) {
    const room = this.#require(code);
    const moderator = room.participants.get(token);
    if (!moderator) throw new OmegaError('no-session', 'Não autorizado.');
    if (moderator.role !== 'host') {
      throw new OmegaError('not-host', 'Só quem criou a sala pode moderar.');
    }
    if (!['mute', 'unmute', 'kick'].includes(action)) {
      throw new OmegaError('bad-message', 'Ação inválida.');
    }
    const found = [...room.participants].find(([, p]) => p.id === targetId);
    if (!found || found[1].role !== 'spectator') {
      throw new OmegaError('bad-target', 'Espectador inexistente.');
    }
    const [targetToken, target] = found;
    if (action === 'kick') {
      room.participants.delete(targetToken);
      if (target.origin !== null) room.banned.add(target.origin);
      return { code: room.code, action, target: targetId, token: targetToken };
    }
    target.muted = action === 'mute';
    return { code: room.code, action, target: targetId, token: null };
  }

  /**
   * Encerra no relógio as partidas em que o tempo de quem tem a vez acabou. Devolve os códigos
   * das salas que mudaram (o servidor envia o novo estado a todos nelas).
   */
  checkClocks(now = Date.now()) {
    const changed = [];
    for (const room of this.rooms.values()) {
      if (!room.clockStarted || room.expiresAt <= now) continue;
      const left = room.game.timeLeft(now); // null sem relógio ou com a partida encerrada
      if (!left || (left.move !== 0 && left.game !== 0)) continue;
      room.game.checkClock(now);
      room.revision += 1;
      changed.push(room.code);
    }
    return changed;
  }

  /** Estado público da sala (sem tokens). `serverNow` deixa o cliente acertar o relógio. */
  snapshot(code) {
    const room = this.#require(code);
    const participants = [...room.participants.values()];
    const spectators = participants.filter((p) => p.role === 'spectator');
    return {
      code: room.code,
      snapshot: room.game.state,
      revision: room.revision,
      serverNow: Date.now(),
      clockStarted: room.clockStarted,
      players: participants
        .filter((p) => p.role !== 'spectator')
        .map((p) => ({ id: p.id, symbol: p.symbol, connected: p.connected, name: p.name })),
      spectators: spectators.length,
      watchers: spectators.map((p) => ({ id: p.id, name: p.name, muted: p.muted })),
    };
  }

  /** Remove salas expiradas; devolve quantas saíram. */
  sweep(now = Date.now()) {
    let removed = 0;
    for (const [code, room] of this.rooms) {
      if (room.expiresAt <= now) {
        this.rooms.delete(code);
        removed += 1;
      }
    }
    return removed;
  }

  #require(code) {
    const room = this.get(code);
    if (!room) throw new OmegaError('room-unavailable', 'Sala indisponível.');
    return room;
  }

  #enter(room, participant) {
    if (room.participants.size >= this.maxClients) {
      throw new OmegaError('room-full', 'Sala lotada.');
    }
    const token = randomToken();
    room.participants.set(token, this.#participant(room, participant));
    room.expiresAt = Date.now() + this.ttlMs;
    return this.#view(room, token);
  }

  #participant(room, { role, symbol, name, origin = null }) {
    const id = room.nextId;
    room.nextId += 1;
    return {
      id,
      role,
      symbol,
      name: cleanText(name, NAME_MAX_LENGTH),
      /** Só no servidor (nunca enviado): impede a volta de quem foi expulso. */
      origin,
      connected: true,
      muted: false,
      lastChatAt: -Infinity,
      lastText: '',
    };
  }

  #view(room, token) {
    const { id, role, symbol, name } = room.participants.get(token);
    return {
      code: room.code,
      token,
      id,
      role,
      symbol,
      name,
      chat: room.chat.map((entry) => ({ ...entry })),
      snapshot: room.game.state,
      revision: room.revision,
      serverNow: Date.now(),
      clockStarted: room.clockStarted,
    };
  }
}
