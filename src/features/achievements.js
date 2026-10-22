import { ACHIEVEMENTS, DEFAULT_CONFIG } from '../core/constants.js';

const VARIANTS_FOR_MASTER = 3;
const UNBEATEN_RUN = 5;

function isCustom(config) {
  return (
    config.size !== DEFAULT_CONFIG.size ||
    config.winLength !== DEFAULT_CONFIG.winLength ||
    (config.variant ?? 'classic') !== DEFAULT_CONFIG.variant
  );
}

/**
 * Devolve os ids de conquistas recém-desbloqueadas.
 * `profile` já deve refletir o evento (ex.: a partida recém-registrada no histórico).
 * `event` descreve o que aconteceu; campos ausentes simplesmente não desbloqueiam nada.
 *
 * - game: `{ outcome, config, difficulty, mode, playerMoves, facedThreat, offline, endReason }` ao fim de
 *   uma partida registrada;
 * - demais: `puzzleSolved`, `replayWatched`, `imported`, `tournamentCompleted`, `labRun`.
 */
export function evaluateAchievements(profile, event = {}) {
  const game = event.game ?? null;
  const won = game?.outcome === 'win';
  const history = profile.history ?? [];
  const wonVariants = new Set(
    history.filter((entry) => entry.outcome === 'win').map((entry) => entry.config?.variant),
  );
  const lastGames = history.slice(0, UNBEATEN_RUN);

  const rules = {
    'first-win': profile.wins > 0,
    perfect:
      Boolean(game) &&
      lastGames.length === UNBEATEN_RUN &&
      lastGames.every((entry) => entry.outcome !== 'loss'),
    giant: game?.config?.size === 12,
    'streak-3': profile.streak >= 3,
    'streak-7': profile.streak >= 7,
    'streak-10': profile.streak >= 10,
    comeback: won && game.facedThreat === true,
    puzzle: event.puzzleSolved === true,
    replay: event.replayWatched === true,
    custom: Boolean(game) && isCustom(game.config),
    hundred: profile.played >= 100,
    offline: Boolean(game) && game.offline === true,
    import: event.imported === true,
    tournament: event.tournamentCompleted === true,
    omega: won && game.mode === 'ai' && game.difficulty === 'omega',
    // Vitória no relógio não conta: o adversário não foi vencido no tabuleiro.
    speed: won && game.endReason !== 'timeout' && game.playerMoves <= game.config.winLength,
    'variant-master': wonVariants.size >= VARIANTS_FOR_MASTER,
    engineer: event.labRun === true,
  };
  return ACHIEVEMENTS.map((achievement) => achievement.id).filter(
    (id) => rules[id] && !profile.achievements.includes(id),
  );
}

export function achievementRows(unlocked) {
  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    unlocked: unlocked.includes(achievement.id),
  }));
}
