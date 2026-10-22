import { describe } from '../../core/analysis/statistics.js';
import { DIFFICULTY_LEVELS, ELO } from '../../core/constants.js';
import { cellToCoordinate } from '../../core/notation.js';
import { summarize } from '../../features/analytics.js';
import { openingStats } from '../../features/opening-explorer.js';
import { applyEvent } from '../../features/progression.js';
import { cancelTasks, runTask } from '../../services/ai-worker-client.js';
import { emit, on } from '../../services/event-bus.js';
import { formatNumber, t } from '../../services/i18n.js';
import { snapshot } from '../../services/telemetry.js';
import { getState, updateProfile } from '../../state/store.js';
import { drawSparkline } from '../chart.js';
import { $, el, errorText, renderMetrics, toast } from '../dom.js';
import { session } from '../session.js';
import { readConfig } from './game.js';

let arenaRunning = false;

const percent = (part, total) => (total ? `${formatNumber((100 * part) / total, 1)}%` : '—');

/** Resumo do histórico real do perfil + curva do Elo reconstruída pelos deltas registrados. */
function renderSummary() {
  const profile = session.profile;
  const summary = summarize(profile.history);
  const config = readConfig();
  const openings = openingStats(getState().replays, config);
  const firstMove = openings.mostPlayed
    ? `${cellToCoordinate(Number(openings.mostPlayed.prefix), config.size)} (${openings.mostPlayed.games}/${openings.games})`
    : '—';
  renderMetrics($('#analytics-summary'), [
    [t('analytics.played'), summary.played],
    [t('analytics.record'), `${summary.wins}-${summary.draws}-${summary.losses}`],
    [t('analytics.winRate'), percent(summary.wins, summary.played)],
    [t('analytics.avgMoves'), formatNumber(summary.avgMoves, 1)],
    [t('analytics.bestStreak'), profile.bestStreak],
    [
      t('analytics.glicko'),
      `${Math.round(profile.glicko.rating)} ± ${Math.round(profile.glicko.deviation)}`,
    ],
    [t('analytics.firstMove'), firstMove],
  ]);

  const deltas = profile.history.map((entry) => entry.ratingDelta).reverse();
  const curve = [ELO.baseline];
  for (const delta of deltas) curve.push(curve.at(-1) + delta);
  drawSparkline($('#rating-chart'), curve, 'info');

  const aiMoves = describe(snapshot('ai-move').map((sample) => sample.data.elapsedMs));
  renderMetrics($('#session-metrics'), [
    [t('analytics.sessionMoves'), aiMoves.count],
    [t('analytics.sessionMean'), aiMoves.count ? `${formatNumber(aiMoves.mean, 1)} ms` : '—'],
    [t('analytics.sessionP95'), aiMoves.count ? `${formatNumber(aiMoves.p95, 1)} ms` : '—'],
  ]);
}

function renderArena(tally, target) {
  const latency = describe(tally.moveMs);
  $('#arena-progress').value = target ? tally.games / target : 0;
  renderMetrics($('#arena-results'), [
    [t('arena.done'), `${formatNumber(tally.games)}/${formatNumber(target)}`],
    [t('arena.winsX'), `${tally.x} (${percent(tally.x, tally.games)})`],
    [t('arena.winsO'), `${tally.o} (${percent(tally.o, tally.games)})`],
    [t('arena.draws'), `${tally.draws} (${percent(tally.draws, tally.games)})`],
    [t('arena.avgMoves'), tally.games ? formatNumber(tally.moves / tally.games, 1) : '—'],
    [t('arena.latency'), tally.games ? `${formatNumber(latency.mean, 2)} ms` : '—'],
    [t('arena.latencyP95'), tally.games ? `${formatNumber(latency.p95, 2)} ms` : '—'],
  ]);
}

/**
 * Simula exatamente a quantidade pedida de partidas, em lotes, dentro do Web Worker:
 * a interface continua respondendo, mostra o progresso e permite parar.
 */
async function runArena() {
  if (arenaRunning) return;
  const target = Number($('#arena-games').value);
  const config = readConfig();
  const x = $('#arena-x').value;
  const o = $('#arena-o').value;
  // Lotes maiores no 3×3 (partidas de microssegundos); tabuleiros maiores vão de uma em uma.
  const batch = config.size === 3 ? 50 : 1;
  const tally = { games: 0, x: 0, o: 0, draws: 0, moves: 0, moveMs: [] };

  arenaRunning = true;
  $('#arena-run').disabled = true;
  $('#arena-stop').disabled = false;
  renderArena(tally, target);
  try {
    while (arenaRunning && tally.games < target) {
      const part = await runTask('arena', {
        games: Math.min(batch, target - tally.games),
        config,
        x,
        o,
      });
      for (const key of ['games', 'x', 'o', 'draws', 'moves']) tally[key] += part[key];
      tally.moveMs.push(...part.moveMs);
      renderArena(tally, target);
    }
  } catch (error) {
    if (error.message !== 'cancelled') toast(errorText(error), 'error');
  } finally {
    arenaRunning = false;
    $('#arena-run').disabled = false;
    $('#arena-stop').disabled = true;
  }
}

function stopArena() {
  arenaRunning = false;
  cancelTasks();
}

async function runLab() {
  const state = session.game?.state;
  if (!state || state.status !== 'playing') {
    toast(t('lab.needGame'), 'error');
    return;
  }
  const button = $('#run-engine-lab');
  button.disabled = true;
  try {
    const report = await runTask('lab', {
      board: state.board,
      config: state.config,
      player: state.current,
    });
    $('#engine-lab-output').replaceChildren(
      ...report.results.map((result) =>
        el(
          'tr',
          {},
          [
            t(`level.${result.difficulty}`),
            cellToCoordinate(result.move, state.config.size),
            t(`algorithm.${result.algorithm}`),
            result.depth || '—',
            result.nodes ? formatNumber(result.nodes) : '—',
            `${formatNumber(result.elapsedMs, 1)} ms`,
          ].map((value) => el('td', {}, value)),
        ),
      ),
    );
    toast(
      t('lab.consensus', {
        cell: cellToCoordinate(report.consensusMove, state.config.size),
        votes: report.consensusVotes,
        total: report.total,
      }),
    );
    const { profile, unlocked } = applyEvent(session.profile, { labRun: true });
    if (unlocked.length) {
      session.profile = await updateProfile(() => profile);
      emit('profile:changed');
    }
  } catch (error) {
    if (error.message !== 'cancelled') toast(errorText(error), 'error');
  } finally {
    button.disabled = false;
  }
}

export function initAnalyticsController() {
  for (const [id, selected] of [
    ['#arena-x', 'hard'],
    ['#arena-o', 'normal'],
  ]) {
    $(id).replaceChildren(
      ...DIFFICULTY_LEVELS.map((level) =>
        el(
          'option',
          { value: level, selected: level === selected, 'data-i18n': `level.${level}` },
          t(`level.${level}`),
        ),
      ),
    );
  }
  $('#arena-run').addEventListener('click', runArena);
  $('#arena-stop').addEventListener('click', stopArena);
  $('#run-engine-lab').addEventListener('click', runLab);
  on('view:changed', (view) => view === 'analytics' && renderSummary());
  on('language:changed', () => !$('[data-view-panel="analytics"]').hidden && renderSummary());
}
