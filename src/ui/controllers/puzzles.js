import { findWinningLine } from '../../core/engine/win.js';
import { dailyChallenge, dailyPuzzleStreak } from '../../features/challenges.js';
import { applyEvent } from '../../features/progression.js';
import { PUZZLE_CONFIGS, generatePuzzle, validatePuzzle } from '../../features/puzzles.js';
import { emit, on } from '../../services/event-bus.js';
import { t } from '../../services/i18n.js';
import { getState, markPuzzleSolved, updateProfile } from '../../state/store.js';
import { $, el, toast } from '../dom.js';
import { session } from '../session.js';
import { renderGrid } from '../views/board-view.js';

let puzzle = null;
let solvedBoard = null;

function render() {
  if (!puzzle) puzzle = generatePuzzle(Date.now(), PUZZLE_CONFIGS[Number($('#puzzle-size').value)]);
  const solvedIds = getState().puzzles;
  const board = solvedBoard ?? puzzle.board;
  const lastMove = solvedBoard ? solvedBoard.findIndex((cell, i) => cell !== puzzle.board[i]) : -1;
  renderGrid($('#puzzle-board'), {
    board,
    size: puzzle.config.size,
    winningLine: solvedBoard
      ? findWinningLine(solvedBoard, lastMove, puzzle.toMove, puzzle.config)
      : null,
    hex: puzzle.config.variant === 'hex',
    interactive: !solvedBoard,
    onSelect: attempt,
    label: t('puzzle.boardLabel', { size: puzzle.config.size }),
  });
  const prefix = puzzle.daily ? `${t('puzzle.dailyOf', { date: puzzle.date })} ` : '';
  const alreadySolved = solvedIds.includes(puzzle.id);
  const key = solvedBoard || alreadySolved ? 'puzzle.solved' : 'puzzle.prompt';
  const streak = puzzle.daily ? dailyPuzzleStreak(solvedIds) : null;
  const streakText = streak
    ? ` ${t('puzzle.streak', { current: streak.current, best: streak.best })}`
    : '';
  $('#puzzle-status').textContent =
    prefix + t(key, { mark: puzzle.toMove, count: puzzle.config.winLength }) + streakText;
  $('#puzzle-count').textContent = t('puzzle.solvedCount', { count: solvedIds.length });
}

async function attempt(index) {
  if (!validatePuzzle(puzzle, index)) {
    toast(t('puzzle.wrong'), 'error');
    return;
  }
  solvedBoard = puzzle.board.slice();
  solvedBoard[index] = puzzle.toMove;
  await markPuzzleSolved(puzzle.id);
  const { profile, unlocked } = applyEvent(session.profile, { puzzleSolved: true });
  if (unlocked.length) {
    session.profile = await updateProfile(() => profile);
    emit('profile:changed');
  }
  toast(t('puzzle.correct'), 'success');
  render();
}

function show(next) {
  puzzle = next;
  solvedBoard = null;
  render();
}

/** Opções de tabuleiro (refeitas na troca de idioma, por causa do nome da variante). */
function fillSizes() {
  const select = $('#puzzle-size');
  const selected = select.value || '0';
  select.replaceChildren(
    ...PUZZLE_CONFIGS.map((config, i) =>
      el(
        'option',
        { value: i },
        `${config.size}×${config.size} (${config.winLength}) · ${t(`variant.${config.variant}`)}`,
      ),
    ),
  );
  select.value = selected;
}

export function initPuzzleController() {
  fillSizes();
  $('#new-puzzle').addEventListener('click', () => show(null));
  $('#puzzle-size').addEventListener('change', () => show(null));
  $('#daily-challenge').addEventListener('click', () => show(dailyChallenge()));
  on('view:changed', (view) => view === 'puzzles' && render());
  on('language:changed', () => {
    fillSizes();
    if (puzzle) render();
  });
}
