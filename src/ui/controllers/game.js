import { analyzePosition } from '../../core/analysis/analyzer.js';
import { activePieces } from '../../core/engine/board.js';
import { clockView } from '../../core/engine/clock.js';
import { GameEngine } from '../../core/engine/game.js';
import { cellToCoordinate } from '../../core/notation.js';
import { applyGameResult } from '../../features/progression.js';
import { makeReplay } from '../../features/replay.js';
import { markOwners } from '../../features/local-match.js';
import { runTask } from '../../services/ai-worker-client.js';
import { emit } from '../../services/event-bus.js';
import { t } from '../../services/i18n.js';
import { tone } from '../../services/sound.js';
import { track } from '../../services/telemetry.js';
import { appendReplay, clearGame, saveGame, updateProfile } from '../../state/store.js';
import { drawSparkline } from '../chart.js';
import { $, announce, el, errorText, toast } from '../dom.js';
import { humanSymbol, session } from '../session.js';
import { renderGrid } from '../views/board-view.js';
import { renderInsights } from '../views/insights.js';

const SPECTATOR_DELAY_MS = 300;
const CLOCK_TICK_MS = 250;
const LOW_TIME_MS = 10_000;

/** Configuração escolhida nos seletores da aba Jogar. */
export function readConfig() {
  const size = Number($('#size').value);
  return {
    size,
    winLength: Math.min(size, Number($('#win').value) || 3),
    variant: $('#variant').value,
  };
}

/** Limites do relógio escolhidos na aba Jogar (0 = sem limite). */
export function readClock() {
  return { moveMs: Number($('#clock-move').value), gameMs: Number($('#clock-game').value) };
}

/** "Vence com" só oferece valores possíveis para o tamanho escolhido (3 até o tamanho). */
function syncWinOptions() {
  const size = Number($('#size').value);
  const select = $('#win');
  const previous = Number(select.value) || 3;
  select.replaceChildren(
    ...Array.from({ length: size - 2 }, (_, i) => el('option', { value: i + 3 }, String(i + 3))),
  );
  select.value = String(Math.min(previous, size));
}

function syncVariantHelp() {
  $('#variant-help').textContent = t(`variant.${$('#variant').value}.help`);
}

function statusText(state) {
  if (state.status === 'playing') {
    const localMatch = session.localMatch;
    if (
      state.mode === 'local' &&
      localMatch?.match.status === 'active' &&
      localMatch.currentGameId === state.id
    ) {
      const owners = markOwners(localMatch.match);
      const player = localMatch.match.players[state.current === 'X' ? owners.x : owners.o];
      return t('localMatch.turn', { name: player, mark: state.current });
    }
    const human = humanSymbol(state);
    const key = human && state.current === human ? 'status.yourTurn' : 'status.turn';
    return t(key, { mark: state.current });
  }
  if (state.endReason === 'timeout') return t('status.timeout', { mark: state.result });
  if (state.status === 'won') return t('status.won', { mark: state.result });
  if (state.status === 'draw') return t('status.draw');
  return t('status.aborted');
}

function canHumanPlay(state) {
  if (state.status !== 'playing' || session.aiBusy) return false;
  if (state.mode === 'local') return true;
  if (state.mode === 'spectator') return false;
  return state.current === humanSymbol(state);
}

