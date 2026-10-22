import { GameEngine } from '../../core/engine/game.js';
import { createBackup, verifyBackup } from '../../core/serialization/backup.js';
import { decryptBackup, encryptBackup } from '../../core/serialization/secure-backup.js';
import { encodeState } from '../../core/serialization/share.js';
import { OmegaError } from '../../core/types.js';
import { VERSION } from '../../core/version.js';
import { applyEvent } from '../../features/progression.js';
import { emit } from '../../services/event-bus.js';
import { t } from '../../services/i18n.js';
import { getState, restoreState, updateProfile } from '../../state/store.js';
import { $, download, errorText, toast } from '../dom.js';
import { session } from '../session.js';
import { adoptGame } from './game.js';

/** Pede uma senha em um diálogo acessível (campo do tipo password). Devolve null se cancelado. */
function askPassword(labelKey) {
  const dialog = $('#password-dialog');
  const input = $('#password-input');
  $('#password-label').textContent = t(labelKey);
  input.value = '';
  dialog.returnValue = '';
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => {
        const password = dialog.returnValue === 'ok' ? input.value : null;
        input.value = '';
        resolve(password || null);
      },
      { once: true },
    );
  });
}

function backupPayload() {
  return { app: VERSION, exportedAt: new Date().toISOString(), state: getState() };
}

async function exportData() {
  const backup = await createBackup(backupPayload());
  download(`omega-backup-${Date.now()}.json`, JSON.stringify(backup, null, 2));
  toast(t('data.exported'), 'success');
}

async function exportSecure() {
  try {
    const password = await askPassword('password.create');
    if (!password) return;
    const bundle = await encryptBackup(backupPayload(), password);
    download(`omega-backup-cifrado-${Date.now()}.json`, JSON.stringify(bundle, null, 2));
    toast(t('data.exportedSecure'), 'success');
  } catch (error) {
    toast(t('data.exportFailed', { reason: errorText(error) }), 'error');
  }
}

/** Importa um backup (simples ou cifrado). Todo o conteúdo passa por `restoreState`, que valida. */
async function importData(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    let payload;
    if (data?.format === 'OMEGA-ENCRYPTED-BACKUP') {
      const password = await askPassword('password.open');
      if (!password) return;
      payload = await decryptBackup(data, password);
    } else if (data?.format === 'OMEGA-BACKUP') {
      if (!(await verifyBackup(data))) {
        throw new OmegaError('backup-integrity', 'Integridade do backup inválida.');
      }
      payload = data.payload;
    } else {
      throw new OmegaError('invalid-backup', 'Arquivo de backup não reconhecido.');
    }
    // `getState` era o nome do campo nos backups anteriores à versão 12.
    const restored = await restoreState(payload.state ?? payload.getState ?? payload);
    const { profile } = applyEvent(restored.profile, { imported: true });
    session.profile = await updateProfile(() => profile);
    emit('profile:changed');
    emit('state:restored');
    if (restored.game && ['ai', 'local'].includes(restored.game.mode)) {
      adoptGame(GameEngine.from(restored.game));
    }
    toast(t('data.imported', { replays: restored.replays.length }), 'success');
  } catch (error) {
    const reason = error instanceof SyntaxError ? t('error.invalid-backup') : errorText(error);
    toast(t('data.importFailed', { reason }), 'error');
  }
}

function shareLink() {
  const state = session.game?.state;
  if (!state) return null;
  return `${location.origin}${location.pathname}#share=${encodeState(state)}`;
}

async function share() {
  const url = shareLink();
  if (!url) return;
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, url });
      return;
    } catch {
      // compartilhamento nativo cancelado ou indisponível: mostra o link
    }
  }
  $('#share-code').value = url;
  $('#share-dialog').showModal();
}

async function copyShare() {
  try {
    await navigator.clipboard.writeText($('#share-code').value);
    toast(t('share.copied'), 'success');
  } catch {
    $('#share-code').select();
    toast(t('share.copyManually'), 'error');
  }
}

export function initDataController() {
  $('#export').addEventListener('click', exportData);
  $('#export-secure').addEventListener('click', exportSecure);
  $('#import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', importData);
  $('#share').addEventListener('click', share);
  $('#copy-share').addEventListener('click', copyShare);
}
