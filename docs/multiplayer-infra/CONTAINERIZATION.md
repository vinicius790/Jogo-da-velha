# Contêineres

> **Não verificado.** O `Dockerfile` e o `docker-compose.yml` foram escritos e revisados, mas não
> foram executados: a máquina em que a versão 12 foi preparada não tem Docker. Trate como ponto de
> partida e teste antes de depender deles.

## Dockerfile

Um arquivo, três estágios:

| Estágio    | Base                | Conteúdo                                                               |
| ---------- | ------------------- | ---------------------------------------------------------------------- |
| `build`    | `node:24-alpine`    | `npm ci` + `npm run build` → `dist/`                                   |
| `web`      | `nginx:1.29-alpine` | `dist/` servido pelo nginx com `deploy/nginx.conf`                     |
| `realtime` | `node:24-alpine`    | `npm ci --omit=dev`, `server/` e `src/core/`; roda como usuário `node` |

```bash
docker build --target web -t omega-web .
docker build --target realtime -t omega-realtime .
```

## docker-compose

```bash
docker compose up --build
```

- `web`: front-end em `http://localhost:8080`.
- `realtime`: servidor de salas em `ws://localhost:8787`, com
  `OMEGA_CORS_ORIGIN=http://localhost:8080`.

No app, modo Online, o campo do servidor já vem com `ws://localhost:8787`.

## nginx (`deploy/nginx.conf`)

- `try_files` com retorno para `index.html`;
- cabeçalhos `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`;
- `sw.js` com `Cache-Control: no-cache`, para o navegador sempre conferir se há versão nova do
  service worker.

## Diferença em relação à versão 11

O serviço `realtime` montava o repositório como volume somente leitura e rodava `npm install`
dentro dele — o que falha, porque não há onde gravar `node_modules`. Agora a imagem é construída
com as dependências.
