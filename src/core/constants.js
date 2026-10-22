export const APP_NAME = 'OMEGA Tic-Tac-Toe';

export const MARKS = Object.freeze(['X', 'O']);
export const VARIANTS = Object.freeze(['classic', 'misere', 'gravity', 'hex', 'fade']);
export const FADE_MAX_PIECES = 3;
export const MODES = Object.freeze(['ai', 'local', 'online', 'spectator']);
export const SIZE_LIMITS = Object.freeze({ min: 3, max: 12 });
export const DEFAULT_CONFIG = Object.freeze({ size: 3, winLength: 3, variant: 'classic' });

/**
 * Parâmetros de cada nível da IA.
 * - depth: profundidade máxima do alpha-beta (aprofundamento iterativo).
 * - timeBudgetMs: orçamento de tempo da busca alpha-beta.
 * - blunder: probabilidade de jogar um lance legal aleatório (ignora até vitórias e bloqueios).
 * - tablebase: usa a solução exata no 3×3 clássico.
 * - mctsBudgetMs: orçamento do MCTS que desempata os melhores candidatos (0 = não usa).
 */
export const DIFFICULTY = Object.freeze({
  easy: Object.freeze({
    depth: 1,
    timeBudgetMs: 60,
    blunder: 0.35,
    tablebase: false,
    mctsBudgetMs: 0,
  }),
  normal: Object.freeze({
    depth: 2,
    timeBudgetMs: 150,
    blunder: 0.12,
    tablebase: false,
    mctsBudgetMs: 0,
  }),
  hard: Object.freeze({
    depth: 4,
    timeBudgetMs: 300,
    blunder: 0.03,
    tablebase: false,
    mctsBudgetMs: 0,
  }),
  expert: Object.freeze({
    depth: 6,
    timeBudgetMs: 600,
    blunder: 0,
    tablebase: true,
    mctsBudgetMs: 0,
  }),
  omega: Object.freeze({
    depth: 10,
    timeBudgetMs: 700,
    blunder: 0,
    tablebase: true,
    mctsBudgetMs: 400,
  }),
});
export const DIFFICULTY_LEVELS = Object.freeze(Object.keys(DIFFICULTY));

export const DIFFICULTY_ALIASES = Object.freeze({
  facil: 'easy',
  easy: 'easy',
  normal: 'normal',
  medio: 'normal',
  medium: 'normal',
  hard: 'hard',
  dificil: 'hard',
  expert: 'expert',
  especialista: 'expert',
  omega: 'omega',
  imbativel: 'omega',
  unbeatable: 'omega',
});

export const DIRECTIONS = Object.freeze([
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]);

/**
 * Variante hexagonal: o tabuleiro é um losango de hexágonos em coordenadas axiais
 * (coluna = q, linha = r). Cada casa tem seis vizinhas e só existem três eixos de linha:
 * a diagonal [1, 1] do tabuleiro quadrado não liga casas vizinhas no hexagonal.
 */
export const HEX_DIRECTIONS = Object.freeze([
  [1, 0],
  [0, 1],
  [1, -1],
]);

/** Limites do relógio (0 = sem limite). */
export const CLOCK_LIMITS = Object.freeze({ maxMoveMs: 10 * 60_000, maxGameMs: 3 * 60 * 60_000 });

/** Conquistas: os textos ficam nos dicionários de i18n (chaves `ach.<id>.title|desc`). */
export const ACHIEVEMENTS = Object.freeze([
  { id: 'first-win', icon: '⚔️' },
  { id: 'perfect', icon: '◆' },
  { id: 'giant', icon: '⬡' },
  { id: 'streak-3', icon: '🔥' },
  { id: 'streak-7', icon: '⚡' },
  { id: 'streak-10', icon: '★' },
  { id: 'comeback', icon: '↗' },
  { id: 'puzzle', icon: '♟' },
  { id: 'replay', icon: '▶' },
  { id: 'custom', icon: '⌘' },
  { id: 'hundred', icon: '100' },
  { id: 'offline', icon: '◉' },
  { id: 'import', icon: '↙' },
  { id: 'tournament', icon: '🏆' },
  { id: 'omega', icon: 'Ω' },
  { id: 'speed', icon: '◈' },
  { id: 'variant-master', icon: '✦' },
  { id: 'engineer', icon: '⌬' },
]);

export const ELO = Object.freeze({ K: 24, baseline: 1000 });

/**
 * Rating nominal atribuído a cada nível da IA para o cálculo de Elo/Glicko-2.
 * São valores de referência fixos (não medidos em pool de jogadores).
 */
export const AI_RATING = Object.freeze({
  easy: Object.freeze({ elo: 800, glicko: 1300 }),
  normal: Object.freeze({ elo: 1000, glicko: 1500 }),
  hard: Object.freeze({ elo: 1200, glicko: 1700 }),
  expert: Object.freeze({ elo: 1400, glicko: 1900 }),
  omega: Object.freeze({ elo: 1600, glicko: 2100 }),
});
export const AI_RATING_DEVIATION = 80;
