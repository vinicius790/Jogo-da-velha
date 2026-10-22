import { OmegaError } from '../types.js';
import { base64UrlToBytes, bytesToBase64Url } from './share.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS = 210000;
const MIN_PASSWORD_LENGTH = 8;

async function deriveKey(password, salt, iterations) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new OmegaError('no-webcrypto', 'WebCrypto indisponível.');
  const base = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Backup cifrado com AES-256-GCM; a chave deriva da senha por PBKDF2-SHA-256. */
export async function encryptBackup(payload, password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new OmegaError('weak-password', 'A senha precisa ter ao menos 8 caracteres.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  );
  return {
    format: 'OMEGA-ENCRYPTED-BACKUP',
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    cipher: 'AES-256-GCM',
    salt: bytesToBase64Url(salt),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(ciphertext),
  };
}

export async function decryptBackup(bundle, password) {
  const valid =
    bundle &&
    bundle.format === 'OMEGA-ENCRYPTED-BACKUP' &&
    typeof password === 'string' &&
    [bundle.salt, bundle.iv, bundle.ciphertext].every((field) => typeof field === 'string');
  if (!valid) throw new OmegaError('invalid-backup', 'Backup criptografado inválido.');
  // Limita as iterações declaradas no arquivo para um backup forjado não travar o navegador.
  const iterations = Number.isInteger(bundle.iterations)
    ? Math.min(Math.max(bundle.iterations, 1000), 1_000_000)
    : ITERATIONS;
  try {
    const key = await deriveKey(password, base64UrlToBytes(bundle.salt), iterations);
    const clear = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes(bundle.iv) },
      key,
      base64UrlToBytes(bundle.ciphertext),
    );
    return JSON.parse(decoder.decode(clear));
  } catch (error) {
    if (error instanceof OmegaError) throw error;
    throw new OmegaError('wrong-password', 'Senha incorreta ou backup adulterado.');
  }
}
