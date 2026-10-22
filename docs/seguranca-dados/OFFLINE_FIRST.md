# Funcionamento offline (PWA)

Arquivos: `public/sw.js`, `vite.config.js` (plugin `omega-sw-manifest`), `public/manifest.webmanifest`,
registro em `src/main.js`.

## Como funciona

1. **Build** — o Vite gera os arquivos com hash no nome (`assets/index-<hash>.js` etc.). Um plugin
   em `vite.config.js` roda depois do build, lista tudo o que foi gerado em `dist/` e escreve em
   `dist/sw.js`:
   - a lista de precache (`PRECACHE`);
   - o nome do cache, derivado de um hash do conteúdo de todos os arquivos (`omega-<hash>`).
2. **Primeira visita** — a página registra `sw.js` (só no build de produção). Na instalação, o
   service worker baixa e guarda todos os arquivos do precache.
3. **Visitas seguintes** — navegações recebem o `index.html` do cache; os demais arquivos da mesma
   origem vêm do cache e, se não estiverem lá, da rede (e são guardados).
4. **Atualização** — um build novo tem outro hash, portanto outro nome de cache: o service worker
   novo instala, assume as abas e apaga o cache antigo. A página carregada continua com a versão
   antiga até ser recarregada (não há aviso de "nova versão").

A busca no cache ignora o cabeçalho `Vary`: alguns servidores enviam `Vary: Origin`, e sem isso os
arquivos em cache não eram encontrados quando a página estava offline.

## O defeito da versão 11

O service worker listava `src/main.js` e `src/ui/styles/app.css` — caminhos do ambiente de
desenvolvimento, que não existem em `dist/`. O `cache.addAll` falhava e o service worker não
instalava em produção. O nome do cache era fixo (`omega-v11`).

## O que funciona sem rede

Tudo, menos o modo Online: partidas contra a IA (o Web Worker está no precache), puzzles,
torneios, replays, backup. Os dados do usuário ficam em IndexedDB/localStorage, separados do cache
do service worker.

## Verificação

- `npm run verify-build` confere que os marcadores foram substituídos e que todo arquivo do
  precache existe em `dist/`.
- `npm run e2e` tem um teste que carrega o app, espera o service worker assumir a página, desliga
  a rede, recarrega e joga uma partida contra a IA.

## Limites

- Em desenvolvimento (`npm run dev`) o service worker não é registrado.
- Requer HTTPS ou `localhost` (regra dos navegadores para service workers).
- O manifesto só tem um ícone SVG; a instalação como aplicativo depende de o navegador aceitar
  ícone SVG. A instalação em si (botão "Instalar aplicativo") não foi testada automaticamente.
- Mapas de código (`.map`) não entram no precache.
