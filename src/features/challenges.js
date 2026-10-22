import { PUZZLE_CONFIGS, generatePuzzle } from './puzzles.js';

function hashString(text) {
  // FNV-1a de 32 bits.
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/**
 * Desafio diário: um puzzle determinístico por data UTC — igual para todos no mesmo dia.
 * O tamanho do tabuleiro também é derivado da data.
 */
export function dailyChallenge(date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  const seed = hashString(`omega-daily-${day}`);
  const config = PUZZLE_CONFIGS[seed % PUZZLE_CONFIGS.length];
  return { ...generatePuzzle(seed, config), id: `daily-${day}`, date: day, daily: true };
}

/** Sequência e recorde de dias com puzzle diário resolvido (calendário UTC). */
export function dailyPuzzleStreak(solvedIds, date = new Date()) {
  const today = date.toISOString().slice(0, 10);
  const completed = new Set();
  for (const id of Array.isArray(solvedIds) ? solvedIds : []) {
    const match = /^daily-(\d{4}-\d{2}-\d{2})$/.exec(id);
    if (!match) continue;
    const parsed = new Date(`${match[1]}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === match[1] && match[1] <= today) {
      completed.add(match[1]);
    }
  }

  const offsetDay = (day, offset) => {
    const value = new Date(`${day}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const solvedToday = completed.has(today);
  let current = 0;
  let cursor = solvedToday ? today : offsetDay(today, -1);
  while (completed.has(cursor)) {
    current += 1;
    cursor = offsetDay(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let previous = null;
  for (const day of [...completed].sort()) {
    run = previous !== null && offsetDay(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return { current, best, solvedToday };
}
