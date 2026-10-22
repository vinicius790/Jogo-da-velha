const media = (query) => typeof matchMedia !== 'undefined' && matchMedia(query).matches;

/** Características do dispositivo que mudam o comportamento da interface. */
export function deviceProfile() {
  return {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    reducedMotion: media('(prefers-reduced-motion: reduce)'),
    standalone: media('(display-mode: standalone)'),
  };
}

/** Chama `onChange(online)` quando a conexão cai ou volta; devolve a função para cancelar. */
export function watchConnectivity(onChange) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onChange(navigator.onLine);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}
