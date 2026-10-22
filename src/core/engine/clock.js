import { CLOCK_LIMITS } from '../constants.js';

const clampMs = (value, max) =>
  Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;

/**
 * Limites do relógio: `moveMs` (tempo por lance) e `gameMs` (tempo total de cada jogador).
 * Zero desliga o limite; sem nenhum dos dois não há relógio (devolve null).
 */
export function normalizeClockSettings(settings) {
  if (!settings || typeof settings !== 'object') return null;
  const moveMs = clampMs(settings.moveMs, CLOCK_LIMITS.maxMoveMs);
  const gameMs = clampMs(settings.gameMs, CLOCK_LIMITS.maxGameMs);
  return moveMs || gameMs ? { moveMs, gameMs } : null;
}

/** Relógio novo: cada lado começa com `gameMs`; o tempo do primeiro lance corre desde `now`. */
export function createClock(settings, now = Date.now()) {
  const limits = normalizeClockSettings(settings);
  if (!limits) return null;
  return { ...limits, remaining: { X: limits.gameMs, O: limits.gameMs }, turnStartedAt: now };
}

/** Relógio vindo de fora (armazenamento, link): limites e saldos são conferidos campo a campo. */
export function sanitizeClock(clock, now = Date.now()) {
  const clean = createClock(clock, now);
  if (!clean) return null;
  for (const mark of ['X', 'O']) {
    const left = clock.remaining?.[mark];
    if (Number.isFinite(left)) clean.remaining[mark] = clampMs(left, clean.gameMs);
  }
  if (Number.isFinite(clock.turnStartedAt)) clean.turnStartedAt = clock.turnStartedAt;
  return clean;
}

/** Tempo que resta a quem tem a vez (`mark`); `null` no limite que estiver desligado. */
export function timeLeft(clock, mark, now = Date.now()) {
  const elapsed = Math.max(0, now - clock.turnStartedAt);
  return {
    move: clock.moveMs ? Math.max(0, clock.moveMs - elapsed) : null,
    game: clock.gameMs ? Math.max(0, clock.remaining[mark] - elapsed) : null,
  };
}

/** Verdadeiro se o tempo de `mark` (quem tem a vez) acabou, no lance ou na partida. */
export function isFlagged(clock, mark, now = Date.now()) {
  const left = timeLeft(clock, mark, now);
  return left.move === 0 || left.game === 0;
}

/** Relógio depois que `mark` jogou em `now`: desconta o tempo gasto e passa a vez. */
export function pressClock(clock, mark, now = Date.now()) {
  const elapsed = Math.max(0, now - clock.turnStartedAt);
  return {
    ...clock,
    remaining: { ...clock.remaining, [mark]: Math.max(0, clock.remaining[mark] - elapsed) },
    turnStartedAt: now,
  };
}

/**
 * O que o HUD mostra para cada lado: quem tem a vez (`running`) vê o tempo correndo;
 * o outro vê o saldo parado. Com a partida encerrada passe `running = null`.
 */
export function clockView(clock, running, now = Date.now()) {
  const idle = (mark) => ({
    move: clock.moveMs || null,
    game: clock.gameMs ? clock.remaining[mark] : null,
  });
  return {
    X: running === 'X' ? timeLeft(clock, 'X', now) : idle('X'),
    O: running === 'O' ? timeLeft(clock, 'O', now) : idle('O'),
  };
}
