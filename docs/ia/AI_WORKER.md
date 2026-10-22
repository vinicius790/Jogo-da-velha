# Web Worker da IA

Arquivos: `src/workers/ai.worker.js`, `src/workers/tasks.js`, `src/services/ai-worker-client.js`.

## Por que

Uma busca pode levar até 1,1 s (nível OMEGA) e uma simulação de arena, minutos. Na thread
principal isso congelaria a página. Até a versão 11 o Worker só era usado em tabuleiros 5×5 ou
maiores; agora é usado sempre.

## Protocolo

```text
página → worker:  { id, task, payload }
worker → página:  { id, result }   ou   { id, error }
```

`id` é um contador: cada resposta resolve exatamente a promessa do pedido correspondente.

Tarefas (`TASKS` em `tasks.js`):

| Tarefa  | Função           | Usada por                                     |
| ------- | ---------------- | --------------------------------------------- |
| `move`  | `chooseMove`     | lance da IA, dica, análise, modo IA × IA      |
| `lab`   | `compareEngines` | laboratório de motores                        |
| `arena` | `playArena`      | arena IA × IA e partidas simuladas de torneio |
| `grade` | `gradeReplay`    | estudo de replays                             |

## Uso

```js
import { runTask, cancelTasks } from './services/ai-worker-client.js';

const verdict = await runTask('move', { board, config, player, difficulty });
```

- O payload é copiado (structured clone), então não leva funções: dentro do Worker a IA usa
  `Math.random`.
- `cancelTasks()` encerra o Worker e rejeita os pedidos pendentes com o erro `cancelled` (usado
  pelo botão "Parar" da arena). O próximo `runTask` cria um Worker novo.
- Se o Worker falhar, os pedidos pendentes são rejeitados e ele é recriado na chamada seguinte.
- Sem suporte a `Worker`, `runTask` executa a mesma função na thread principal.

## Respostas atrasadas

Enquanto a IA pensa, o usuário pode começar outra partida. Ao receber o veredito, o controlador
(`requestMove` em `src/ui/controllers/game.js`) confere se a partida e o número de lances ainda
são os mesmos; se não, descarta a resposta.

## Build

O Vite empacota o Worker como módulo ES separado (`dist/assets/ai.worker-<hash>.js`), que entra
na lista de precache do service worker — a IA funciona offline.
