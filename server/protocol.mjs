import { CLOCK_LIMITS } from '../src/core/constants.js';
import { validateConfig } from '../src/core/engine/validator.js';

export const MESSAGE_TYPES = Object.freeze([
  'host',
  'join',
  'watch',
  'resume',
  'move',
  'chat',
  'moderate',
  'ping',
]);
export const MODERATION_ACTIONS = Object.freeze(['mute', 'unmute', 'kick']);
/** Menor limite de relógio aceito numa sala (abaixo disso a rede decide a partida). */
export const MIN_CLOCK_MS = 1000;
export const CHAT_MAX_LENGTH = 200;
export const NAME_MAX_LENGTH = 24;
const CODE = /^[A-Z0-9]{6}$/;
const TOKEN = /^[A-Za-z0-9_-]{24,64}$/;
const MAX_INDEX = 12 * 12 - 1;

const isCode = (value) => typeof value === 'string' && CODE.test(value.toUpperCase());

/** Nome de exibição é opcional; quando vem, é um texto curto. */
const isName = (value) =>
  value === undefined || (typeof value === 'string' && value.length <= NAME_MAX_LENGTH);

/** Limite de relógio: 0 (desligado) ou um inteiro entre `MIN_CLOCK_MS` e `max`. */
const isLimit = (value, max) =>
  value === 0 || (Number.isInteger(value) && value >= MIN_CLOCK_MS && value <= max);

/** Relógio da sala é opcional; quando vem, os dois limites são conferidos. */
const isClock = (clock) =>
  clock === undefined ||
  clock === null ||
  (typeof clock === 'object' &&
    !Array.isArray(clock) &&
    isLimit(clock.moveMs, CLOCK_LIMITS.maxMoveMs) &&
    isLimit(clock.gameMs, CLOCK_LIMITS.maxGameMs));

/**
 * Texto de chat ou nome pronto para guardar: sem caracteres de controle, espaços colapsados
 * e no máximo `max` caracteres. O cliente exibe o resultado sempre como texto, nunca como HTML.
 * `\p{Cs}` pega surrogates soltos (ex.: emoji que o cliente cortou ao meio no limite de tamanho);
 * o corte final também não deixa meio emoji para trás.
 */
export function cleanText(value, max) {
  return String(value ?? '')
    .replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/\p{Cs}$/u, '')
    .trim();
}

/** Mesma regra de configuração usada pelo motor do jogo. */
export function validConfigEnvelope(config) {
  try {
    return validateConfig(config);
  } catch {
    return false;
  }
}

/** Valida o formato de uma mensagem do cliente antes de qualquer processamento. */
export function validateMessage(message) {
  if (!message || typeof message !== 'object' || !MESSAGE_TYPES.includes(message.type)) {
    return false;
  }
  switch (message.type) {
    case 'host':
      return validConfigEnvelope(message.config) && isName(message.name) && isClock(message.clock);
    case 'join':
    case 'watch':
      return isCode(message.code) && isName(message.name);
    case 'chat':
      return (
        typeof message.text === 'string' &&
        message.text.length <= CHAT_MAX_LENGTH &&
        cleanText(message.text, CHAT_MAX_LENGTH).length > 0
      );
    case 'moderate':
      return (
        MODERATION_ACTIONS.includes(message.action) &&
        Number.isInteger(message.target) &&
        message.target >= 1
      );
    case 'resume':
      return isCode(message.code) && typeof message.token === 'string' && TOKEN.test(message.token);
    case 'move':
      return (
        Number.isInteger(message.index) &&
        message.index >= 0 &&
        message.index <= MAX_INDEX &&
        Number.isInteger(message.revision) &&
        message.revision >= 0
      );
    default:
      return true; // ping
  }
}
