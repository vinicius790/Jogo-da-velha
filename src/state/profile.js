import { ACHIEVEMENTS, DIFFICULTY_LEVELS, ELO, MODES, VARIANTS } from '../core/constants.js';
import { sanitizeRanking } from '../features/ranking.js';

export const LANGUAGES = Object.freeze(['pt-BR', 'en', 'es']);
const THEMES = ['dark', 'light'];
const MOTIONS = ['full', 'reduced'];
const OUTCOMES = ['win', 'draw', 'loss'];
const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((achievement) => achievement.id);
const HISTORY_LIMIT = 100;

/** Única definição do perfil: o formato padrão e os valores iniciais. */
export function defaultProfile() {
  return {
    name: 'Omega Player',
    rating: ELO.baseline,
    xp: 0,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    glicko: { rating: 1500, deviation: 350, volatility: 0.06 },
    achievements: [],
    history: [],
    /** Ranking local: um quadro por tamanho de tabuleiro + variante (ver features/ranking.js). */
    ranking: {},
    settings: { theme: 'dark', sound: true, language: 'pt-BR', motion: 'full' },
  };
}

const clamp = (value, min, max, fallback) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const oneOf = (value, options, fallback) => (options.includes(value) ? value : fallback);
const counter = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

function sanitizeEntry(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') return null;
  if (!MODES.includes(entry.mode)) return null;
  const result = oneOf(entry.result, ['X', 'O', 'draw'], null);
  const player = oneOf(entry.player, ['X', 'O'], null);
  if (!result || !player) return null;
  // Perfis anteriores à versão 12 não gravavam `outcome`; ele é derivado do resultado.
  const derived = result === 'draw' ? 'draw' : result === player ? 'win' : 'loss';
  const outcome = oneOf(entry.outcome, OUTCOMES, derived);
  const config = entry.config ?? {};
  return {
    id: entry.id.slice(0, 80),
    finishedAt: counter(entry.finishedAt),
    mode: entry.mode,
    difficulty: oneOf(entry.difficulty, DIFFICULTY_LEVELS, 'normal'),
    config: {
      size: clamp(Math.floor(config.size), 3, 12, 3),
      winLength: clamp(Math.floor(config.winLength), 3, 12, 3),
      variant: oneOf(config.variant, VARIANTS, 'classic'),
    },
    result,
    player,
    outcome,
    rated: entry.rated === true,
    moves: counter(entry.moves),
    endReason: entry.endReason === 'timeout' ? 'timeout' : null,
    ratingDelta: clamp(Math.round(entry.ratingDelta), -100, 100, 0),
    notation: typeof entry.notation === 'string' ? entry.notation.slice(0, 1200) : '',
    durationMs: counter(entry.durationMs),
  };
}

/** Normaliza um perfil vindo de armazenamento, backup ou outra aba: nada é aceito sem checagem. */
export function sanitizeProfile(input) {
  const base = defaultProfile();
  const source = input && typeof input === 'object' ? input : {};
  const glicko = source.glicko && typeof source.glicko === 'object' ? source.glicko : {};
  const settings = source.settings && typeof source.settings === 'object' ? source.settings : {};
  const profile = {
    name: (typeof source.name === 'string' ? source.name.trim().slice(0, 40) : '') || base.name,
    rating: Math.round(clamp(source.rating, 0, 5000, base.rating)),
    glicko: {
      rating: clamp(glicko.rating, 100, 3500, base.glicko.rating),
      deviation: clamp(glicko.deviation, 30, 350, base.glicko.deviation),
      volatility: clamp(glicko.volatility, 0.01, 1, base.glicko.volatility),
    },
    achievements: Array.isArray(source.achievements)
      ? [...new Set(source.achievements)].filter((id) => ACHIEVEMENT_IDS.includes(id))
      : [],
    history: Array.isArray(source.history)
      ? source.history.map(sanitizeEntry).filter(Boolean).slice(0, HISTORY_LIMIT)
      : [],
    ranking: sanitizeRanking(source.ranking),
    settings: {
      theme: oneOf(settings.theme, THEMES, base.settings.theme),
      sound: settings.sound !== false,
      language: oneOf(settings.language, LANGUAGES, base.settings.language),
      motion: oneOf(settings.motion, MOTIONS, base.settings.motion),
    },
  };
  for (const key of ['xp', 'played', 'wins', 'losses', 'draws', 'streak', 'bestStreak']) {
    profile[key] = counter(source[key]);
  }
  return profile;
}
