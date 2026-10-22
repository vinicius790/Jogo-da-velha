// Torneios, ratings (Elo e Glicko-2) e estatística.
import assert from 'node:assert/strict';
import test from 'node:test';
import { describe, mean, percentile } from '../src/core/analysis/statistics.js';
import { playArena, summarize } from '../src/features/analytics.js';
import {
  HUMAN,
  champion,
  createTournament,
  isComplete,
  recordMatch,
  sanitizeTournaments,
  standings,
  winnerFromResult,
} from '../src/features/tournaments.js';
import { expectedGlicko, updateGlicko2 } from '../src/services/glicko2.js';
import { expected, updateRating } from '../src/services/rating.js';

const config = { size: 3, winLength: 3, variant: 'classic' };
const newTournament = () =>
  createTournament({ id: 't1', name: 'Copa', config, players: [HUMAN, 'easy', 'normal', 'hard'] });

test('torneio: todos contra todos, com X alternando entre os participantes', () => {
  const tournament = newTournament();
  assert.equal(tournament.matches.length, 6);
  const pairs = new Set(tournament.matches.map((match) => [match.x, match.o].sort().join('|')));
  assert.equal(pairs.size, 6, 'cada par se enfrenta uma vez');
  const humanAsX = tournament.matches.filter((match) => match.x === HUMAN).length;
  const humanAsO = tournament.matches.filter((match) => match.o === HUMAN).length;
  assert.equal(humanAsX + humanAsO, 3);
  assert.ok(humanAsX >= 1 && humanAsO >= 1);
});

test('regressão: o torneio pode ser jogado até o fim, com classificação e campeão', () => {
  let tournament = newTournament();
  assert.equal(champion(tournament), null);
  // Joga de verdade as partidas IA × IA e dá a vitória ao humano nas dele.
  for (const match of tournament.matches) {
    let result = match.x === HUMAN ? 'X' : 'O';
    if (match.x !== HUMAN && match.o !== HUMAN) {
      const tally = playArena({ games: 1, config, x: match.x, o: match.o });
      result = tally.x ? 'X' : tally.o ? 'O' : 'draw';
    }
    tournament = recordMatch(tournament, match.id, winnerFromResult(match, result));
  }
  assert.equal(isComplete(tournament), true);
  const table = standings(tournament);
  assert.equal(table[0].player, HUMAN);
  assert.equal(table[0].points, 9);
  assert.equal(champion(tournament), HUMAN);
  assert.equal(
    table.reduce((sum, row) => sum + row.played, 0),
    12,
  );
});

test('pontuação: 3 por vitória, 1 por empate', () => {
  let tournament = createTournament({ id: 't', name: 'x', config, players: ['easy', 'hard'] });
  const [match] = tournament.matches;
  tournament = recordMatch(tournament, match.id, 'draw');
  assert.deepEqual(
    standings(tournament).map((row) => row.points),
    [1, 1],
  );
});

test('recordMatch recusa vencedor de fora, partida repetida e partida inexistente', () => {
  const tournament = newTournament();
  const [match] = tournament.matches;
  assert.throws(() => recordMatch(tournament, match.id, 'omega'), /Vencedor inválido/);
  assert.throws(() => recordMatch(tournament, 'm99', 'draw'), /inexistente/);
  const done = recordMatch(tournament, match.id, 'draw');
  assert.throws(() => recordMatch(done, match.id, 'draw'), /já registrada/);
  assert.equal(tournament.matches[0].status, 'pending', 'o torneio original não é alterado');
});

test('torneios vindos de fora são validados', () => {
  const valid = newTournament();
  const forged = { ...valid, id: 't2', matches: [{ id: 'm1', x: 'easy', o: 'easy' }] };
  const strangers = { ...valid, id: 't3', players: ['human', '<img onerror=x>'] };
  assert.deepEqual(
    sanitizeTournaments([valid, forged, strangers, null, 42]).map((item) => item.id),
    ['t1'],
  );
  assert.deepEqual(sanitizeTournaments('nada'), []);
  assert.throws(() => createTournament({ id: 'a', name: 'b', config, players: [HUMAN] }));
});

test('Elo: esperado soma 1 e vitória contra igual sobe metade de K', () => {
  assert.ok(Math.abs(expected(1000, 1200) + expected(1200, 1000) - 1) < 1e-12);
  assert.equal(updateRating(1000, 1000, 1), 1012);
  assert.equal(updateRating(1000, 1000, 0), 988);
  assert.equal(updateRating(1000, 1000, 0.5), 1000);
});

test('regressão: Glicko-2 reproduz o exemplo do artigo de Glickman', () => {
  // Jogador 1500/200/0,06 contra 1400(30) vitória, 1550(100) derrota, 1700(300) derrota.
  const result = updateGlicko2({ rating: 1500, deviation: 200, volatility: 0.06 }, [
    { opponentRating: 1400, opponentDeviation: 30, score: 1 },
    { opponentRating: 1550, opponentDeviation: 100, score: 0 },
    { opponentRating: 1700, opponentDeviation: 300, score: 0 },
  ]);
  assert.ok(Math.abs(result.rating - 1464.06) < 0.01, `rating ${result.rating}`);
  assert.ok(Math.abs(result.deviation - 151.52) < 0.01, `desvio ${result.deviation}`);
  assert.ok(Math.abs(result.volatility - 0.05999) < 0.00001, `volatilidade ${result.volatility}`);
});

test('Glicko-2: sem jogos só a incerteza cresce; esperado é simétrico', () => {
  const idle = updateGlicko2({ rating: 1600, deviation: 100, volatility: 0.06 }, []);
  assert.equal(idle.rating, 1600);
  assert.ok(idle.deviation > 100);
  assert.ok(Math.abs(expectedGlicko(1500, 1500, 50) - 0.5) < 1e-12);
  assert.ok(expectedGlicko(1700, 1500, 50) > 0.7);
});

test('estatística descritiva', () => {
  assert.equal(mean([1, 2, 3, 4, 5]), 3);
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(percentile([10, 20], 0.5), 15);
  const summary = describe([4, 1, 3, 2, NaN]);
  assert.deepEqual([summary.count, summary.min, summary.max, summary.p50], [4, 1, 4, 2.5]);
  assert.equal(describe([]).mean, 0);
});

test('regressão: a arena joga exatamente o número de partidas pedido e conta resultados reais', () => {
  const tally = playArena({ games: 37, config, x: 'expert', o: 'expert' });
  assert.equal(tally.games, 37);
  assert.equal(tally.x + tally.o + tally.draws, 37);
  assert.equal(tally.draws, 37, 'dois jogadores perfeitos sempre empatam no 3×3');
  assert.equal(tally.moves, 37 * 9);
  assert.equal(tally.moveMs.length, tally.moves, 'um tempo medido por decisão da IA');
});

test('resumo do histórico', () => {
  const history = [
    { outcome: 'win', moves: 5 },
    { outcome: 'loss', moves: 6 },
    { outcome: 'draw', moves: 9 },
    { outcome: 'win', moves: 7 },
  ];
  assert.deepEqual(summarize(history), {
    played: 4,
    wins: 2,
    draws: 1,
    losses: 1,
    winRate: 0.5,
    avgMoves: 6.75,
  });
  assert.equal(summarize([]).winRate, 0);
});
