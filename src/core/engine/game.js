import { DEFAULT_CONFIG } from '../constants.js';
import { OmegaError, makeId } from '../types.js';
import { emptyBoard, fadeOldestPiece, full, opponent, resolveMoveIndex } from './board.js';
import { createClock, isFlagged, pressClock, sanitizeClock, timeLeft } from './clock.js';
import { normalizeConfig, sanitizeMeta, validateSnapshot } from './validator.js';
import { findWinningLine } from './win.js';

function createState({ id, mode, config, difficulty, starter, meta, clock }) {
  const now = Date.now();
  return {
    id,
    mode,
    config,
    difficulty,
    starter,
    current: starter,
    board: emptyBoard(config),
    status: 'playing',
    result: null,
    winningLine: null,
    /** 'timeout' quando a partida acabou no relógio; null nos demais casos. */
    endReason: null,
    /** Relógio (ver clock.js) ou null quando a partida não tem limite de tempo. */
    clock: createClock(clock, now),
    moves: [],
    redo: [],
    meta,
    createdAt: now,
    updatedAt: now,
  };
}

/** Motor de regras: toda mudança de estado passa por aqui; a interface só lê `state`. */
export class GameEngine {
  #s;

  constructor({
    id = makeId('game'),
    mode = 'ai',
    config = DEFAULT_CONFIG,
    difficulty = 'normal',
    starter = 'X',
    meta = null,
    clock = null,
  } = {}) {
    this.#s = createState({
      id,
      mode,
      config: normalizeConfig(config),
      difficulty,
      starter,
      meta: sanitizeMeta(meta),
      clock,
    });
  }

  /** Reconstrói um motor a partir de um snapshot não confiável (valida antes de adotar). */
  static from(snapshot) {
    validateSnapshot(snapshot);
    const game = new GameEngine({ config: snapshot.config });
    const state = structuredClone(snapshot);
    state.config = normalizeConfig(snapshot.config);
    state.meta = sanitizeMeta(snapshot.meta);
    state.clock = sanitizeClock(snapshot.clock);
    // Só uma vitória pode ter sido no relógio (o validador não olha `endReason` de abortadas).
    state.endReason =
      snapshot.endReason === 'timeout' && snapshot.status === 'won' ? 'timeout' : null;
    // A pilha de "refazer" é apenas conveniência local: descartada se vier malformada.
    const redoOk =
      Array.isArray(state.redo) &&
      state.redo.every((move) => move && Number.isInteger(move.index) && move.index >= 0);
    if (!redoOk) state.redo = [];
    game.#s = state;
    return game;
  }

  get state() {
    return structuredClone(this.#s);
  }

  /** `now` só importa em partidas com relógio (os testes passam um instante fixo). */
  play(index, now = Date.now()) {
    this.#apply(index, now);
    this.#s.redo = [];
    return this.state;
  }

  undo() {
    const s = this.#s;
    // Derrota no relógio é definitiva: não há lance a desfazer.
    if (s.endReason === 'timeout') return this.state;
    const move = s.moves.pop();
    if (!move) return this.state;
    // O tempo já gasto não é devolvido; só o cronômetro do lance recomeça.
    if (s.clock) s.clock.turnStartedAt = Date.now();
    s.redo.push(move);
    s.board[move.index] = null;
    if (move.fadedIndex !== undefined && move.fadedIndex !== null) {
      s.board[move.fadedIndex] = move.mark;
    }
    s.current = move.mark;
    s.status = 'playing';
    s.result = null;
    s.winningLine = null;
    s.updatedAt = Date.now();
    return this.state;
  }

  /** Refaz um lance desfeito, preservando o restante da pilha para refazer em sequência. */
  redoMove() {
    const move = this.#s.redo.at(-1);
    if (!move) return this.state;
    this.#apply(move.requestedIndex ?? move.index);
    this.#s.redo.pop();
    return this.state;
  }

  /** Volta ao início mantendo modo, configuração, dificuldade e quem começa. */
  reset() {
    const { mode, config, difficulty, starter, meta, clock } = this.#s;
    this.#s = createState({ id: makeId('game'), mode, config, difficulty, starter, meta, clock });
    return this.state;
  }

  abort() {
    this.#s.status = 'aborted';
    this.#s.result = 'aborted';
    this.#s.updatedAt = Date.now();
    return this.state;
  }

  /** Tempo restante de quem tem a vez (`{ move, game }` em ms) ou null sem relógio. */
  timeLeft(now = Date.now()) {
    const s = this.#s;
    return s.clock && s.status === 'playing' ? timeLeft(s.clock, s.current, now) : null;
  }

  /** Encerra a partida se o tempo de quem tem a vez acabou. Chame periodicamente. */
  checkClock(now = Date.now()) {
    const s = this.#s;
    if (s.status === 'playing' && s.clock && isFlagged(s.clock, s.current, now)) {
      this.timeout(now);
    }
    return this.state;
  }

  /** Recomeça o cronômetro do lance atual (partida retomada depois de fechar a página). */
  resumeClock(now = Date.now()) {
    if (this.#s.clock) this.#s.clock.turnStartedAt = now;
    return this.state;
  }

  /** Derrota por tempo de quem tem a vez (vale em qualquer variante, inclusive Misère). */
  timeout(now = Date.now()) {
    const s = this.#s;
    if (s.status !== 'playing') throw new OmegaError('game-over', 'Partida encerrada.');
    if (s.clock) s.clock = pressClock(s.clock, s.current, now);
    s.status = 'won';
    s.result = opponent(s.current);
    s.winningLine = null;
    s.endReason = 'timeout';
    s.updatedAt = now;
    return this.state;
  }

  #apply(index, now = Date.now()) {
    const s = this.#s;
    if (s.status !== 'playing') throw new OmegaError('game-over', 'Partida encerrada.');
    const mark = s.current;
    if (s.clock && isFlagged(s.clock, mark, now)) {
      this.timeout(now);
      throw new OmegaError('time-expired', 'Tempo esgotado.');
    }
    const target = resolveMoveIndex(s.board, index, s.config);
    let fadedIndex = null;
    if (s.config.variant === 'fade') {
      const fade = fadeOldestPiece(s.board, s.moves, mark);
      s.board = fade.board;
      fadedIndex = fade.fadedIndex;
    }
    s.board[target] = mark;
    s.moves.push({
      index: target,
      requestedIndex: index,
      mark,
      turn: s.moves.length + 1,
      at: now,
      fadedIndex,
    });
    if (s.clock) s.clock = pressClock(s.clock, mark, now);
    const line = findWinningLine(s.board, target, mark, s.config);
    if (line) {
      s.status = 'won';
      s.result = s.config.variant === 'misere' ? opponent(mark) : mark;
      s.winningLine = line;
    } else if (full(s.board)) {
      s.status = 'draw';
      s.result = 'draw';
    } else {
      s.current = opponent(mark);
    }
    s.updatedAt = now;
  }
}
