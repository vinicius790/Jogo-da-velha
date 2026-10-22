// Service worker do OMEGA Tic-Tac-Toe.
// As duas constantes abaixo são substituídas no build (plugin em vite.config.js) pela versão do
// cache e pela lista real de arquivos gerados. Em desenvolvimento o SW não é registrado.
const CACHE = 'omega-__CACHE_VERSION__';
const PRECACHE = self.__PRECACHE_MANIFEST__ || [];

const BASE = new URL('./', self.registration.scope);
const INDEX = new URL('index.html', BASE).toString();
// Os arquivos do precache não variam por cabeçalho; ignorar `Vary` evita falhas de busca no
// cache quando o servidor envia, por exemplo, `Vary: Origin`.
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, BASE).toString())))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Navegação: sempre o shell em cache (funciona offline); rede só se o cache falhar.
  if (request.mode === 'navigate') {
    event.respondWith(caches.match(INDEX, MATCH).then((cached) => cached || fetch(request)));
    return;
  }

  // Demais arquivos: cache primeiro; o que vier da rede é guardado para o próximo uso offline.
  event.respondWith(
    caches.match(request, MATCH).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
