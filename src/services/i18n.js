import en from './locales/en.js';
import es from './locales/es.js';
import ptBR from './locales/pt-BR.js';

export const dictionaries = Object.freeze({ 'pt-BR': ptBR, en, es });
const FALLBACK = 'pt-BR';
let current = FALLBACK;

export function supportedLanguages() {
  return Object.keys(dictionaries);
}

export function getLanguage() {
  return current;
}

export function setLanguage(language) {
  current = dictionaries[language] ? language : FALLBACK;
  return current;
}

export function hasKey(key) {
  return key in dictionaries[current] || key in dictionaries[FALLBACK];
}

/** Traduz `key`, trocando `{nome}` pelos valores de `params`. Chave desconhecida volta como veio. */
export function t(key, params = {}) {
  const template = dictionaries[current][key] ?? dictionaries[FALLBACK][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(current, { dateStyle: 'short', timeStyle: 'short' });
}

export function formatNumber(value, digits = 0) {
  return Number(value).toLocaleString(current, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Aplica o idioma atual ao HTML estático:
 * - data-i18n="chave": texto do elemento;
 * - data-i18n-title="chave": `title` e `aria-label`;
 * - data-i18n-label="chave": só `aria-label`.
 */
export function applyTranslations(root = document) {
  root.documentElement?.setAttribute('lang', current);
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-i18n-title]')) {
    const text = t(node.dataset.i18nTitle);
    node.title = text;
    node.setAttribute('aria-label', text);
  }
  for (const node of root.querySelectorAll('[data-i18n-label]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nLabel));
  }
}
