/** Tabela de transposição com limite de tamanho e descarte do item menos recentemente usado. */
export class TranspositionTable {
  constructor(limit = 50000) {
    this.limit = limit;
    this.map = new Map();
  }

  get(key) {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key, value) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.limit) this.map.delete(this.map.keys().next().value);
  }

  get size() {
    return this.map.size;
  }
}
