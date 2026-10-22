import { DIFFICULTY_LEVELS } from '../core/constants.js';
import { normalizeConfig } from '../core/engine/validator.js';

export const HUMAN = 'human';
const POINTS = Object.freeze({ win: 3, draw: 1 });
const MAX_TOURNAMENTS = 20;

const isPlayer = (id) => id === HUMAN || DIFFICULTY_LEVELS.includes(id);

/** Todos contra todos em turno único; em cada partida, `x` joga com X (e começa). */
function roundRobin(players) {
  const matches = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      // Alterna quem fica com X para ninguém começar sempre.
      const [x, o] = (i + j) % 2 ? [players[i], players[j]] : [players[j], players[i]];
      matches.push({ id: `m${matches.length + 1}`, x, o, status: 'pending', winner: null });
    }
  }
  return matches;
}

/**
 * Cria um torneio de pontos corridos. `players` são ids: 'human' ou um nível da IA.
 * As partidas com o humano são jogadas no tabuleiro; as demais são simuladas IA × IA.
 */
export function createTournament({ id, name, config, players, createdAt = Date.now() }) {
  const unique = [...new Set(players)].filter(isPlayer);
  if (unique.length < 2) throw new Error('Um torneio precisa de ao menos dois participantes.');
  return {
    id,
    name: String(name).slice(0, 60),
    config: normalizeConfig(config),
    players: unique,
    matches: roundRobin(unique),
    createdAt,
  };
}

/** Registra o resultado de uma partida: `winner` é 'draw' ou o id de um dos dois jogadores. */
export function recordMatch(tournament, matchId, winner) {
  const match = tournament.matches.find((item) => item.id === matchId);
  if (!match) throw new Error('Partida inexistente.');
  if (match.status === 'done') throw new Error('Partida já registrada.');
  if (winner !== 'draw' && winner !== match.x && winner !== match.o) {
    throw new Error('Vencedor inválido.');
  }
  return {
    ...tournament,
    matches: tournament.matches.map((item) =>
      item.id === matchId ? { ...item, status: 'done', winner } : item,
    ),
  };
}

/** Converte o resultado de uma partida ('X' | 'O' | 'draw') no vencedor do confronto. */
export function winnerFromResult(match, result) {
  if (result === 'draw') return 'draw';
  return result === 'X' ? match.x : match.o;
}

/** Classificação: 3 pontos por vitória, 1 por empate; desempate por vitórias. */
export function standings(tournament) {
  const table = new Map(
    tournament.players.map((player) => [
      player,
      { player, played: 0, wins: 0, draws: 0, losses: 0, points: 0 },
    ]),
  );
  for (const match of tournament.matches) {
    if (match.status !== 'done') continue;
    const x = table.get(match.x);
    const o = table.get(match.o);
    x.played += 1;
    o.played += 1;
    if (match.winner === 'draw') {
      x.draws += 1;
      o.draws += 1;
      x.points += POINTS.draw;
      o.points += POINTS.draw;
    } else {
      const [won, lost] = match.winner === match.x ? [x, o] : [o, x];
      won.wins += 1;
      won.points += POINTS.win;
      lost.losses += 1;
    }
  }
  return [...table.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export function isComplete(tournament) {
  return tournament.matches.every((match) => match.status === 'done');
}

/** Campeão (primeiro da classificação) — só existe com o torneio completo. */
export function champion(tournament) {
  return isComplete(tournament) ? standings(tournament)[0].player : null;
}

function validMatch(match, players) {
  if (!match || typeof match.id !== 'string') return false;
  if (!players.includes(match.x) || !players.includes(match.o) || match.x === match.o) return false;
  if (match.status === 'pending') return match.winner === null;
  return match.status === 'done' && ['draw', match.x, match.o].includes(match.winner);
}

/** Descarta torneios malformados vindos de armazenamento, backup ou outra aba. */
export function sanitizeTournaments(list) {
  if (!Array.isArray(list)) return [];
  const clean = [];
  for (const item of list) {
    try {
      const players = item.players.filter(isPlayer);
      const valid =
        typeof item.id === 'string' &&
        item.id.length <= 80 &&
        players.length === item.players.length &&
        players.length >= 2 &&
        Array.isArray(item.matches) &&
        item.matches.length <= 64 &&
        item.matches.every((match) => validMatch(match, players));
      if (!valid) continue;
      clean.push({
        id: item.id,
        name: String(item.name ?? '').slice(0, 60),
        config: normalizeConfig(item.config),
        players,
        matches: item.matches.map(({ id, x, o, status, winner }) => ({ id, x, o, status, winner })),
        createdAt: Number.isFinite(item.createdAt) ? item.createdAt : 0,
      });
    } catch {
      // item malformado: ignorado
    }
  }
  return clean.slice(0, MAX_TOURNAMENTS);
}
