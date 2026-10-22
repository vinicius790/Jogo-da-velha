import { normalizeConfig } from '../core/engine/validator.js';

export const LOCAL_MATCH_FORMATS = Object.freeze([3, 5, 7]);
export const LOCAL_MATCH_RECENT_LIMIT = 8;
const NAME_LIMIT = 32;
const MAX_GAMES = 1_000_000;
const VALID_ID = /^[A-Za-z0-9._:-]{1,80}$/;
const MOVE_CLOCKS = new Set([0, 5000, 10000, 30000, 60000]);
const GAME_CLOCKS = new Set([0, 60000, 180000, 300000, 600000]);
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;

function cleanName(value) {
  return String(value ?? '')
    .replace(CONTROL_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_LIMIT);
}

function validId(value) {
  return typeof value === 'string' && VALID_ID.test(value);
}

function validClock(clock) {
  return (
    clock &&
    typeof clock === 'object' &&
    MOVE_CLOCKS.has(clock.moveMs) &&
    GAME_CLOCKS.has(clock.gameMs)
  );
}

function sameConfig(left, right) {
  return (
    left.size === right.size &&
    left.winLength === right.winLength &&
    left.variant === right.variant
  );
}

function validRecent(item, size) {
  return (
    item &&
    typeof item === 'object' &&
    validId(item.gameId) &&
    Number.isSafeInteger(item.round) &&
    item.round > 0 &&
    (item.xPlayer === 0 || item.xPlayer === 1) &&
    (item.winner === null || item.winner === 0 || item.winner === 1) &&
    Number.isSafeInteger(item.moveCount) &&
    item.moveCount >= 0 &&
    item.moveCount <= size ** 2 &&
    (item.moveCount > 0 || item.endReason === 'timeout') &&
    (item.endReason === null || item.endReason === 'timeout') &&
    Number.isSafeInteger(item.endedAt) &&
    ((item.winner === null && item.outcome === 'draw') ||
      (item.winner !== null && item.outcome === 'win'))
  );
}

