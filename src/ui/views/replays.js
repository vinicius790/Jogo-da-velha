import { formatDate, t } from '../../services/i18n.js';
import { $, el } from '../dom.js';

function resultText(replay) {
  if (replay.result === 'draw') return t('status.draw');
  if (replay.endReason === 'timeout') return t('status.timeout', { mark: replay.result });
  return replay.result ? t('status.won', { mark: replay.result }) : t('status.unfinished');
}

export function renderReplayList(replays, { onOpen, onStudy, onReview }) {
  const list = $('#replay-list');
  $('#replay-count').textContent = t('replay.count', { count: replays.length });
  if (!replays.length) {
    list.replaceChildren(el('p', { class: 'hint-text' }, t('replay.empty')));
    return;
  }
  list.replaceChildren(
    ...replays.slice(0, 30).map((replay) => {
      const { size, variant } = replay.config;
      return el('article', { class: 'telemetry-card' }, [
        el('strong', {}, `${formatDate(replay.createdAt)} · ${size}×${size}`),
        el(
          'small',
          {},
          `${t(`variant.${variant}`)} · ${t(`mode.${replay.mode}`)} · ` +
            `${t('board.moves', { count: replay.moves.length })} · ${resultText(replay)}`,
        ),
        el('div', { class: 'button-grid three' }, [
          el('button', { type: 'button', onclick: () => onOpen(replay) }, t('replay.open')),
          el('button', { type: 'button', onclick: () => onStudy(replay) }, t('replay.study')),
          el('button', { type: 'button', onclick: () => onReview(replay) }, t('review.open')),
        ]),
      ]);
    }),
  );
}