/** Redesenha a aba Jogar a partir do estado do motor. */
export function refresh() {
  const game = session.game;
  if (!game) return;
  const state = game.state;
  const { size, winLength, variant } = state.config;
  const interactive = canHumanPlay(state);
  let fading = [];
  if (variant === 'fade' && state.status === 'playing') {
    const own = activePieces(state.moves, state.current, state.board);
    if (own.length >= 3) fading = [own[0]];
  }

  renderGrid($('#board'), {
    board: state.board,
    size,
    winningLine: state.winningLine,
    highlight: session.hintCell,
    hex: variant === 'hex',
    fading,
    interactive,
    onSelect: onMove,
    label: t('board.label', { size }),
  });
  $('#turn').textContent = statusText(state);
  $('#moves').textContent = t('board.moves', { count: state.moves.length });
  $('#state-meta').textContent =
    `${size}×${size} · ${t('board.winWith', { count: winLength })} · ${t(`variant.${variant}`)}`;

  const editable = interactive && (state.mode === 'ai' || state.mode === 'local');
  $('#undo').disabled = !editable || !state.moves.length;
  $('#redo').disabled = !editable || !state.redo.length;
  $('#hint').disabled = !interactive;
  $('#analyze').disabled = !interactive;

  const analysis = analyzePosition(state.board, state.config, state.current);
  // Série do gráfico sempre do ponto de vista de X (a avaliação é antissimétrica).
  session.evalSeries = session.evalSeries.slice(0, state.moves.length);
  session.evalSeries.push(state.current === 'X' ? analysis.evalScore : -analysis.evalScore);
  drawSparkline($('#sparkline'), session.evalSeries);
  renderInsights({ analysis, size, verdict: session.lastVerdict, bestMove: session.hintCell });

  renderClock(state);
  if (state.status !== 'playing') finalize(state);
}

/** Passa a exibir `engine` como a partida atual. */
export function adoptGame(engine, { unrated = false } = {}) {
  const state = engine.state;
  const isNewGame = session.game?.state.id !== state.id;
  session.game = engine;
  if (unrated) session.unratedIds.add(state.id);
  if (isNewGame) {
    // Partida retomada: o tempo com a página fechada não conta contra ninguém. Online o relógio
    // é do servidor e continua correndo; o snapshot já traz o tempo certo.
    if (state.mode !== 'online') engine.resumeClock();
    session.aiBusy = false;
    session.lastVerdict = null;
    session.hintCell = -1;
    session.evalSeries = [];
    session.startedAt = Date.now();
  }
  refresh();
  emit('game:adopted', { state, unrated });
  // Partida nova ou retomada em que a vez é da IA (ex.: página fechada enquanto ela pensava).
  if (isNewGame) maybeAiMove();
}

/** Começa uma partida nova; sem argumentos, usa os seletores da aba Jogar. */
export async function startGame({
  mode = $('#mode').value,
  config = readConfig(),
  difficulty = $('#difficulty').value,
  human = $('#symbol').value,
  meta = {},
  clock = readClock(),
  localMatchId = null,
} = {}) {
  if (mode === 'online') {
    toast(t('toast.onlineNeedsRoom'), 'error');
    return;
  }
  emit('game:starting', { mode, localMatchId });
  emit('game:leaving-online');
  const engine = new GameEngine({
    mode,
    config,
    difficulty,
    meta: mode === 'ai' ? { human, ...meta } : null,
    // Relógio só onde há humano jogando nesta tela (IA × IA não precisa dele).
    clock: mode === 'ai' || mode === 'local' ? clock : null,
  });
  adoptGame(engine);
  await saveGame(engine.state);
  if (mode === 'spectator') spectatorLoop(engine);
}

function afterMove(markPlayed, index) {
  const state = session.game.state;
  session.hintCell = -1;
  if (state.mode !== 'online') saveGame(state);
  tone(markPlayed === 'X' ? 520 : 390);
  announce(
    t('board.announce', { mark: markPlayed, cell: cellToCoordinate(index, state.config.size) }),
  );
  refresh();
}

function onMove(index) {
  const game = session.game;
  if (!game || !canHumanPlay(game.state)) return;
  if (game.state.mode === 'online') {
    try {
      session.online.client.move(index);
    } catch (error) {
      toast(errorText(error), 'error');
    }
    return;
  }
  try {
    const state = game.play(index);
    afterMove(state.moves.at(-1).mark, state.moves.at(-1).index);
    maybeAiMove();
  } catch (error) {
    toast(errorText(error), 'error');
    // 'time-expired': o motor já encerrou a partida; a tela mostra o resultado.
    refresh();
  }
}

/** Pede um lance ao motor (no Web Worker). Devolve null se a partida mudou enquanto calculava. */
async function requestMove(game, difficulty) {
  const state = game.state;
  session.aiBusy = true;
  refresh();
  try {
    const verdict = await runTask('move', {
      board: state.board,
      config: state.config,
      player: state.current,
      difficulty,
    });
    const stale =
      session.game !== game ||
      game.state.moves.length !== state.moves.length ||
      game.state.status !== 'playing';
    if (stale) return null;
    track('ai-move', { algorithm: verdict.algorithm, elapsedMs: verdict.elapsedMs });
    return verdict;
  } catch (error) {
    if (error.message !== 'cancelled') toast(errorText(error), 'error');
    return null;
  } finally {
    if (session.game === game) session.aiBusy = false;
  }
}

