import { OmegaError } from '../types.js';

/** Identificador do formato do código de compartilhamento (independe da versão do app). */
export const SHARE_PREFIX = 'OMEGA-S1';
// Prefixo usado até a versão 11; os links antigos continuam abrindo.
const LEGACY_PREFIX = 'OMEGA11';
const MAX_CODE_LENGTH = 20000;

export function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(value) {
  let text = value.replace(/-/g, '+').replace(/_/g, '/');
  while (text.length % 4) text += '=';
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

/** Serializa um estado de partida em `PREFIXO.base64url(JSON)`. */
export function encodeState(state) {
  const json = JSON.stringify({ g: state });
  return `${SHARE_PREFIX}.${bytesToBase64Url(new TextEncoder().encode(json))}`;
}

/**
 * Decodifica um código de compartilhamento. O resultado é dado NÃO confiável:
 * passe-o por `GameEngine.from` antes de usar.
 */
export function decodeState(code) {
  const text = String(code ?? '');
  const separator = text.indexOf('.');
  const prefix = text.slice(0, separator);
  if (
    separator < 0 ||
    text.length > MAX_CODE_LENGTH ||
    (prefix !== SHARE_PREFIX && prefix !== LEGACY_PREFIX)
  ) {
    throw new OmegaError('bad-share-code', 'Código de compartilhamento incompatível.');
  }
  try {
    const bytes = base64UrlToBytes(text.slice(separator + 1));
    return JSON.parse(new TextDecoder().decode(bytes)).g;
  } catch {
    throw new OmegaError('bad-share-code', 'Código de compartilhamento corrompido.');
  }
}
