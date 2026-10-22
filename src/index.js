// API pública do motor, sem dependência de DOM: pode ser usada em Node ou em outro front-end.
export { VERSION } from './core/version.js';
export { DIFFICULTY, DIFFICULTY_ALIASES, DIFFICULTY_LEVELS, VARIANTS } from './core/constants.js';
export { OmegaError } from './core/types.js';
export { GameEngine } from './core/engine/game.js';
export { validateConfig, validateSnapshot } from './core/engine/validator.js';
export { chooseMove } from './core/ai/engine.js';
export { alphaBeta } from './core/ai/minimax.js';
export { mcts } from './core/ai/mcts.js';
export { probe3x3 } from './core/ai/tablebase3x3.js';
export { analyzePosition } from './core/analysis/analyzer.js';
export { gradeReplay } from './core/analysis/move-grader.js';
export { nextMistake, reviewGame } from './core/analysis/review.js';
export { clockView, createClock, isFlagged, timeLeft } from './core/engine/clock.js';
export { decodeState, encodeState } from './core/serialization/share.js';
export { createBackup, verifyBackup } from './core/serialization/backup.js';
export { decryptBackup, encryptBackup } from './core/serialization/secure-backup.js';
export {
  cellToCoordinate,
  coordinateToCell,
  decodeMoves,
  encodeMoves,
  notationForGame,
} from './core/notation.js';
export { analyze, createGame, restore, share, suggestMove } from './core/public-api.js';
export { makeReplay, replayFrame, validateReplay } from './features/replay.js';
export { compareEngines } from './features/engine-lab.js';
export { playArena } from './features/analytics.js';
export { generatePuzzle, validatePuzzle } from './features/puzzles.js';
export { rankingKey, rankingRows, recordRanking } from './features/ranking.js';
export { expectedGlicko, updateGlicko2 } from './services/glicko2.js';
