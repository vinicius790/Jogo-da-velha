import { TASKS } from './tasks.js';

// Protocolo: { id, task, payload } → { id, result } ou { id, error }.
self.onmessage = (event) => {
  const { id, task, payload } = event.data;
  try {
    const run = TASKS[task];
    if (!run) throw new Error(`Tarefa desconhecida: ${task}`);
    self.postMessage({ id, result: run(payload) });
  } catch (error) {
    self.postMessage({ id, error: String(error?.message ?? error) });
  }
};
