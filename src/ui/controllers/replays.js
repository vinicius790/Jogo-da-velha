import { DECIDED_SCORE } from '../../core/ai/minimax.js';
import { nextMistake } from '../../core/analysis/review.js';
import { cellToCoordinate } from '../../core/notation.js';
import { toJSONL } from '../../core/serialization/jsonl.js';
import { applyEvent } from '../../features/progression.js';
import { makeReplay, replayFrame } from '../../features/replay.js';
import { lessonsFromReport } from '../../features/study.js';
import { runTask } from '../../services/ai-worker-client.js';
import { emit, on } from '../../services/event-bus.js';
import { formatNumber, t } from '../../services/i18n.js';
import { getState, updateProfile } from '../../state/store.js';
import { $, announce, download, el, errorText, toast } from '../dom.js';
import { humanSymbol, session } from '../session.js';
import { renderGrid } from '../views/board-view.js';
import { renderReplayList } from '../views/replays.js';

const PLAYBACK_MS = 700;

let current = null; // { replay, turn }
let timer = null;
/** Análise pós-jogo do replay aberto (`reviewGame`) e a alternativa destacada no tabuleiro. */
let review = null;
let preview = -1;

function stopPlayback() {
  clearInterval(timer);
  timer = null;
  $('#replay-play').textContent = t('replay.play');
}

function showFrame() {
  const controls = [
    '#replay-first',
    '#replay-prev',
    '#replay-next',
    '#replay-last',
    '#replay-play',
  ];
  for (const id of controls) $(id).disabled = !current;
  $('#review-next-mistake').disabled = !review;
  if (!current) {
    $('#replay-status').textContent = t('replay.choose');
    $('#replay-board').replaceChildren();
    $('#review-detail').replaceChildren();
    return;
  }
  const { replay, turn } = current;
  const frame = replayFrame(replay, turn);
  const position = review?.positions[turn] ?? null;
  renderGrid($('#replay-board'), {
    board: frame.board,
    size: replay.config.size,
    winningLine: frame.winningLine,
    highlight: preview >= 0 ? preview : turn ? replay.moves[turn - 1].index : -1,
    candidates: position ? position.alternatives.map((alt) => alt.index) : [],
    hex: replay.config.variant === 'hex',
    interactive: false,
    label: t('replay.boardLabel', { size: replay.config.size }),
  });
  $('#replay-status').textContent = t('replay.step', { turn, total: replay.moves.length });
  renderReviewDetail(position);
}

/** Pontuação da busca em palavras: vitória/derrota forçada ou o valor heurístico. */
function scoreText(score) {
  if (score === null) return t('review.outOfSearch');
  if (score >= DECIDED_SCORE) return t('review.forcedWin');
  if (score <= -DECIDED_SCORE) return t('review.forcedLoss');
  return t('review.score', { score: formatNumber(score) });
}

/**
 * Painel da posição atual: o lance que foi jogado nela, a nota, e as alternativas da busca.
 * Clicar numa alternativa a destaca no tabuleiro.
 */
function renderReviewDetail(position) {
  const detail = $('#review-detail');
  if (!review) {
    detail.replaceChildren();
    return;
  }
  if (!position) {
    detail.replaceChildren(el('p', { class: 'hint-text' }, t('review.end')));
    return;
  }
  const { size } = current.replay.config;
  const cell = (index) => cellToCoordinate(index, size);
  const threats = position.threats.length ? position.threats.map(cell).join(', ') : '—';
  const alternatives = position.alternatives.map((alt) =>
    el('li', {}, [
      el(
        'button',
        {
          type: 'button',
          class: `text-button${alt.index === preview ? ' active' : ''}`,
          'aria-pressed': String(alt.index === preview),
          onclick: () => {
            preview = preview === alt.index ? -1 : alt.index;
            showFrame();
          },
        },
        cell(alt.index),
      ),
      ` ${scoreText(alt.score)}`,
    ]),
  );
  const badgeText = position.symbol ? ` [${position.symbol}]` : '';
  const elements = [
    el(
      'p',
      { class: `review-grade ${position.grade}` },
      `${t('review.played', {
        turn: position.turn,
        mark: position.mark,
        cell: cell(position.played),
        grade: t(`review.grade.${position.grade}`),
      })}${badgeText}`,
    ),
  ];
  if (position.explanation) {
    elements.push(el('p', { class: 'review-explanation hint-text' }, position.explanation));
  }
  elements.push(
    el('p', {}, `${t('review.playedScore')}: ${scoreText(position.playedScore)}`),
    el(
      'p',
      { class: 'hint-text' },
      t('review.reading', {
        eval: formatNumber(position.evalScore, 1),
        threats,
        depth: position.depth,
      }),
    ),
    el('h4', {}, t('review.alternatives')),
    alternatives.length
      ? el('ol', { class: 'study-list' }, alternatives)
      : el('p', { class: 'hint-text' }, t('review.noAlternatives')),
  );
  detail.replaceChildren(...elements);
}

async function step(delta) {
  if (!current) return;
  const total = current.replay.moves.length;
  current.turn = Math.min(total, Math.max(0, current.turn + delta));
  preview = -1;
  showFrame();
  if (current.turn === total && delta > 0) {
    stopPlayback();
    const { profile, unlocked } = applyEvent(session.profile, { replayWatched: true });
    if (unlocked.length) {
      session.profile = await updateProfile(() => profile);
      emit('profile:changed');
    }
  }
}

