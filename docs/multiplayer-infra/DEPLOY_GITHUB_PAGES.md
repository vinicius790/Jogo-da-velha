# Publicar no GitHub Pages

## Por que funciona em subcaminho

O Pages de um repositório publica em `https://usuario.github.io/repositorio/`. Para isso:

- `vite.config.js` usa `base: './'`: todos os caminhos gerados são relativos;
- o manifesto usa `start_url: "./"`, `scope: "./"` e ícones com caminho relativo;
- o service worker resolve tudo a partir do próprio escopo (`self.registration.scope`).

`npm run verify-build` falha se o `index.html` ou o manifesto gerados tiverem caminho absoluto.

## Passos

1. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Actions → Deploy Pages → Run workflow**.

O workflow (`.github/workflows/pages.yml`) roda `npm ci`, os testes, o build, a verificação do
build e publica `dist/`.

O disparo é manual de propósito: se fosse a cada push e o Pages não estivesse habilitado, o
workflow falharia sempre. Depois de habilitar, quem quiser publicação automática pode acrescentar
`push: { branches: [main] }` ao `on:`.

## Multiplayer no Pages

O Pages só hospeda o front-end. Para o modo Online é preciso hospedar o servidor de salas em outro
lugar, com TLS (`wss://`), e definir `OMEGA_CORS_ORIGIN=https://usuario.github.io`. Veja
[OPERATIONS.md](OPERATIONS.md). Os demais modos funcionam sem servidor.

## Situação da verificação

O build com caminhos relativos e o funcionamento offline foram testados localmente
(`npm run e2e`, contra `vite preview`). A publicação no GitHub Pages em si não foi executada na
preparação desta versão.
