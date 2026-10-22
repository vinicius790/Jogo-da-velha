const MAX_RECONNECT_ATTEMPTS = 5;
// Mesmos limites de server/protocol.mjs (o servidor valida de novo).
export const CHAT_MAX_LENGTH = 200;
const NAME_MAX_LENGTH = 24;
const HEARTBEAT_MS = 20_000;

/**
 * Cliente do servidor de salas (ver server/). O servidor é a autoridade: o cliente só envia
 * a intenção de jogada e a revisão que observou, e adota os snapshots que recebe.
 * Se a conexão cair com uma sessão ativa, tenta reconectar e retomar com `resume`.
 */
export class RealtimeClient {
  #ws = null;
  #heartbeat = null;
  #attempts = 0;
  #closedByUser = false;

  constructor(url, { onMessage, onStatus } = {}) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.room = null;
    this.token = null;
    this.revision = 0;
    this.role = null;
    this.name = '';
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.#ws = ws;
      ws.onopen = () => {
        this.#attempts = 0;
        this.#heartbeat = setInterval(() => this.#send('ping'), HEARTBEAT_MS);
        this.onStatus?.('connected');
        resolve();
      };
      ws.onerror = () => reject(new Error('WebSocket error'));
      ws.onclose = () => {
        clearInterval(this.#heartbeat);
        this.onStatus?.('closed');
        if (!this.#closedByUser && this.room && this.token) this.#reconnect();
      };
      ws.onmessage = (event) => this.#receive(event);
    });
  }

  #reconnect() {
    if (this.#attempts >= MAX_RECONNECT_ATTEMPTS) {
      this.onStatus?.('lost');
      return;
    }
    this.#attempts += 1;
    this.onStatus?.('reconnecting');
    setTimeout(
      () => {
        this.connect()
          // O servidor remove o espectador que cai (o token dele deixa de valer): ele volta
          // assistindo de novo. Jogadores retomam o lugar com o token.
          .then(() =>
            this.role === 'spectator'
              ? this.watch(this.room, this.name)
              : this.#send('resume', { code: this.room, token: this.token }),
          )
          .catch(() => {
            // onclose da tentativa que falhou agenda a próxima
          });
      },
      500 * 2 ** this.#attempts,
    );
  }

  #receive(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      this.onStatus?.('protocol-error');
      return;
    }
    if (message.type === 'room') {
      this.room = message.code;
      this.token = message.token;
      this.revision = message.revision;
      this.role = message.role;
      this.name = message.name;
    }
    if (message.type === 'state') {
      if (message.revision < this.revision) return; // snapshot atrasado
      this.revision = message.revision;
    }
    if (message.type === 'kicked') {
      // Expulso pelo dono da sala: sem sessão, não há o que retomar se a conexão cair.
      this.room = null;
      this.token = null;
    }
    this.onMessage?.(message);
  }

  #send(type, payload = {}) {
    if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error('WebSocket desconectado.');
    this.#ws.send(JSON.stringify({ type, ...payload }));
  }

  /**
   * `name` (opcional) é o nome exibido no chat e na lista de presentes. `clock`
   * (`{ moveMs, gameMs }`, opcional) liga o relógio da sala, controlado pelo servidor.
   */
  host(config, name, clock) {
    const timed = clock && (clock.moveMs > 0 || clock.gameMs > 0);
    const limits = timed ? { clock: { moveMs: clock.moveMs, gameMs: clock.gameMs } } : {};
    this.#send('host', { config, ...named(name), ...limits });
  }

  join(code, name) {
    this.#send('join', { code: normalizeCode(code), ...named(name) });
  }

  /** Entra como espectador: recebe os lances e o chat, mas não joga. */
  watch(code, name) {
    this.#send('watch', { code: normalizeCode(code), ...named(name) });
  }

  chat(text) {
    this.#send('chat', { text: String(text).slice(0, CHAT_MAX_LENGTH) });
  }

  /** Moderação (só quem criou a sala): `mute`, `unmute` ou `kick` do espectador `target`. */
  moderate(action, target) {
    this.#send('moderate', { action, target });
  }

  move(index) {
    this.#send('move', { index, revision: this.revision });
  }

  close() {
    this.#closedByUser = true;
    clearInterval(this.#heartbeat);
    this.#ws?.close();
  }
}

function named(name) {
  const clean = String(name ?? '')
    .trim()
    .slice(0, NAME_MAX_LENGTH);
  return clean ? { name: clean } : {};
}

function normalizeCode(code) {
  return String(code).trim().toUpperCase();
}
