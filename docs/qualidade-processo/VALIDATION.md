# Registro de validação

Verificação da versão 12.0.0, 2 de outubro de 2026, Windows 11, Node 24.16.0, npm 11.13.0 (a
verificação da 12.1.0 está na seção seguinte). Cada linha foi executada; o resultado é o observado.

| Comando                                                          | Resultado                                                  |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `npm ci` (cópia limpa, sem `node_modules`)                       | 99 pacotes instalados a partir do `package-lock.json`      |
| `npm run lint`                                                   | sem erros nem avisos                                       |
| `npm run format:check`                                           | todos os arquivos no padrão do Prettier                    |
| `npm test`                                                       | 134 testes, 134 passaram                                   |
| `npm run build`                                                  | build ok (JS ≈ 110 kB, 36,5 kB gzip; Worker ≈ 18 kB)       |
| `npm run verify-build`                                           | 7 arquivos no precache do service worker, todos existentes |
| `PW_CHANNEL=msedge npm run e2e`                                  | 12 testes, 12 passaram (inclui o teste offline)            |
| `npm run server` + `GET /health` + `host` por WebSocket          | servidor respondeu `status: ok` e criou a sala             |
| `npm run smoke`, `audit`, `ui-audit`, `syntax`, `doctor`, `sbom` | todos ok                                                   |
| `npm run benchmark` (várias configurações)                       | ver [AI_BENCHMARKS.md](../ia/AI_BENCHMARKS.md)             |

## Versão 12.1.0

Verificada em 3 de outubro de 2026, Windows 11, Node 24.16.0, npm 11.13.0, numa cópia limpa do
projeto com `npm ci` (instalação temporária, apagada depois). E2E com o Microsoft Edge instalado.

| Comando                                                  | Resultado                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm ci`                                                 | 99 pacotes instalados a partir do `package-lock.json`, 0 alertas |
| `npm run check` (lint, formato, testes, build, verifica) | tudo ok                                                          |
| `npm run lint`                                           | sem erros nem avisos                                             |
| `npm run format:check`                                   | todos os arquivos no padrão do Prettier                          |
| `npm test`                                               | 188 testes, 188 passaram (14 no servidor real com `ws`)          |
| `npm run build` + `npm run verify-build`                 | build ok (JS ≈ 133 kB, 43 kB gzip); 7 arquivos no precache       |
| `PW_CHANNEL=msedge npm run e2e` (duas vezes seguidas)    | 17 testes, 17 passaram nas duas                                  |
| `npm run smoke`, `audit`, `ui-audit`, `syntax`, `doctor` | todos ok                                                         |
| `npm run sbom`                                           | 124 componentes; arquivo idêntico ao versionado                  |

Os testes com relógio real (servidor e e2e online) e o puzzle hexagonal no navegador também
foram repetidos várias vezes seguidas, sem falha.

## Não verificado

- **Docker**: não há Docker na máquina; `Dockerfile` e `docker-compose.yml` não foram executados.
- **GitHub Actions e GitHub Pages**: os workflows não rodaram (nada foi publicado). Os mesmos
  comandos que eles executam passaram localmente; no CI o e2e usa o Chromium do Playwright, que
  localmente foi substituído pelo Microsoft Edge instalado.
- **Instalação da PWA** (botão "Instalar aplicativo") e leitores de tela: só verificação manual
  possível, não feita.
