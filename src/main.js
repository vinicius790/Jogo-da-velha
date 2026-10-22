// Ponto de entrada da interface: carrega o estado, liga os controladores e restaura a partida.
import { GameEngine } from './core/engine/game.js';
import { decodeState } from './core/serialization/share.js';
import { emit, on } from './services/event-bus.js';
import { t } from './services/i18n.js';
import { clearGame, getState, loadStore, subscribe } from './state/store.js';
import { initAnalyticsController } from './ui/controllers/analytics.js';
import { initDataController } from './ui/controllers/data.js';
import { adoptGame, initGameController, refresh, startGame } from './ui/controllers/game.js';
import { initOnlineController } from './ui/controllers/online.js';
import { initLocalMatchController } from './ui/controllers/local-match.js';
import { initPuzzleController } from './ui/controllers/puzzles.js';
import { initReplayController } from './ui/controllers/replays.js';
import { initSettingsController } from './ui/controllers/settings.js';
import { initTournamentController } from './ui/controllers/tournaments.js';
import { errorText, toast } from './ui/dom.js';
import { session } from './ui/session.js';

const SHARE_HASH = '#share=';

/** Partida recebida por link: é validada, pode ser continuada, mas nunca entra no perfil. */
function loadSharedGame() {
  if (!location.hash.startsWith(SHARE_HASH)) return false;
  try {
    const code = decodeURIComponent(location.hash.slice(SHARE_HASH.length));
    const snapshot = { ...decodeState(code), mode: 'local', meta: null };
    adoptGame(GameEngine.from(snapshot), { unrated: true });
    toast(t('toast.sharedLoaded'));
    return true;
  } catch (error) {
    toast(t('toast.sharedInvalid', { reason: errorText(error) }), 'error');
    return false;
  } finally {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

async function restoreSavedGame() {
  const saved = getState().game;
  // Só partidas locais podem ser retomadas; online e IA × IA dependem de uma sessão viva.
  if (saved && (saved.mode === 'ai' || saved.mode === 'local') && saved.status === 'playing') {
    adoptGame(GameEngine.from(saved));
    return true;
  }
  if (saved) await clearGame();
  return false;
}

async function boot() {
  session.profile = (await loadStore()).profile;
  initSettingsController();
  initGameController();
  initLocalMatchController();
  initOnlineController();
  initPuzzleController();
  initTournamentController();
  initAnalyticsController();
  initReplayController();
  initDataController();

  on('language:changed', refresh);
  // Outra aba alterou perfil, replays ou torneios.
  subscribe((state) => {
    session.profile = state.profile;
    emit('profile:changed');
    emit('state:restored');
  });

  if (!loadSharedGame() && !(await restoreSavedGame())) await startGame();

  // O service worker só existe no build de produção (em desenvolvimento atrapalharia o HMR).
  if (import.meta.env?.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('[sw] registro falhou', error);
    });
  }
}

boot();
