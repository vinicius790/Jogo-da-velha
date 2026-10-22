import { hasKey, t } from '../services/i18n.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Cria um elemento. Texto sempre entra como nó de texto (nunca como HTML). */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [children].flat()) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Anúncio imediato para leitores de tela. */
export function announce(message) {
  const region = $('#sr-live');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

export function toast(message, type = 'info') {
  const region = $('#toast');
  if (!region) return;
  const node = el('div', { class: `toast ${type}` }, message);
  region.append(node);
  setTimeout(() => node.remove(), 4000);
}

/** Mensagem traduzida de um erro: usa o código (`OmegaError`/servidor) quando há tradução. */
export function errorText(error) {
  const key = `error.${error?.code}`;
  return error?.code && hasKey(key) ? t(key) : String(error?.message ?? error);
}

/** Preenche uma lista de definições (`<dl>`) com pares [rótulo, valor]. */
export function renderMetrics(list, rows) {
  list.replaceChildren(
    ...rows.map(([label, value]) =>
      el('div', { class: 'metric' }, [el('dt', {}, label), el('dd', {}, value)]),
    ),
  );
}

/** Oferece um arquivo gerado no navegador para download. */
export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = el('a', { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}
