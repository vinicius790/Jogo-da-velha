import { cellToCoordinate } from '../../core/notation.js';
import { t } from '../../services/i18n.js';
import { el } from '../dom.js';

const KEY_STEPS = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };

function cellLabel(index, size, value) {
  const name = cellToCoordinate(index, size);
  return value
    ? t('board.cellTaken', { cell: name, mark: value })
    : t('board.cellEmpty', { cell: name });
}

/**
 * Desenha um tabuleiro acessível dentro de `container` (que tem role="grid"):
 * grid → row → gridcell → button. Só uma casa fica na ordem de tabulação (roving tabindex);
 * as setas movem o foco e Enter/Espaço jogam.
 * Casas não jogáveis usam aria-disabled (e não `disabled`) para continuarem focáveis.
 */
export function renderGrid(
  container,
  {
    board,
    size,
    winningLine = null,
    highlight = -1,
    candidates = [],
    hex = false,
    fading = [],
    interactive = true,
    onSelect = null,
    label,
  },
) {
  const active = container.contains(document.activeElement)
    ? Number(document.activeElement.dataset.index)
    : -1;
  const tabStop = active >= 0 ? active : Math.max(0, board.indexOf(null));

  container.style.setProperty('--size', size);
  // Hexagonal: cada linha é deslocada meia casa em relação à anterior (losango de hexágonos).
  container.classList.toggle('hex', hex);
  container.setAttribute('aria-label', label);
  container.setAttribute('aria-rowcount', size);
  container.setAttribute('aria-colcount', size);

  const rows = [];
  for (let row = 0; row < size; row += 1) {
    const cells = [];
    for (let col = 0; col < size; col += 1) {
      const index = row * size + col;
      const value = board[index];
      const playable = interactive && value === null;
      const classes = ['cell'];
      if (value) classes.push(`mark-${value.toLowerCase()}`);
      if (winningLine?.includes(index)) classes.push('winner');
      if (index === highlight) classes.push('hint');
      if (candidates.includes(index)) classes.push('candidate');
      if (fading.includes(index)) classes.push('fading');
      const button = el(
        'button',
        {
          type: 'button',
          class: classes.join(' '),
          'data-index': index,
          tabindex: index === tabStop ? 0 : -1,
          'aria-label': cellLabel(index, size, value),
          'aria-disabled': playable ? null : 'true',
        },
        value ?? '',
      );
      cells.push(el('div', { role: 'gridcell', class: 'board-gridcell' }, button));
    }
    const rowNode = el('div', { role: 'row', class: 'board-row' }, cells);
    // Via CSSOM: a CSP (style-src 'self') bloquearia um atributo style.
    rowNode.style.setProperty('--row', row);
    rows.push(rowNode);
  }
  container.replaceChildren(...rows);

  // Um único par de ouvintes por tabuleiro (delegação), recriado a cada desenho.
  container.onclick = (event) => {
    const button = event.target.closest('button.cell');
    if (!button || button.getAttribute('aria-disabled') === 'true') return;
    onSelect?.(Number(button.dataset.index));
  };
  container.onkeydown = (event) => {
    const button = event.target.closest('button.cell');
    if (!button) return;
    const index = Number(button.dataset.index);
    let nextIndex = -1;

    const step = KEY_STEPS[event.key];
    if (step) {
      const row = Math.floor(index / size) + step[0];
      const col = (index % size) + step[1];
      if (row >= 0 && row < size && col >= 0 && col < size) {
        nextIndex = row * size + col;
      }
    } else if (event.key === 'Home') {
      nextIndex = event.ctrlKey ? 0 : Math.floor(index / size) * size;
    } else if (event.key === 'End') {
      nextIndex = event.ctrlKey ? size * size - 1 : Math.floor(index / size) * size + (size - 1);
    } else if (event.key === 'PageUp') {
      nextIndex = index % size;
    } else if (event.key === 'PageDown') {
      nextIndex = (size - 1) * size + (index % size);
    }

    if (nextIndex >= 0 && nextIndex < size * size) {
      event.preventDefault();
      const next = container.querySelector(`[data-index="${nextIndex}"]`);
      if (next) {
        button.tabIndex = -1;
        next.tabIndex = 0;
        next.focus();
      }
    }
  };

  if (active >= 0) container.querySelector(`[data-index="${active}"]`)?.focus();
}
