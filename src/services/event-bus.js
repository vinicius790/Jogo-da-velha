/**
 * Barramento de eventos da interface. Os controladores publicam o que aconteceu
 * ('game:finished', 'profile:changed', 'language:changed'…) e quem se interessa assina,
 * sem que um controlador precise importar o outro.
 */
const listeners = new Map();

export function on(type, listener) {
  const set = listeners.get(type) ?? new Set();
  set.add(listener);
  listeners.set(type, set);
  return () => set.delete(listener);
}

export function emit(type, payload) {
  for (const listener of listeners.get(type) ?? []) {
    try {
      listener(payload);
    } catch (error) {
      // Um assinante com defeito não pode impedir os demais de receber o evento.
      console.error(`[event-bus] falha em assinante de "${type}"`, error);
    }
  }
}
