const encoder = new TextEncoder();

async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null; // contexto sem Web Crypto (ex.: página servida por HTTP sem TLS)
  const digest = await subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Envelope de backup com soma SHA-256 do conteúdo (detecta corrupção, não é autenticação). */
export async function createBackup(payload) {
  return {
    format: 'OMEGA-BACKUP',
    version: 1,
    createdAt: new Date().toISOString(),
    sha256: await sha256Hex(JSON.stringify(payload)),
    payload,
  };
}

/** Confere a soma. Um backup gerado sem Web Crypto (`sha256: null`) não tem o que conferir. */
export async function verifyBackup(backup) {
  if (!backup || backup.format !== 'OMEGA-BACKUP' || !backup.payload) return false;
  if (backup.sha256 === null) return true;
  if (typeof backup.sha256 !== 'string') return false;
  const actual = await sha256Hex(JSON.stringify(backup.payload));
  return actual === null || actual === backup.sha256;
}
