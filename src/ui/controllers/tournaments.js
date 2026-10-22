import { makeId } from '../../core/types.js';
import { applyEvent } from '../../features/progression.js';
import {
  HUMAN,
  champion,
  createTournament,
  recordMatch,
  standings,
  winnerFromResult,
} from '../../features/tournaments.js';
import { runTask } from '../../services/ai-worker-client.js';
import { emit, on } from '../../services/event-bus.js';
import { formatDate, t } from '../../services/i18n.js';
import { getState, saveTournaments, updateProfile } from '../../state/store.js';
import { $, el, errorText, toast } from '../dom.js';
import { session } from '../session.js';
import { readConfig, startGame } from './game.js';

const AI_ENTRANTS = ['easy', 'normal', 'hard'];

function playerName(id) {
  return id === HUMAN ? session.profile.name : t('tournament.ai', { level: t(`level.${id}`) });
}

function standingsTable(tournament) {
  const header = [
    '#',
    'tournament.player',
    'tournament.played',
    'tournament.record',
    'tournament.points',
  ];
  const rows = standings(tournament).map((row, i) => [
    i + 1,
    playerName(row.player),
    row.played,
    `${row.wins}-${row.draws}-${row.losses}`,
    row.points,
  ]);
  return el('table', {}, [
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        header.map((key) => el('th', { scope: 'col' }, key === '#' ? '#' : t(key))),
      ),
    ),
    el(
      'tbody',
      {},
      rows.map((cells) =>
        el(
          'tr',
          {},
          cells.map((value) => el('td', {}, value)),
        ),
      ),
    ),
  ]);
}

function matchRow(tournament, match) {
  const label = `${playerName(match.x)} (X) × ${playerName(match.o)} (O)`;
  let status;
  if (match.status === 'done') {
    status = el(
      'span',
      { class: 'badge' },
      match.winner === 'draw'
        ? t('status.draw')
        : t('tournament.winner', { name: playerName(match.winner) }),
    );
  } else if (match.x === HUMAN || match.o === HUMAN) {
    status = el(
      'button',
      { type: 'button', class: 'primary', onclick: () => playMatch(tournament, match) },
      t('tournament.play'),
    );
  } else {
    status = el(
      'button',
      { type: 'button', onclick: (event) => simulateMatch(tournament, match, event.target) },
      t('tournament.simulate'),
    );
  }
  return el('li', { class: 'match-row' }, [el('span', {}, label), status]);
}

function render() {
  const { tournaments } = getState();
  const list = $('#tournament-list');
  if (!tournaments.length) {
    list.replaceChildren(el('p', { class: 'hint-text' }, t('tournament.empty')));
    return;
  }
  list.replaceChildren(
    ...tournaments.map((tournament) => {
      const { size, winLength, variant } = tournament.config;
      const winner = champion(tournament);
      return el('article', { class: 'telemetry-card' }, [
        el('h3', {}, tournament.name),
        el(
          'small',
          {},
          `${size}×${size} · ${t('board.winWith', { count: winLength })} · ${t(`variant.${variant}`)}`,
        ),
        el(
          'p',
          { class: 'hint-text' },
          winner
            ? t('tournament.champion', { name: playerName(winner) })
            : t('tournament.inProgress'),
        ),
        el('div', { class: 'table-wrap' }, standingsTable(tournament)),
        el(
          'ul',
          { class: 'match-list' },
          tournament.matches.map((match) => matchRow(tournament, match)),
        ),
      ]);
    }),
  );
}

async function create() {
  const { tournaments } = getState();
  const tournament = createTournament({
    id: makeId('cup'),
    name: t('tournament.defaultName', { date: formatDate(Date.now()) }),
    config: readConfig(),
    players: [HUMAN, ...AI_ENTRANTS],
  });
  await saveTournaments([tournament, ...tournaments]);
  toast(t('tournament.created'), 'success');
  render();
}

/** Partida com o humano: vira uma partida normal contra a IA, marcada com o id do confronto. */
function playMatch(tournament, match) {
  const humanIsX = match.x === HUMAN;
  emit('view:request', 'play');
  startGame({
    mode: 'ai',
    config: tournament.config,
    difficulty: humanIsX ? match.o : match.x,
    human: humanIsX ? 'X' : 'O',
    meta: { tournamentId: tournament.id, matchId: match.id },
  });
}

/** Partida IA × IA: jogada de verdade pelo motor, no Web Worker. */
async function simulateMatch(tournament, match, button) {
  button.disabled = true;
  try {
    const tally = await runTask('arena', {
      games: 1,
      config: tournament.config,
      x: match.x,
      o: match.o,
    });
    const result = tally.x ? 'X' : tally.o ? 'O' : 'draw';
    await record(tournament.id, match.id, result);
  } catch (error) {
    button.disabled = false;
    if (error.message !== 'cancelled') toast(errorText(error), 'error');
  }
}

async function record(tournamentId, matchId, result) {
  const { tournaments } = getState();
  const tournament = tournaments.find((item) => item.id === tournamentId);
  const match = tournament?.matches.find((item) => item.id === matchId);
  if (!match || match.status === 'done') return;
  const updated = recordMatch(tournament, matchId, winnerFromResult(match, result));
  await saveTournaments(tournaments.map((item) => (item.id === tournamentId ? updated : item)));

  const winner = champion(updated);
  if (winner) {
    toast(t('tournament.champion', { name: playerName(winner) }), 'success');
    const { profile, unlocked } = applyEvent(session.profile, { tournamentCompleted: true });
    if (unlocked.length) {
      session.profile = await updateProfile(() => profile);
      emit('profile:changed');
    }
  }
  render();
}

export function initTournamentController() {
  $('#create-tournament').addEventListener('click', create);
  on('view:changed', (view) => view === 'tournaments' && render());
  on('language:changed', render);
  on('state:restored', render);
  on('game:finished', ({ state, unrated }) => {
    if (unrated) return; // partida aberta por link não vale para o torneio
    const { tournamentId, matchId } = state.meta ?? {};
    if (tournamentId && matchId) record(tournamentId, matchId, state.result);
  });
}
