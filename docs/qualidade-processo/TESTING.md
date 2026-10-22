# Testes

## Como rodar

```bash
npm test          # unitários + integração do servidor (node --test, sem framework)
npm run e2e       # Playwright contra o build de produção
npm run check     # lint + formato + testes + build + verificação do build
```

`npm test` não precisa de navegador. O `npm run e2e` faz o build, sobe `vite preview` e abre um
navegador; use `PW_CHANNEL=msedge` (ou `chrome`) para aproveitar um navegador instalado, ou
`npx playwright install chromium` para baixar o do Playwright.

## O que cada arquivo cobre

| Arquivo                  | Assunto                                                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `board.test.mjs`         | tabuleiro, lances legais, Gravity, coordenadas                                                                                                                                                                 |
| `win.test.mjs`           | detecção de linha (direções, bordas, linha mais longa que o necessário)                                                                                                                                        |
| `game.test.mjs`          | motor: turnos, fim de partida, desfazer/refazer em sequência, `reset`, cópias defensivas                                                                                                                       |
| `variants.test.mjs`      | Gravity e Misère no motor e na IA                                                                                                                                                                              |
| `property.test.mjs`      | partidas aleatórias nas três variantes mantêm os invariantes; desfazer tudo + refazer tudo                                                                                                                     |
| `ai.test.mjs`            | níveis com força diferente, erro deliberado, solução exata do 3×3, MCTS, lances legais                                                                                                                         |
| `advanced.test.mjs`      | alpha-beta: tabela de transposição não altera o resultado, tática nas folhas, tempo                                                                                                                            |
| `features.test.mjs`      | puzzles, desafio diário, regras de registro no perfil, conquistas                                                                                                                                              |
| `edge.test.mjs`          | torneios, Elo, Glicko-2 (exemplo do artigo), estatística, arena                                                                                                                                                |
| `validator.test.mjs`     | snapshots forjados, saneamento do perfil, estado importado, mensagens entre abas                                                                                                                               |
| `serialization.test.mjs` | replays, notação, link de partida, backups (simples e cifrado), JSONL, estudo, aberturas                                                                                                                       |
| `public-api.test.mjs`    | `src/index.js` em Node, partida completa IA × IA, laboratório de motores                                                                                                                                       |
| `protocol.test.mjs`      | validação de mensagens do servidor (`chat`, `name`, relógio da sala, `moderate`); limpeza de texto                                                                                                             |
| `room.test.mjs`          | salas: autoridade, papéis, retomada, expiração, limites, chat, relógio autoritativo, moderação, spam                                                                                                           |
| `server.test.mjs`        | servidor real em porta livre: origem, partida completa, reconexão, limite por IP, chat, relógio online, moderação                                                                                              |
| `network.test.mjs`       | cliente de salas com WebSocket falso: protocolo, chat, revisão, reconexão, relógio e moderação, expulsão                                                                                                       |
| `expansion.test.mjs`     | relógio (inclusive derrota antes do 1º lance), hexagonal (IA, corte de candidatos, puzzles x solver), ranking, análise                                                                                         |
| `platform.test.mjs`      | versão única, i18n completo, ids do HTML, acessibilidade básica, PWA, dependências                                                                                                                             |
| `e2e/smoke.spec.js`      | navegador: IA, desfazer/refazer, teclado, idioma, puzzles (inclusive hexagonal), torneio, arena, offline, hexagonal com análise, relógio e ranking, sala online real com chat, moderação e relógio do servidor |

## Testes de regressão

Cada defeito corrigido na versão 12 tem um teste cujo nome começa com "regressão:". Para o defeito
da tabela de transposição, o código original foi executado contra um minimax sem poda e divergiu
em 20 de 320 pontuações; o teste atual compara a busca com e sem tabela.

## Determinismo

- Testes que dependem de sorteio usam `seededRng` (xorshift com semente).
- Os testes de busca usam posições pequenas ou orçamento de tempo folgado, para o relógio não
  mudar o resultado.
- `server.test.mjs` espera 1,1 s uma vez (troca de janela do limite de mensagens).

## O que não é testado

- Controladores da interface só são exercitados pelos testes e2e (não há testes unitários de DOM).
- O cliente online (`src/services/network.js`) não tem teste automatizado; o protocolo é testado
  pelo lado do servidor.
- IndexedDB real: em Node o armazenamento cai para memória; a persistência no navegador é
  exercitada só indiretamente pelo e2e.
- Não há medição de cobertura.
- Docker e a publicação no GitHub Pages.