async function maybeAiMove() {
  const game = session.game;
  const state = game?.state;
  if (!state || state.mode !== 'ai' || state.status !== 'playing') return;
  if (state.current === humanSymbol(state) || session.aiBusy) return;
  const verdict = await requestMove(game, state.difficulty);
  if (!verdict) {
    if (session.game === game) refresh();
    return;
  }
  session.lastVerdict = verdict;
  try {
    const next = game.play(verdict.move);
    afterMove(next.moves.at(-1).mark, verdict.move);
  } catch (error) {
    // A IA também perde no relógio se o cálculo passar do limite.
    toast(errorText(error), 'error');
    refresh();
  }
}

/** Modo IA × IA: os dois lados usam o nível escolhido. */
async function spectatorLoop(game) {
  while (session.game === game && game.state.status === 'playing') {
    const verdict = await requestMove(game, game.state.difficulty);
    if (!verdict) return;
    session.lastVerdict = verdict;
    const next = game.play(verdict.move);
    afterMove(next.moves.at(-1).mark, verdict.move);
    await new Promise((resolve) => setTimeout(resolve, SPECTATOR_DELAY_MS));
  }
}

/** Desfaz até voltar a ser a vez do humano (contra a IA isso são dois lances). */
function undo() {
  const game = session.game;
  if (!game || !canHumanPlay(game.state)) return;
  game.undo();
  const state = game.state;
  if (state.mode === 'ai' && state.moves.length && state.current !== humanSymbol(state)) {
    game.undo();
  }
  session.hintCell = -1;
  saveGame(game.state);
  refresh();
  maybeAiMove();
}

function redo() {
  const game = session.game;
  if (!game || !canHumanPlay(game.state)) return;
  try {
    game.redoMove();
    const state = game.state;
    if (state.mode === 'ai' && state.redo.length && state.current !== humanSymbol(state)) {
      game.redoMove();
    }
  } catch (error) {
    // 'time-expired': refazer depois do tempo encerra a partida (como um lance comum).
    toast(errorText(error), 'error');
  }
  saveGame(game.state);
  refresh();
  maybeAiMove();
}

/** Dica/análise: roda a busca do nível Especialista para o lado que tem a vez. */
async function suggest({ notify }) {
  const game = session.game;
  if (!game || !canHumanPlay(game.state)) return;
  const verdict = await requestMove(game, 'expert');
  if (!verdict) {
    if (session.game === game) refresh();
    return;
  }
  session.lastVerdict = verdict;
  session.hintCell = verdict.move;
  refresh();
  if (notify) {
    toast(t('toast.hint', { cell: cellToCoordinate(verdict.move, game.state.config.size) }));
  }
}

/** Fim de partida: registra no perfil (quando as regras permitem), salva o replay e avisa. */
async function finalize(state) {
  if (session.finalizedId === state.id) return;
  session.finalizedId = state.id;
  await clearGame();

  const player = humanSymbol(state);
  const unrated = session.unratedIds.has(state.id);
  const outcome = applyGameResult(session.profile, state, {
    player,
    unrated,
    offline: !navigator.onLine,
    durationMs: Date.now() - session.startedAt,
  });
  if (outcome) {
    session.profile = await updateProfile(() => outcome.profile);
    emit('profile:changed');
  }
  const watchedOnly = state.mode === 'spectator' || (state.mode === 'online' && !player);
  const hasGame = state.moves.length > 0 || state.endReason === 'timeout';
  if (!watchedOnly && !unrated && hasGame) {
    await appendReplay(makeReplay(state, player));
  }
  emit('game:finished', { state, unrated });
  showResult(state, outcome);
}

