import { AI_RATING, DIFFICULTY_LEVELS, ELO, SIZE_LIMITS, VARIANTS } from '../core/constants.js';
import { updateRating } from '../services/rating.js';

const TOP_LIMIT = 5;
const SCORE = Object.freeze({ win: 1, draw: 0.5, loss: 0 });

const counter = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

/** Chave de um quadro do ranking: tamanho do tabuleiro + variante (ex.: `5-hex`). */
export function rankingKey(config) {
  return `${config.size}-${config.variant ?? 'classic'}`;
}

export function parseRankingKey(key) {
  const match = /^(\d{1,2})-([a-z]+)$/.exec(String(key));
  if (!match) return null;
  const size = Number(match[1]);
  if (size < SIZE_LIMITS.min || size > SIZE_LIMITS.max || !VARIANTS.includes(match[2])) return null;
  return { size, variant: match[2] };
}

function emptyEntry() {
  return {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    rating: ELO.baseline,
    streak: 0,
    bestStreak: 0,
    top: [],
  };
}

/** Melhores vitórias primeiro: menos lances e, no empate, menos tempo. */
function byQuality(a, b) {
  return a.moves - b.moves || a.durationMs - b.durationMs || a.at - b.at;
}

function sanitizeRecord(record) {
  if (!record || typeof record !== 'object' || !counter(record.moves)) return null;
  return {
    name: typeof record.name === 'string' ? record.name.slice(0, 40) : '',
    moves: counter(record.moves),
    durationMs: counter(record.durationMs),
    difficulty: DIFFICULTY_LEVELS.includes(record.difficulty) ? record.difficulty : null,
    at: counter(record.at),
  };
}

/** Ranking vindo de armazenamento, backup ou outra aba: só chaves e campos válidos sobrevivem. */
export function sanitizeRanking(input) {
  const clean = {};
  if (!input || typeof input !== 'object') return clean;
  for (const [key, value] of Object.entries(input)) {
    if (!parseRankingKey(key) || !value || typeof value !== 'object') continue;
    const rating = Number.isFinite(value.rating) ? value.rating : ELO.baseline;
    clean[key] = {
      played: counter(value.played),
      wins: counter(value.wins),
      draws: counter(value.draws),
      losses: counter(value.losses),
      rating: Math.round(Math.min(5000, Math.max(0, rating))),
      streak: counter(value.streak),
      bestStreak: counter(value.bestStreak),
      top: (Array.isArray(value.top) ? value.top : [])
        .map(sanitizeRecord)
        .filter(Boolean)
        .sort(byQuality)
        .slice(0, TOP_LIMIT),
    };
  }
  return clean;
}

/**
 * Registra uma partida já contabilizada (`entry` é a linha do histórico do perfil) no quadro do
 * seu tabuleiro. Função pura. O Elo do quadro só muda em partidas com rating (contra a IA);
 * vitórias no tabuleiro entram na lista das melhores do quadro (vitória no relógio conta no
 * V-E-D e no Elo, mas não é "melhor vitória": o adversário não foi vencido em lances).
 */
export function recordRanking(ranking, entry, name = '') {
  const key = rankingKey(entry.config);
  const previous = ranking?.[key] ?? emptyEntry();
  const won = entry.outcome === 'win';
  const streak = won ? previous.streak + 1 : 0;
  const opponent = AI_RATING[entry.difficulty] ?? AI_RATING.normal;
  const next = {
    ...previous,
    played: previous.played + 1,
    wins: previous.wins + (won ? 1 : 0),
    draws: previous.draws + (entry.outcome === 'draw' ? 1 : 0),
    losses: previous.losses + (entry.outcome === 'loss' ? 1 : 0),
    rating: entry.rated
      ? updateRating(previous.rating, opponent.elo, SCORE[entry.outcome])
      : previous.rating,
    streak,
    bestStreak: Math.max(previous.bestStreak, streak),
  };
  if (won && entry.endReason !== 'timeout') {
    const record = {
      name: String(name).slice(0, 40),
      moves: entry.moves,
      durationMs: entry.durationMs ?? 0,
      difficulty: entry.mode === 'ai' ? entry.difficulty : null,
      at: entry.finishedAt,
    };
    next.top = [...previous.top, record].sort(byQuality).slice(0, TOP_LIMIT);
  }
  return { ...ranking, [key]: next };
}

/** Quadros ordenados para exibição: maior Elo, depois mais vitórias, depois mais partidas. */
export function rankingRows(ranking) {
  return Object.entries(ranking ?? {})
    .map(([key, entry]) => ({ key, ...parseRankingKey(key), ...entry }))
    .filter((row) => row.size)
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins || b.played - a.played)
    .map((row, i) => ({ ...row, position: i + 1 }));
}
