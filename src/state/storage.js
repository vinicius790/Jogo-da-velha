import { idbGet, idbRemove, idbSet } from './indexeddb.js';

const PREFIX = 'omega-ttt:';
const memory = new Map();

/**
 * Armazenamento chave-valor em camadas: IndexedDB → localStorage → memória.
 * Cada camada é opcional (modo privado, cota cheia, Node nos testes); falhas caem para a próxima.
 */
export const storage = {
  async get(key, fallback = null) {
    try {
      const value = await idbGet(key);
      if (value !== null && value !== undefined) return value;
    } catch {
      // IndexedDB indisponível: tenta a próxima camada
    }
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) return JSON.parse(raw);
    } catch {
      // localStorage indisponível ou conteúdo corrompido
    }
    return memory.has(key) ? memory.get(key) : fallback;
  },

  async set(key, value) {
    memory.set(key, value);
    try {
      await idbSet(key, value);
    } catch {
      // segue para o espelho em localStorage
    }
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // sem localStorage ou cota excedida: o valor fica nas outras camadas
    }
    return value;
  },

  async remove(key) {
    memory.delete(key);
    try {
      await idbRemove(key);
    } catch {
      // ignorado: camada indisponível
    }
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // ignorado: camada indisponível
    }
  },
};
