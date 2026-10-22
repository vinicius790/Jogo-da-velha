import { achievementRows } from '../../features/achievements.js';
import { rankingRows } from '../../features/ranking.js';
import { formatDate, formatNumber, t } from '../../services/i18n.js';
import { $, el } from '../dom.js';

const XP_PER_LEVEL = 100;

export function renderProfile(profile) {
  $('#profile-name').textContent = profile.name;
  $('#played').textContent = profile.played;
  $('#wins').textContent = profile.wins;
  $('#draws').textContent = profile.draws;
  $('#rating').textContent = profile.rating;
  $('#profile-glicko').textContent = t('profile.glicko', {
    rating: Math.round(profile.glicko.rating),
    deviation: Math.round(profile.glicko.deviation),
  });
  $('#level').textContent = t('profile.level', {
    level: Math.floor(profile.xp / XP_PER_LEVEL) + 1,
  });
  $('#xp-bar').style.width = `${profile.xp % XP_PER_LEVEL}%`;

  const rows = achievementRows(profile.achievements);
  $('#achievements').replaceChildren(
    ...rows.map((row) => {
      const state = t(row.unlocked ? 'ach.unlocked' : 'ach.locked');
      const title = t(`ach.${row.id}.title`);
      const description = t(`ach.${row.id}.desc`);
      return el(
        'li',
        {
          class: `achievement ${row.unlocked ? 'unlocked' : 'locked'}`,
          title: description,
          'aria-label': `${title} (${state}): ${description}`,
        },
        [el('span', { 'aria-hidden': 'true' }, row.icon), el('strong', {}, title)],
      );
    }),
  );
  $('#achievement-total').textContent = `${profile.achievements.length}/${rows.length}`;
}

function bestWins(entry) {
  if (!entry.top.length) return '—';
  const summary = (record) => {
    const time = formatNumber(record.durationMs / 1000, 1);
    const level = record.difficulty ? ` · ${t(`level.${record.difficulty}`)}` : '';
    return t('ranking.win', { moves: record.moves, seconds: time }) + level;
  };
  const [first, ...rest] = entry.top;
  if (!rest.length) return summary(first);
  return el('details', {}, [
    el('summary', {}, summary(first)),
    el(
      'ol',
      { class: 'study-list', start: 2 },
      rest.map((record) => el('li', {}, summary(record))),
    ),
  ]);
}

/** Ranking local: um quadro por tamanho de tabuleiro + variante, ordenado pelo Elo do quadro. */
export function renderRanking(ranking) {
  const body = $('#ranking');
  const rows = rankingRows(ranking);
  if (!rows.length) {
    body.replaceChildren(el('tr', {}, el('td', { colspan: 6 }, t('ranking.empty'))));
    return;
  }
  body.replaceChildren(
    ...rows.map((row) => {
      const cells = [
        row.position,
        `${row.size}×${row.size} · ${t(`variant.${row.variant}`)}`,
        row.rating,
        `${row.wins}-${row.draws}-${row.losses}`,
        row.bestStreak,
        bestWins(row),
      ];
      return el(
        'tr',
        {},
        cells.map((value) => el('td', {}, value)),
      );
    }),
  );
}

export function renderHistory(history) {
  const body = $('#history');
  if (!history.length) {
    body.replaceChildren(el('tr', {}, el('td', { colspan: 6 }, t('history.empty'))));
    return;
  }
  body.replaceChildren(
    ...history.slice(0, 15).map((entry) => {
      const mode =
        entry.mode === 'ai'
          ? `${t('mode.ai')} · ${t(`level.${entry.difficulty}`)}`
          : t(`mode.${entry.mode}`);
      const board = `${entry.config.size}×${entry.config.size} · ${t(`variant.${entry.config.variant}`)}`;
      const delta = entry.rated ? `${entry.ratingDelta >= 0 ? '+' : ''}${entry.ratingDelta}` : '—';
      const cells = [
        formatDate(entry.finishedAt),
        mode,
        board,
        t(`outcome.${entry.outcome}`),
        entry.moves,
        delta,
      ];
      return el(
        'tr',
        {},
        cells.map((value) => el('td', {}, value)),
      );
    }),
  );
}
