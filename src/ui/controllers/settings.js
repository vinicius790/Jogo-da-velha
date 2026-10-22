import { VERSION } from '../../core/version.js';
import { deviceProfile, watchConnectivity } from '../../services/device.js';
import { emit, on } from '../../services/event-bus.js';
import { applyTranslations, setLanguage, t } from '../../services/i18n.js';
import { setSoundEnabled } from '../../services/sound.js';
import { updateProfile } from '../../state/store.js';
import { $, $$, toast } from '../dom.js';
import { session } from '../session.js';
import { renderHistory, renderProfile, renderRanking } from '../views/dashboard.js';

let installPrompt = null;
let currentView = 'play';

function renderNetworkStatus(online) {
  const badge = $('#network-status');
  badge.textContent = t(online ? 'network.online' : 'network.offline');
  badge.classList.toggle('warning', !online);
}

/** Aplica as preferências do perfil (tema, animações, som, idioma) e redesenha o painel. */
export function applySettings() {
  const { settings } = session.profile;
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.motion = settings.motion;
  setSoundEnabled(settings.sound);
  $('#sound-button').setAttribute('aria-pressed', String(settings.sound));
  setLanguage(settings.language);
  applyTranslations();
  $('#app-version').textContent = t('settings.version', { version: VERSION });
  renderNetworkStatus(navigator.onLine);
  renderProfile(session.profile);
  renderHistory(session.profile.history);
  renderRanking(session.profile.ranking);
}

async function saveSettings(change) {
  session.profile = await updateProfile((profile) => ({
    ...profile,
    ...change.profile,
    settings: { ...profile.settings, ...change.settings },
  }));
  applySettings();
}

export function switchView(view) {
  currentView = view;
  for (const tab of $$('.tab')) {
    const active = tab.dataset.view === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-current', active ? 'page' : 'false');
  }
  for (const panel of $$('[data-view-panel]')) panel.hidden = panel.dataset.viewPanel !== view;
  emit('view:changed', view);
}

function openSettings() {
  const { name, settings } = session.profile;
  $('#settings-name').value = name;
  $('#settings-language').value = settings.language;
  $('#settings-motion').value = settings.motion;
  $('#settings-dialog').returnValue = '';
  $('#settings-dialog').showModal();
}

async function closeSettings() {
  if ($('#settings-dialog').returnValue !== 'save') return;
  const languageChanged = $('#settings-language').value !== session.profile.settings.language;
  await saveSettings({
    profile: { name: $('#settings-name').value },
    settings: { language: $('#settings-language').value, motion: $('#settings-motion').value },
  });
  if (languageChanged) emit('language:changed');
}

async function install() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => null);
  installPrompt = null;
  $('#install-button').hidden = true;
}

export function initSettingsController() {
  // Primeira visita: respeita a preferência do sistema por menos animação.
  if (deviceProfile().reducedMotion && session.profile.settings.motion === 'full') {
    session.profile.settings.motion = 'reduced';
  }
  applySettings();

  $('#theme-button').addEventListener('click', () =>
    saveSettings({
      settings: { theme: session.profile.settings.theme === 'dark' ? 'light' : 'dark' },
    }),
  );
  $('#sound-button').addEventListener('click', () =>
    saveSettings({ settings: { sound: !session.profile.settings.sound } }),
  );
  $('#settings-button').addEventListener('click', openSettings);
  $('#settings-dialog').addEventListener('close', closeSettings);
  for (const tab of $$('.tab')) tab.addEventListener('click', () => switchView(tab.dataset.view));

  watchConnectivity(renderNetworkStatus);
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    $('#install-button').hidden = deviceProfile().standalone;
  });
  window.addEventListener('appinstalled', () => {
    $('#install-button').hidden = true;
    toast(t('toast.installed'), 'success');
  });
  $('#install-button').addEventListener('click', install);

  on('view:request', switchView);
  on('profile:changed', () => {
    renderProfile(session.profile);
    renderHistory(session.profile.history);
    renderRanking(session.profile.ranking);
  });
  on('language:changed', () => emit('view:changed', currentView));
  switchView(currentView);
}
