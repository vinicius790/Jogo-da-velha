/** Erro de domínio com código estável, para que a interface traduza a mensagem. */
export class OmegaError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OmegaError';
    this.code = code;
  }
}

export function makeId(prefix = 'id') {
  const unique =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}
