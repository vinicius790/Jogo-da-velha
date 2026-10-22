import { GameEngine } from '../../core/engine/game.js';
import { on } from '../../services/event-bus.js';
import { formatDate, t } from '../../services/i18n.js';
import { RealtimeClient } from '../../services/network.js';
import { $, el, errorText, toast } from '../dom.js';
import { session } from '../session.js';
import { adoptGame, readClock, readConfig } from './game.js';

const CHAT_VISIBLE = 50;

/** Última lista de presentes recebida (redesenhada na troca de idioma). */
let people = null;

function setStatus(text) {
  $('#room-status').textContent = text;
}

/** Nome exibido de quem falou: o nome escolhido ou, sem nome, o papel na sala. */
function speaker(entry) {
  if (entry.name) return entry.name;
  return entry.symbol ?? t('online.role.spectator');
}

function chatItem(entry) {
  const time = formatDate(entry.at);
  return el('li', { class: `chat-entry ${entry.role}` }, [
    el('strong', {}, speaker(entry)),
    el('small', {}, ` ${entry.symbol ? `(${entry.symbol}) ` : ''}${time}`),
    el('p', {}, entry.text),
  ]);
}

/** O texto do chat entra sempre como nó de texto (el), nunca como HTML. */
function renderChat(entries) {
  $('#chat-log').replaceChildren(...entries.slice(-CHAT_VISIBLE).map(chatItem));
}

function appendChat(entry) {
  const log = $('#chat-log');
  log.append(chatItem(entry));
  while (log.children.length > CHAT_VISIBLE) log.firstElementChild.remove();
  log.scrollTop = log.scrollHeight;
}

/** Botão de moderação de um espectador (só aparece para quem criou a sala). */
function moderationButton(action, watcher, name) {
  const label = t(`online.${action}`);
  return el(
    'button',
    {
      type: 'button',
      class: 'text-button',
      'data-moderate': action,
      'aria-label': t('online.moderateLabel', { action: label, name }),
      onclick: () => {
        try {
          session.online.client?.moderate(action, watcher.id);
        } catch (error) {
          toast(errorText(error), 'error');
        }
      },
    },
    label,
  );
}

/** Jogadores e espectadores presentes; o dono da sala vê os botões de moderação. */
function renderPeople() {
  const box = $('#room-people');
  if (!people) {
    box.replaceChildren();
    return;
  }
  const { players = [], watchers = [] } = people;
  const named = players.map((player) => {
    const name = player.name || player.symbol;
    const away = player.connected ? '' : ` ${t('online.away')}`;
    return `${name} (${player.symbol})${away}`;
  });
  const moderator = session.online.role === 'host';
  const audience = watchers.map((watcher) => {
    const name = watcher.name || t('online.anonymous');
    const label = watcher.muted ? `${name} ${t('online.muted')}` : name;
    return el('li', {}, [
      label,
      moderationButton(watcher.muted ? 'unmute' : 'mute', watcher, name),
      moderationButton('kick', watcher, name),
    ]);
  });
  box.replaceChildren(
    el('span', {}, t('online.players', { names: named.join(', ') || '—' })),
    el(
      'span',
      {},
      t('online.spectators', {
        count: watchers.length,
        names: watchers.map((watcher) => watcher.name || t('online.anonymous')).join(', ') || '—',
      }),
    ),
    ...(moderator && audience.length ? [el('ul', {}, audience)] : []),
  );
}

/** Ocultar/mostrar o chat (os dois rótulos ficam no HTML, traduzidos como o resto da página). */
function setChatVisible(visible) {
  $('#chat-body').hidden = !visible;
  const toggle = $('#chat-toggle');
  toggle.setAttribute('aria-expanded', String(visible));
  toggle.querySelector('[data-i18n="chat.hide"]').hidden = !visible;
  toggle.querySelector('[data-i18n="chat.show"]').hidden = visible;
}

