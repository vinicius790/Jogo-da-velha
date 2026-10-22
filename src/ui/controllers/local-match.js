import {
  closeLocalMatch,
  createLocalMatch,
  markOwners,
  recordLocalMatchGame,
  sanitizeLocalMatch,
} from '../../features/local-match.js';
import { on } from '../../services/event-bus.js';
import { t } from '../../services/i18n.js';
import { $, announce, el, toast } from '../dom.js';
import { session } from '../session.js';
import { readClock, readConfig, refresh, startGame } from './game.js';

const STORAGE_KEY = 'omega-local-match-v1';
let launching = false;

function readStoredMatch() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (value?.version !== 1) return null;
    const match = sanitizeLocalMatch(value.match);
    if (!match) return null;
    const currentGameId =
      match.status === 'active' &&
      typeof value.currentGameId === 'string' &&
      /^[A-Za-z0-9._:-]{1,80}$/.test(value.currentGameId)
        ? value.currentGameId
        : null;
    return { match, currentGameId, persistent: true };
  } catch {
    return null;
  }
}

function persistMatch() {
  const entry = session.localMatch;
  if (!entry) return true;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, match: entry.match, currentGameId: entry.currentGameId }),
    );
    entry.persistent = true;
    return true;
  } catch {
    entry.persistent = false;
    return false;
  }
}

function renderHistory(match) {
  const list = $('#local-match-history');
  const firstRound = match.gamesPlayed - match.recent.length + 1;
  list.replaceChildren(
    ...match.recent.map((game, index) => {
      const round = firstRound + index;
      const label = game.winner === null
        ? t('localMatch.drawRound', { round, moves: game.moveCount })
        : t('localMatch.winRound', {
            round,
            name: match.players[game.winner],
            xName: match.players[game.xPlayer],
            moves: game.moveCount,
          });
      return el('li', {}, label);
    }),
  );
}

function render() {
  const entry = session.localMatch;
  const match = entry?.match ?? null;
  const active = match?.status === 'active';
  $('#local-match-setup').hidden = active;
  $('#local-match-start').hidden = active;
  $('#local-match-live').hidden = !match;
  $('#local-match-next').hidden = !active || Boolean(entry.currentGameId);
  $('#local-match-next').disabled = launching;
  $('#local-match-end').hidden = !active;
  $('#local-match-storage-warning').hidden = !match || entry.persistent !== false;

  if (!match) {
    $('#local-match-status').textContent = t('localMatch.idle');
    $('#local-match-score').textContent = '';
    $('#local-match-owners').textContent = '';
    $('#local-match-history').replaceChildren();
    return;
  }

  $('#local-match-score').textContent = t('localMatch.score', {
    one: match.players[0],
    oneWins: match.wins[0],
    two: match.players[1],
    twoWins: match.wins[1],
    draws: match.draws,
    bestOf: match.bestOf,
  });
  renderHistory(match);

  if (match.status === 'completed') {
    const champion = match.wins[0] > match.wins[1] ? 0 : 1;
    $('#local-match-status').textContent = t('localMatch.champion', {
      name: match.players[champion],
      oneWins: match.wins[0],
      twoWins: match.wins[1],
      draws: match.draws,
    });
    $('#local-match-owners').textContent = '';
  } else if (match.status === 'abandoned') {
    $('#local-match-status').textContent = t('localMatch.abandoned', {
      oneWins: match.wins[0],
      twoWins: match.wins[1],
      draws: match.draws,
    });
    $('#local-match-owners').textContent = '';
  } else {
    const owners = markOwners(match);
    const xName = match.players[owners.x];
    const oName = match.players[owners.o];
    $('#local-match-owners').textContent = t('localMatch.markOwners', { xName, oName });
    if (entry.currentGameId) {
      $('#local-match-status').textContent = t('localMatch.inProgress', {
        round: match.gamesPlayed + 1,
        xName,
        oName,
      });
    } else {
      $('#local-match-status').textContent = t(
        match.gamesPlayed ? 'localMatch.readyNext' : 'localMatch.readyFirst',
        { round: match.gamesPlayed + 1, xName, oName },
      );
    }
  }
}

async function startRound() {
  const entry = session.localMatch;
  if (launching || !entry || entry.match.status !== 'active' || entry.currentGameId) return;
  launching = true;
  render();
  const matchId = entry.match.id;
  try {
    $('#mode').value = 'local';
    await startGame({
      mode: 'local',
      config: entry.match.config,
      clock: entry.match.clock,
      localMatchId: matchId,
    });
    const current = session.localMatch;
    const state = session.game?.state;
    if (
      current?.match.id === matchId &&
      current.match.status === 'active' &&
      state?.mode === 'local' &&
      state.status === 'playing'
    ) {
      current.currentGameId = state.id;
      persistMatch();
      render();
      refresh();
    }
  } catch (error) {
    toast(t('localMatch.startError', { reason: String(error?.message ?? error) }), 'error');
  } finally {
    launching = false;
    render();
  }
}

function startNewMatch() {
  try {
    const match = createLocalMatch({
      players: [$('#local-match-player-one').value, $('#local-match-player-two').value],
      fallbackNames: [t('localMatch.defaultOne'), t('localMatch.defaultTwo')],
      config: readConfig(),
      clock: readClock(),
      bestOf: Number($('#local-match-format').value),
    });
    session.localMatch = { match, currentGameId: null, persistent: true };
    persistMatch();
    render();
    startRound();
  } catch (error) {
    toast(t('localMatch.invalid', { reason: String(error?.message ?? error) }), 'error');
  }
}

function endMatch() {
  const entry = session.localMatch;
  if (!entry || entry.match.status !== 'active') return;
  try {
    entry.match = closeLocalMatch(entry.match);
    entry.currentGameId = null;
    persistMatch();
    render();
    announce(t('localMatch.ended'));
  } catch (error) {
    toast(t('localMatch.invalid', { reason: String(error?.message ?? error) }), 'error');
  }
}

export function initLocalMatchController() {
  session.localMatch = readStoredMatch();
  $('#local-match-start').addEventListener('click', startNewMatch);
  $('#local-match-next').addEventListener('click', startRound);
  $('#local-match-end').addEventListener('click', endMatch);

  on('game:starting', ({ localMatchId } = {}) => {
    const entry = session.localMatch;
    if (!entry?.currentGameId || localMatchId === entry.match.id) return;
    entry.currentGameId = null;
    persistMatch();
    render();
  });

  on('game:adopted', ({ state } = {}) => {
    const entry = session.localMatch;
    if (!entry?.currentGameId || state?.id === entry.currentGameId && state.mode === 'local') return;
    entry.currentGameId = null;
    persistMatch();
    render();
  });

  on('game:finished', ({ state } = {}) => {
    const entry = session.localMatch;
    if (!entry || !state || state.id !== entry.currentGameId) return;
    entry.currentGameId = null;
    if (state.mode === 'local' && ['won', 'draw'].includes(state.status)) {
      try {
        entry.match = recordLocalMatchGame(entry.match, state);
        const last = entry.match.recent.at(-1);
        const message = last.winner === null
          ? t('localMatch.drawRound', { round: last.round, moves: last.moveCount })
          : t('localMatch.point', { name: entry.match.players[last.winner] });
        announce(message);
      } catch {
        toast(t('localMatch.recordError'), 'error');
      }
    }
    persistMatch();
    render();
  });

  on('language:changed', render);
  render();
}