function showResult(state, outcome) {
  tone(state.result === 'draw' ? 330 : 660, 0.18, 'triangle');
  $('#result-title').textContent = statusText(state);
  const lines = [];
  if (outcome) {
    lines.push(t(`result.${outcome.entry.outcome}`));
    if (outcome.entry.rated) {
      const delta = outcome.entry.ratingDelta;
      lines.push(t('result.rating', { delta: `${delta >= 0 ? '+' : ''}${delta}` }));
    } else {
      lines.push(t('result.unratedOnline'));
    }
    if (outcome.unlocked.length) {
      const names = outcome.unlocked.map((id) => t(`ach.${id}.title`)).join(', ');
      lines.push(t('result.achievements', { names }));
    }
  } else {
    lines.push(t('result.notRecorded'));
  }
  $('#result-detail').textContent = lines.join(' ');
  if (!$('#result-dialog').open) $('#result-dialog').showModal();
}

const pad = (value) => String(value).padStart(2, '0');

function formatClock(ms) {
  const seconds = Math.ceil(ms / 1000);
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

/** Instante usado pelo HUD: online, o do servidor (o relógio é dele); nos demais, o local. */
function clockNow(state) {
  return Date.now() + (state.mode === 'online' ? (session.online.clockOffset ?? 0) : 0);
}

/** HUD do relógio: saldo de cada lado e, para quem tem a vez, o tempo que resta no lance. */
function renderClock(state) {
  for (const mark of ['X', 'O']) {
    const node = $(`#clock-${mark.toLowerCase()}`);
    node.hidden = !state.clock;
    if (!state.clock) continue;
    const ticking = state.mode !== 'online' || session.online.clockStarted;
    const running = state.status === 'playing' && ticking ? state.current : null;
    const left = clockView(state.clock, running, clockNow(state))[mark];
    const parts = [];
    if (left.game !== null) parts.push(t('clock.game', { time: formatClock(left.game) }));
    if (left.move !== null) parts.push(t('clock.move', { time: formatClock(left.move) }));
    node.textContent = `${mark} · ${parts.join(' · ')}`;
    const low = Math.min(left.game ?? Infinity, left.move ?? Infinity) <= LOW_TIME_MS;
    node.classList.toggle('active', running === mark);
    node.classList.toggle('low', running === mark && low);
  }
}

function startClock() {
  setInterval(() => {
    const game = session.game;
    const state = game?.state;
    if (state?.status !== 'playing') return;
    const seconds = Math.floor((Date.now() - session.startedAt) / 1000);
    $('#timer').textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
    if (!state.clock) return;
    // Online quem decide a derrota por tempo é o servidor (o estado chega pela rede).
    if (state.mode === 'online') {
      renderClock(state);
      return;
    }
    // Nos demais modos o motor decide; a tela só pergunta e redesenha.
    if (game.checkClock().status !== 'playing') {
      refresh(); // finalize registra o resultado e limpa a partida salva
    } else {
      renderClock(state);
    }
  }, CLOCK_TICK_MS);
}

export function initGameController() {
  syncWinOptions();
  syncVariantHelp();
  $('#size').addEventListener('change', syncWinOptions);
  $('#variant').addEventListener('change', syncVariantHelp);
  $('#start').addEventListener('click', () => startGame());
  $('#rematch').addEventListener('click', () => {
    $('#result-dialog').close();
    const previous = session.game?.state;
    // Revanche repete a partida anterior; partidas online/de link caem nos seletores.
    if (previous && previous.mode !== 'online' && !session.unratedIds.has(previous.id)) {
      startGame({
        mode: previous.mode,
        config: previous.config,
        difficulty: previous.difficulty,
        human: previous.meta?.human,
        clock: previous.clock,
      });
    } else {
      startGame();
    }
  });
  $('#close-result').addEventListener('click', () => $('#result-dialog').close());
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#hint').addEventListener('click', () => suggest({ notify: true }));
  $('#analyze').addEventListener('click', () => suggest({ notify: false }));
  $('#fullscreen').addEventListener('click', () => $('#board-shell').requestFullscreen?.());
  startClock();

  // Não perde a partida em andamento ao fechar ou trocar de aba.
  document.addEventListener('visibilitychange', () => {
    const state = session.game?.state;
    if (document.visibilityState !== 'hidden' || state?.status !== 'playing') return;
    if (state.mode === 'ai' || state.mode === 'local') saveGame(state);
  });
}