function disconnect() {
  const client = session.online.client;
  if (client) {
    // Saída pedida pela tela: o aviso assíncrono de "conexão encerrada" não deve sobrescrever o
    // status que a tela acabou de escrever (ex.: expulsão, troca para partida local).
    client.onStatus = null;
    client.onMessage = null;
    client.close();
  }
  session.online = {
    client: null,
    role: null,
    symbol: null,
    clockOffset: 0,
    clockStarted: false,
  };
  people = null;
  $('#chat-box').hidden = true;
  $('#chat-log').replaceChildren();
  renderPeople();
}

/** Diferença entre o relógio do servidor e o local: o HUD mostra o tempo do servidor. */
function syncClock(message) {
  if (Number.isFinite(message.serverNow)) {
    session.online.clockOffset = message.serverNow - Date.now();
  }
  // Antes de o segundo jogador entrar o relógio da sala está parado.
  session.online.clockStarted = message.clockStarted === true;
}

/** O snapshot do servidor é validado pelas mesmas regras locais antes de ir para a tela. */
function adoptSnapshot(snapshot) {
  try {
    adoptGame(GameEngine.from(snapshot));
  } catch (error) {
    toast(t('toast.badRemoteState', { reason: errorText(error) }), 'error');
  }
}

function handleMessage(message) {
  switch (message.type) {
    case 'room': {
      session.online.role = message.role;
      session.online.symbol = message.symbol;
      syncClock(message);
      $('#room-input').value = message.code;
      const role = t(`online.role.${message.role}`);
      setStatus(t('online.inRoom', { code: message.code, role }));
      $('#chat-box').hidden = false;
      renderChat(Array.isArray(message.chat) ? message.chat : []);
      renderPeople();
      adoptSnapshot(message.snapshot);
      break;
    }
    case 'state':
      syncClock(message);
      adoptSnapshot(message.snapshot);
      break;
    case 'peer':
      people = message;
      renderPeople();
      toast(t('online.peers', { players: message.players.length, spectators: message.spectators }));
      break;
    case 'chat':
      if (message.entry && typeof message.entry.text === 'string') appendChat(message.entry);
      break;
    case 'kicked':
      disconnect();
      setStatus(t('online.kicked'));
      toast(t('online.kicked'), 'error');
      break;
    case 'error':
      toast(errorText(message), 'error');
      break;
    default:
      break; // 'pong' e tipos futuros
  }
}

function handleStatus(status) {
  if (status !== 'connected') setStatus(t(`online.status.${status}`));
}

async function connect(action) {
  disconnect();
  const client = new RealtimeClient($('#server-url').value.trim(), {
    onMessage: handleMessage,
    onStatus: handleStatus,
  });
  session.online.client = client;
  try {
    await client.connect();
    action(client, session.profile?.name);
  } catch {
    disconnect();
    toast(t('toast.connectFailed'), 'error');
  }
}

function withCode(action) {
  const code = $('#room-input').value.trim();
  if (!code) {
    toast(t('toast.needCode'), 'error');
    return;
  }
  connect((client, name) => action(client, code, name));
}

function sendChat(event) {
  event.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text || !session.online.client) return;
  try {
    session.online.client.chat(text);
    input.value = '';
  } catch (error) {
    toast(errorText(error), 'error');
  }
}

export function initOnlineController() {
  const toggleCard = () => {
    $('#online-card').hidden = $('#mode').value !== 'online';
  };
  $('#mode').addEventListener('change', toggleCard);
  toggleCard();
  // Quem cria a sala escolhe o relógio nos mesmos seletores da partida local.
  $('#host-room').addEventListener('click', () =>
    connect((client, name) => client.host(readConfig(), name, readClock())),
  );
  $('#join-room').addEventListener('click', () =>
    withCode((client, code, name) => client.join(code, name)),
  );
  $('#watch-room').addEventListener('click', () =>
    withCode((client, code, name) => client.watch(code, name)),
  );
  $('#chat-form').addEventListener('submit', sendChat);
  $('#chat-toggle').addEventListener('click', () => setChatVisible($('#chat-body').hidden));
  on('game:leaving-online', () => {
    if (!session.online.client) return;
    disconnect();
    setStatus('');
  });
  on('language:changed', renderPeople);
}
