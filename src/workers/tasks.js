import { chooseMove } from '../core/ai/engine.js';
import { gradeReplay } from '../core/analysis/move-grader.js';
import { reviewGame } from '../core/analysis/review.js';
import { playArena } from '../features/analytics.js';
import { compareEngines } from '../features/engine-lab.js';

/**
 * Tarefas pesadas (busca da IA e simulações). A mesma tabela é usada dentro do Web Worker e,
 * quando Worker não existe, diretamente na thread principal.
 */
export const TASKS = Object.freeze({
  move: (payload) => chooseMove(payload),
  lab: (payload) => compareEngines(payload),
  arena: (payload) => playArena(payload),
  grade: (payload) => gradeReplay(payload.replay),
  review: (payload) => reviewGame(payload.replay),
});
