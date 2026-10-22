# Arquitetura

## Camadas

| Pasta          | Responsabilidade                                                           | Pode importar de             |
| -------------- | -------------------------------------------------------------------------- | ---------------------------- |
| `src/core`     | Regras do jogo, IA, análise, serialização. Sem DOM, roda em Node.          | nada fora de `core`          |
| `src/features` | Puzzles, torneios, replays, conquistas, registro de partidas, arena.       | `core`, `services` (cálculo) |
| `src/services` | i18n, Elo, Glicko-2, cliente de rede, som, cliente do Web Worker, eventos. | `core`, `workers/tasks.js`   |
| `src/state`    | Perfil, validação do estado salvo, armazenamento em camadas.               | `core`, `features`           |
| `src/ui`       | Controladores (um por área da tela), views (desenho) e CSS.                | tudo acima                   |
| `src/workers`  | Web Worker que executa a busca da IA e as simulações.                      | `core`, `features`           |
| `server`       | Servidor de salas. Reutiliza `src/core/engine` como autoridade das regras. | `src/core`                   |

`src/main.js` só inicializa: carrega o estado, liga os controladores e restaura a partida.

## Regras que o código segue

- A interface nunca altera tabuleiro, turno ou resultado: tudo passa por `GameEngine`
  (`src/core/engine/game.js`), e `state` devolve sempre uma cópia.
- Todo dado que vem de fora (armazenamento local, backup importado, link de partida, outra aba,
  servidor) passa por um validador antes de ser usado. Para partidas, o validador reexecuta o
  histórico de lances e exige que tabuleiro, turno e resultado sejam os que as regras produzem.
- Erros de domínio são `OmegaError` com um código estável; a interface traduz pelo código.
- Texto de usuário e de arquivos importados entra no DOM só como nó de texto (não há `innerHTML`).

## Fluxo de uma jogada contra a IA

1. Clique em uma casa → `ui/controllers/game.js` chama `game.play(index)`.
2. O controlador salva o estado (`state/store.js`) e redesenha (`refresh`).
3. Se é a vez da IA, envia `{ board, config, player, difficulty }` ao Web Worker
   (`services/ai-worker-client.js`).
4. O Worker roda `chooseMove` (`core/ai/engine.js`) e devolve o veredito.
5. O controlador confere se a partida não mudou enquanto a IA pensava, aplica o lance e redesenha.
6. Ao fim da partida, `features/progression.js` decide se e como ela entra no perfil.

## Comunicação entre controladores

Os controladores não se importam entre si (exceto para iniciar uma partida). Eles publicam
eventos em `services/event-bus.js`: `game:finished`, `profile:changed`, `view:changed`,
`view:request`, `language:changed`, `state:restored`, `game:leaving-online`.