function togglePlayback() {
  if (!current) return;
  if (timer) {
    stopPlayback();
    return;
  }
  if (current.turn === current.replay.moves.length) current.turn = 0;
  showFrame();
  $('#replay-play').textContent = t('replay.pause');
  timer = setInterval(() => step(1), PLAYBACK_MS);
}

function open(replay) {
  stopPlayback();
  current = { replay, turn: 0 };
  review = null;
  preview = -1;
  $('#study-output').replaceChildren();
  $('#review-status').textContent = '';
  showFrame();
}

/** Análise pós-jogo: busca alpha-beta em cada posição (no Web Worker), com alternativas. */
async function analyze(replay) {
  open(replay);
  $('#review-status').textContent = t('review.running');
  try {
    const result = await runTask('review', { replay });
    if (current?.replay !== replay) return; // outro replay foi aberto enquanto calculava
    review = result;
    const own = replay.player ? [replay.player] : ['X', 'O'];
    const mistakes = own.reduce(
      (sum, mark) => sum + result.summary[mark].inaccuracy + result.summary[mark].blunder,
      0,
    );
    $('#review-status').textContent = t('review.done', { mistakes });
    showFrame();
  } catch (error) {
    $('#review-status').textContent = '';
    if (error.message !== 'cancelled') toast(errorText(error), 'error');
  }
}

/** Vai para a posição do próximo erro (imprecisão ou erro grave), voltando ao início no fim. */
function jumpToMistake() {
  if (!current || !review) return;
  stopPlayback();
  let turn = nextMistake(review, current.turn + 1);
  if (turn < 0) turn = nextMistake(review, 0);
  if (turn < 0) {
    toast(t('review.noMistakes'));
    return;
  }
  current.turn = turn - 1; // a posição ANTES do lance errado
  preview = -1;
  showFrame();
  announce(t('review.jumped', { turn }));
}

/** Estudo: classifica os lances do replay no Web Worker e lista imprecisões e erros. */
async function study(replay) {
  open(replay);
  const output = $('#study-output');
  output.replaceChildren(el('li', {}, t('study.running')));
  try {
    const report = await runTask('grade', { replay });
    const lessons = lessonsFromReport(replay, report, replay.player);
    const { size } = replay.config;
    output.replaceChildren(
      ...(lessons.length
        ? lessons.map((lesson) =>
            el(
              'li',
              {},
              t(`study.${lesson.severity}`, {
                turn: lesson.turn,
                mark: lesson.mark,
                played: cellToCoordinate(lesson.played, size),
                best: cellToCoordinate(lesson.best, size),
              }),
            ),
          )
        : [el('li', {}, t('study.clean'))]),
    );
  } catch (error) {
    output.replaceChildren();
    if (error.message !== 'cancelled') toast(errorText(error), 'error');
  }
}

function renderList() {
  renderReplayList(getState().replays, { onOpen: open, onStudy: study, onReview: analyze });
  showFrame();
}

function exportReplays() {
  const { replays } = getState();
  if (!replays.length) {
    toast(t('replay.empty'), 'error');
    return;
  }
  download('omega-replays.jsonl', toJSONL(replays), 'application/x-ndjson');
}

export function initReplayController() {
  $('#replay-first').addEventListener('click', () => step(-Infinity));
  $('#replay-prev').addEventListener('click', () => step(-1));
  $('#replay-next').addEventListener('click', () => step(1));
  $('#replay-last').addEventListener('click', () => step(Infinity));
  $('#replay-play').addEventListener('click', togglePlayback);
  $('#export-replays').addEventListener('click', exportReplays);
  $('#review-next-mistake').addEventListener('click', jumpToMistake);
  const replayPanel = $('[data-view-panel="replays"]');
  replayPanel.addEventListener('keydown', (event) => {
    if (event.target.matches('input, textarea, select')) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      step(-Infinity);
    } else if (event.key === 'End') {
      event.preventDefault();
      step(Infinity);
    } else if (event.key === ' ' || event.code === 'Space') {
      if (event.target.tagName !== 'BUTTON') {
        event.preventDefault();
        togglePlayback();
      }
    }
  });
  // "Analisar partida" no diálogo de resultado: abre a partida recém-terminada na análise.
  $('#review-game').addEventListener('click', () => {
    $('#result-dialog').close();
    const state = session.game?.state;
    if (!state?.moves.length) {
      toast(t('replay.nothing'), 'error');
      return;
    }
    emit('view:request', 'replays');
    analyze(makeReplay(state, humanSymbol(state)));
  });
  // "Ver replay" na aba Jogar abre a partida atual (mesmo em andamento) no reprodutor.
  $('#replay-now').addEventListener('click', () => {
    const state = session.game?.state;
    if (!state?.moves.length) {
      toast(t('replay.nothing'), 'error');
      return;
    }
    emit('view:request', 'replays');
    open(makeReplay(state));
  });
  on('view:changed', (view) => (view === 'replays' ? renderList() : stopPlayback()));
  on('language:changed', () => !$('[data-view-panel="replays"]').hidden && renderList());
  on('state:restored', () => {
    current = null;
    review = null;
  });
}
