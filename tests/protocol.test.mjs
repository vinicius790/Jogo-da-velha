import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHAT_MAX_LENGTH,
  MESSAGE_TYPES,
  MODERATION_ACTIONS,
  cleanText,
  validConfigEnvelope,
  validateMessage,
} from '../server/protocol.mjs';

const config = { size: 3, winLength: 3, variant: 'classic' };
const token = 'abcdefghijklmnopqrstuvwxyz012345';

test('mensagens válidas são aceitas', () => {
  assert.equal(validateMessage({ type: 'host', config }), true);
  assert.equal(validateMessage({ type: 'join', code: 'AB12CD' }), true);
  assert.equal(validateMessage({ type: 'join', code: 'ab12cd' }), true);
  assert.equal(validateMessage({ type: 'watch', code: 'AB12CD' }), true);
  assert.equal(validateMessage({ type: 'resume', code: 'AB12CD', token }), true);
  assert.equal(validateMessage({ type: 'move', index: 4, revision: 0 }), true);
  assert.equal(validateMessage({ type: 'ping' }), true);
});

test('mensagens malformadas são rejeitadas', () => {
  const invalid = [
    null,
    'host',
    {},
    { type: 'desconhecido' },
    { type: 'host' },
    { type: 'host', config: { size: 2, winLength: 3 } },
    { type: 'host', config: { size: 3, winLength: 3, variant: 'x' } },
    { type: 'join', code: '<script>' },
    { type: 'join', code: 'ABC' },
    { type: 'join' },
    { type: 'resume', code: 'AB12CD', token: 'curto' },
    { type: 'resume', code: 'AB12CD' },
    { type: 'move', index: 999, revision: 0 },
    { type: 'move', index: -1, revision: 0 },
    { type: 'move', index: 1.5, revision: 0 },
    { type: 'move', index: 1 },
    { type: 'move', index: 1, revision: -1 },
  ];
  for (const message of invalid) {
    assert.equal(validateMessage(message), false, JSON.stringify(message));
  }
});

test('configuração do servidor segue os mesmos limites do motor', () => {
  assert.equal(validConfigEnvelope({ size: 12, winLength: 12, variant: 'gravity' }), true);
  assert.equal(validConfigEnvelope({ size: 3, winLength: 3 }), true);
  assert.equal(validConfigEnvelope({ size: 13, winLength: 5, variant: 'classic' }), false);
  assert.equal(validConfigEnvelope({ size: 5, winLength: 6 }), false);
  assert.equal(validConfigEnvelope(null), false);
});

test('chat e nome: formato validado antes de chegar à sala', () => {
  assert.equal(validateMessage({ type: 'chat', text: 'oi' }), true);
  assert.equal(validateMessage({ type: 'chat', text: 'a'.repeat(CHAT_MAX_LENGTH) }), true);
  assert.equal(validateMessage({ type: 'host', config, name: 'Ana' }), true);
  assert.equal(validateMessage({ type: 'join', code: 'AB12CD', name: '' }), true);
  assert.equal(validateMessage({ type: 'watch', code: 'AB12CD', name: 'Caio' }), true);

  const invalid = [
    { type: 'chat' },
    { type: 'chat', text: '' },
    { type: 'chat', text: '   \n ' },
    { type: 'chat', text: '\u0000​' },
    { type: 'chat', text: 42 },
    { type: 'chat', text: ['oi'] },
    { type: 'chat', text: 'a'.repeat(CHAT_MAX_LENGTH + 1) },
    { type: 'host', config, name: 7 },
    { type: 'join', code: 'AB12CD', name: 'n'.repeat(25) },
    { type: 'watch', code: 'AB12CD', name: { toString: () => 'x' } },
  ];
  for (const message of invalid) {
    assert.equal(validateMessage(message), false, JSON.stringify(message));
  }
});

test('cleanText tira controles e marcas invisíveis, colapsa espaços e corta no limite', () => {
  assert.equal(cleanText('  a\tb\n\nc  ', 50), 'a b c');
  assert.equal(cleanText('x\u0000y‮z​', 50), 'x y z');
  assert.equal(cleanText('abcdef', 3), 'abc');
  assert.equal(cleanText(undefined, 10), '');
  assert.equal(cleanText('Olá, José! ✓', 50), 'Olá, José! ✓');
  assert.ok(MESSAGE_TYPES.includes('chat'));
});

test('regressão: cleanText não guarda meio emoji (surrogate solto)', () => {
  // O cliente corta o texto em 200 unidades UTF-16; um emoji no limite chegava pela metade.
  const cut = `${'a'.repeat(CHAT_MAX_LENGTH - 1)}😀`.slice(0, CHAT_MAX_LENGTH);
  assert.equal(validateMessage({ type: 'chat', text: cut }), true);
  assert.equal(cleanText(cut, CHAT_MAX_LENGTH), 'a'.repeat(CHAT_MAX_LENGTH - 1));
  assert.equal(cleanText('ab😀', 3), 'ab', 'o corte do servidor também não parte o emoji');
  assert.equal(cleanText('x\uDC00y 😀', 50), 'x y 😀', 'par completo continua');
  assert.equal(validateMessage({ type: 'chat', text: '\uD83D' }), false);
});

test('relógio da sala: opcional no host, com limites conferidos', () => {
  const ok = [
    { moveMs: 5000, gameMs: 0 },
    { moveMs: 0, gameMs: 180_000 },
    { moveMs: 0, gameMs: 0 },
    { moveMs: 600_000, gameMs: 3 * 60 * 60_000 },
    null,
  ];
  for (const clock of ok) {
    assert.equal(validateMessage({ type: 'host', config, clock }), true, JSON.stringify(clock));
  }
  const bad = [
    { moveMs: 999, gameMs: 0 },
    { moveMs: 600_001, gameMs: 0 },
    { moveMs: 0, gameMs: 3 * 60 * 60_000 + 1 },
    { moveMs: 1500.5, gameMs: 0 },
    { moveMs: -1000, gameMs: 0 },
    { moveMs: '5000', gameMs: 0 },
    { moveMs: 5000 },
    [5000, 0],
    5000,
  ];
  for (const clock of bad) {
    assert.equal(validateMessage({ type: 'host', config, clock }), false, JSON.stringify(clock));
  }
});

test('moderação: ação conhecida e alvo numérico', () => {
  for (const action of MODERATION_ACTIONS) {
    assert.equal(validateMessage({ type: 'moderate', action, target: 3 }), true, action);
  }
  for (const message of [
    { type: 'moderate', action: 'ban', target: 3 },
    { type: 'moderate', action: 'mute', target: 0 },
    { type: 'moderate', action: 'mute', target: '3' },
    { type: 'moderate', action: 'kick' },
  ]) {
    assert.equal(validateMessage(message), false, JSON.stringify(message));
  }
});
