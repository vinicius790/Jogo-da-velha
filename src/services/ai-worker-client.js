import { TASKS } from '../workers/tasks.js';

let worker = null;
let sequence = 0;
const pending = new Map();

function rejectAll(error) {
  for (const { reject } of pending.values()) reject(error);
  pending.clear();
}

function ensureWorker() {
  if (worker || typeof Worker === 'undefined') return worker;
  worker = new Worker(new URL('../workers/ai.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const item = pending.get(event.data.id);
    if (!item) return;
    pending.delete(event.data.id);
    if (event.data.error) item.reject(new Error(event.data.error));
    else item.resolve(event.data.result);
  };
  worker.onerror = () => {
    // Worker quebrado (ex.: falha ao carregar o módulo): descarta e recria na próxima chamada.
    worker.terminate();
    worker = null;
    rejectAll(new Error('AI worker error'));
  };
  return worker;
}

/**
 * Executa uma tarefa de `TASKS` fora da thread principal, em qualquer tamanho de tabuleiro.
 * Cada pedido tem um id, então respostas nunca se misturam.
 * Sem suporte a Worker, a tarefa roda aqui mesmo (bloqueando a interface enquanto durar).
 */
export function runTask(task, payload) {
  const target = ensureWorker();
  if (!target) {
    return new Promise((resolve, reject) => {
      try {
        resolve(TASKS[task](payload));
      } catch (error) {
        reject(error);
      }
    });
  }
  return new Promise((resolve, reject) => {
    sequence += 1;
    pending.set(sequence, { resolve, reject });
    target.postMessage({ id: sequence, task, payload });
  });
}

/** Interrompe o que estiver em execução (ex.: usuário cancelou uma simulação longa). */
export function cancelTasks() {
  worker?.terminate();
  worker = null;
  rejectAll(new Error('cancelled'));
}