/** Cria uma série local melhor-de-N. `players` contém os dois nomes exibidos no placar. */
export function createLocalMatch({
  players,
  config,
  bestOf = 3,
  clock = { moveMs: 0, gameMs: 0 },
  id = `match-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  createdAt = Date.now(),
  fallbackNames = ['Player 1', 'Player 2'],
} = {}) {
  if (!Array.isArray(players) || players.length !== 2) {
    throw new Error('A série precisa de dois jogadores.');
  }
  if (!LOCAL_MATCH_FORMATS.includes(bestOf)) {
    throw new Error('Formato de série inválido.');
  }
  if (!validId(id)) throw new Error('Identificador de série inválido.');
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) {
    throw new Error('Data de criação inválida.');
  }
  if (!validClock(clock)) throw new Error('Relógio inválido.');

  const names = players.map((value, index) =>
    cleanName(value) || cleanName(fallbackNames[index]) || `Player ${index + 1}`,
  );
  if (names[0].toLocaleLowerCase() === names[1].toLocaleLowerCase()) {
    throw new Error('Use nomes diferentes para identificar os dois jogadores.');
  }

  return {
    id,
    players: names,
    config: normalizeConfig(config),
    clock: { moveMs: clock.moveMs, gameMs: clock.gameMs },
    bestOf,
    targetWins: Math.ceil(bestOf / 2),
    wins: [0, 0],
    draws: 0,
    gamesPlayed: 0,
    recent: [],
    lastGameId: null,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
  };
}

/** Valida e reconstrói o formato persistido; dados fora do contrato são descartados. */
export function sanitizeLocalMatch(input) {
  try {
    if (!input || typeof input !== 'object' || !validId(input.id)) return null;
    if (!Array.isArray(input.players) || input.players.length !== 2) return null;
    const players = input.players.map(cleanName);
    if (
      players.some((name) => !name) ||
      players[0].toLocaleLowerCase() === players[1].toLocaleLowerCase()
    ) {
      return null;
    }
    if (!LOCAL_MATCH_FORMATS.includes(input.bestOf)) return null;
    const config = normalizeConfig(input.config);
    if (!validClock(input.clock)) return null;
    if (
      !Array.isArray(input.wins) ||
      input.wins.length !== 2 ||
      input.wins.some((value) => !Number.isSafeInteger(value) || value < 0 || value > MAX_GAMES) ||
      !Number.isSafeInteger(input.draws) ||
      input.draws < 0 ||
      input.draws > MAX_GAMES ||
      !Number.isSafeInteger(input.gamesPlayed) ||
      input.gamesPlayed < 0 ||
      input.gamesPlayed > MAX_GAMES ||
      input.wins[0] + input.wins[1] + input.draws !== input.gamesPlayed
    ) {
      return null;
    }
    if (!Array.isArray(input.recent) || input.recent.length > LOCAL_MATCH_RECENT_LIMIT) return null;
    const recent = input.recent.map((item) => ({
      gameId: item?.gameId,
      round: item?.round,
      xPlayer: item?.xPlayer,
      winner: item?.winner,
      moveCount: item?.moveCount,
      endReason: item?.endReason ?? null,
      outcome: item?.outcome,
      endedAt: item?.endedAt,
    }));
    if (!recent.every((item) => validRecent(item, config.size))) return null;
    if (
      input.gamesPlayed < recent.length ||
      (input.gamesPlayed === 0 && recent.length !== 0) ||
      (input.gamesPlayed > 0 && recent.length === 0)
    ) return null;
    const firstRecentRound = input.gamesPlayed - recent.length + 1;
    if (
      recent.some((item, index) => item.round !== firstRecentRound + index) ||
      new Set(recent.map((item) => item.gameId)).size !== recent.length
    ) return null;
    const lastGameId = input.lastGameId;
    if (
      (input.gamesPlayed === 0 && lastGameId !== null) ||
      (input.gamesPlayed > 0 && !validId(lastGameId)) ||
      (recent.length && recent.at(-1).gameId !== lastGameId)
    ) {
      return null;
    }
    if (!['active', 'completed', 'abandoned'].includes(input.status)) return null;

    const targetWins = Math.ceil(input.bestOf / 2);
    const clinched = input.wins.some((wins) => wins >= targetWins);
    if ((input.status === 'completed') !== clinched) return null;
    if (input.status === 'abandoned' && clinched) return null;
    const createdAt = Number.isSafeInteger(input.createdAt) && input.createdAt >= 0
      ? input.createdAt
      : 0;
    const updatedAt = Number.isSafeInteger(input.updatedAt) && input.updatedAt >= createdAt
      ? input.updatedAt
      : createdAt;

    return {
      id: input.id,
      players,
      config,
      clock: { moveMs: input.clock.moveMs, gameMs: input.clock.gameMs },
      bestOf: input.bestOf,
      targetWins,
      wins: [...input.wins],
      draws: input.draws,
      gamesPlayed: input.gamesPlayed,
      recent,
      lastGameId,
      status: clinched ? 'completed' : input.status,
      createdAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}

/** Índices de jogadores que ficam com X/O na próxima partida; X alterna a cada resultado. */
export function markOwners(matchInput) {
  const match = sanitizeLocalMatch(matchInput);
  if (!match) throw new Error('Série local inválida.');
  const nextX = match.gamesPlayed % 2;
  return { x: nextX, o: 1 - nextX, nextX };
}

/** Registra apenas partidas locais concluídas com a mesma configuração da série. */
export function recordLocalMatchGame(matchInput, game) {
  const match = sanitizeLocalMatch(matchInput);
  if (!match) throw new Error('Série local inválida.');
  if (match.lastGameId && match.lastGameId === game?.id) return match;
  if (match.status !== 'active') throw new Error('A série local já foi encerrada.');
  if (!game || game.mode !== 'local') throw new Error('A partida não é local.');
  if (game.status === 'draw' && game.result !== 'draw') {
    throw new Error('Resultado de empate inválido.');
  }
  if (game.status !== 'draw' && game.status !== 'won') {
    throw new Error('A partida ainda não terminou.');
  }
  if (
    !validId(game.id) ||
    !Array.isArray(game.moves) ||
    (game.moves.length === 0 && game.endReason !== 'timeout') ||
    !['X', 'O', 'draw'].includes(game.result)
  ) {
    throw new Error('Resultado da partida inválido.');
  }
  const config = normalizeConfig(game.config);
  if (!sameConfig(config, match.config)) throw new Error('A configuração da partida não corresponde à série.');
  if ((game.status === 'draw') !== (game.result === 'draw')) {
    throw new Error('Estado e resultado da partida não correspondem.');
  }
  if (match.gamesPlayed >= MAX_GAMES) throw new Error('Limite de partidas da série atingido.');

  const xPlayer = match.gamesPlayed % 2;
  const winner = game.result === 'draw' ? null : game.result === 'X' ? xPlayer : 1 - xPlayer;
  const gamesPlayed = match.gamesPlayed + 1;
  const wins = [...match.wins];
  if (winner !== null) wins[winner] += 1;
  const draws = match.draws + (winner === null ? 1 : 0);
  const endedAt = Number.isSafeInteger(game.updatedAt) && game.updatedAt >= 0
    ? game.updatedAt
    : Date.now();
  const recent = [
    ...match.recent,
    {
      gameId: game.id,
      round: gamesPlayed,
      xPlayer,
      winner,
      moveCount: game.moves.length,
      endReason: game.endReason === 'timeout' ? 'timeout' : null,
      outcome: winner === null ? 'draw' : 'win',
      endedAt,
    },
  ].slice(-LOCAL_MATCH_RECENT_LIMIT);
  const targetWins = match.targetWins;
  const completed = wins.some((score) => score >= targetWins);

  return {
    ...match,
    wins,
    draws,
    gamesPlayed,
    recent,
    lastGameId: game.id,
    status: completed ? 'completed' : 'active',
    updatedAt: Math.max(match.updatedAt, endedAt),
  };
}

/** Encerra sem apagar o placar; uma série decidida permanece concluída. */
export function closeLocalMatch(matchInput, endedAt = Date.now()) {
  const match = sanitizeLocalMatch(matchInput);
  if (!match) throw new Error('Série local inválida.');
  if (match.status !== 'active') return match;
  if (!Number.isSafeInteger(endedAt) || endedAt < match.createdAt) {
    throw new Error('Data de encerramento inválida.');
  }
  return { ...match, status: 'abandoned', updatedAt: endedAt };
}