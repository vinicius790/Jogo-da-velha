# Protocolo do multiplayer

Transporte: WebSocket, mensagens JSON de até 4 096 bytes. Servidor em `server/`, cliente em
`src/services/network.js`. Formato validado por `server/protocol.mjs`.

## Cliente → servidor

| `type`     | Campos                      | Efeito                                                       |
| ---------- | --------------------------- | ------------------------------------------------------------ |
| `host`     | `config`, `name?`, `clock?` | cria uma sala; quem cria joga com X                          |
| `join`     | `code`, `name?`             | entra como segundo jogador (O)                               |
| `watch`    | `code`, `name?`             | entra como espectador                                        |
| `chat`     | `text`                      | mensagem para todos na sala (jogadores e espectadores)       |
| `moderate` | `action`, `target`          | só o dono da sala: `mute`, `unmute` ou `kick` um espectador  |
| `resume`   | `code`, `token`             | retoma uma sessão depois de reconectar                       |
| `move`     | `index`, `revision`         | joga na casa `index`, declarando a revisão que o cliente viu |
| `ping`     | —                           | servidor responde `pong`                                     |

`config` é `{ size, winLength, variant }` com os mesmos limites do jogo. `code` tem 6 caracteres
(`A–Z` sem I e O, `2–9`). `token` tem de 24 a 64 caracteres base64url. `name` é opcional, até
24 caracteres (o cliente manda o nome do perfil). `text` tem até 200 caracteres e não pode ficar
vazio depois da limpeza. `clock` é `{ moveMs, gameMs }`: cada limite é 0 (desligado) ou um inteiro
de 1 000 ms até 10 min (lance) ou 3 h (partida). `target` é o `id` público do espectador.

## Servidor → cliente

| `type`   | Campos                                                                                                       | Quando                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `room`   | `code`, `token`, `id`, `role`, `symbol`, `name`, `chat`, `snapshot`, `revision`, `serverNow`, `clockStarted` | resposta a `host`, `join`, `watch`, `resume`                      |
| `state`  | `code`, `snapshot`, `revision`, `serverNow`, `clockStarted`, `players`, `spectators`, `watchers`             | depois de cada lance, da derrota por tempo e do início do relógio |
| `peer`   | `code`, `players`, `spectators`, `watchers`                                                                  | alguém entrou, saiu, caiu, voltou ou foi moderado                 |
| `chat`   | `code`, `entry`                                                                                              | alguém da sala mandou uma mensagem                                |
| `kicked` | `code`                                                                                                       | o dono da sala expulsou quem recebe                               |
| `error`  | `code`, `message`                                                                                            | pedido recusado                                                   |
| `pong`   | `at`                                                                                                         | resposta a `ping`                                                 |

- `role`: `host`, `guest` ou `spectator`. `symbol`: `X`, `O` ou `null`. `id`: número público do
  participante na sala.
- `snapshot` é o estado completo da partida ([DATA_MODEL.md](../arquitetura/DATA_MODEL.md)), com
  `mode: 'online'`.
- `players`: lista `{ id, symbol, connected, name }`. `spectators`: quantidade. `watchers`: lista
  `{ id, name, muted }` dos espectadores (`name` é `''` para quem não informou nome).
- `chat` (na mensagem `room`): as últimas 50 mensagens da sala, para quem entra ou reconecta.
- `entry`: `{ id, role, symbol, name, text, at }`; `id` cresce a cada mensagem da sala.
- `token` é o segredo da sessão: só vai na mensagem `room`, para o próprio participante.
- `serverNow`: relógio do servidor no envio. O cliente guarda a diferença para o relógio local e
  só a usa para exibir o tempo restante.

## Relógio

Opcional, escolhido por quem cria a sala (no cliente, os mesmos seletores de tempo da partida
local). O servidor é a autoridade:

1. O relógio só começa quando o segundo jogador entra (`clockStarted` passa a `true` e todos
   recebem um `state`). Antes disso, lances são recusados com `waiting-opponent`.
2. O tempo corre no servidor também enquanto um jogador está desconectado; quem volta com
   `resume` recebe o saldo atual.
3. O servidor confere o relógio de todas as salas a cada 200 ms. Quando o tempo de quem tem a vez
   acaba, a partida termina com `endReason: 'timeout'`, a revisão sobe e todos (jogadores e
   espectadores) recebem o `state`.
4. Um lance que chega depois do tempo não é aplicado: vira a mesma derrota por tempo.

O cliente nunca decide a derrota por tempo numa partida online; só exibe o relógio.

## Chat e moderação

O servidor limpa o texto (`cleanText` em `server/protocol.mjs`): troca caracteres de controle,
de formatação invisível (como os de inversão de direção), surrogates soltos e separadores de
linha por espaço, colapsa espaços e corta no limite. O texto não é HTML; o cliente sempre o
insere como nó de texto. O chat não altera a partida nem a revisão.

- Frequência: uma mensagem a cada 400 ms por participante (`chat-too-fast`), além do limite geral
  de mensagens por segundo do IP.
- Spam: a mesma mensagem do mesmo participante (sem diferença de maiúsculas) é recusada por 30 s
  (`chat-repeated`).
- Moderação: o dono da sala (`host`) silencia (`mute`) e libera (`unmute`) espectadores, que
  passam a receber `muted` ao falar, e expulsa (`kick`): o expulso recebe `kicked`, sai da sala
  e a mesma origem (IP) não consegue voltar a assistir aquela sala (`banned`). Só espectadores
  podem ser moderados (`bad-target`); só o dono modera (`not-host`).
- No cliente, o dono vê os botões de moderação ao lado de cada espectador, e qualquer pessoa pode
  ocultar a caixa de chat.

## Códigos de erro

`bad-message`, `rate-limit`, `server-full`, `too-many-rooms`, `room-unavailable`, `room-taken`,
`room-full`, `no-session`, `spectator`, `stale-revision`, `not-your-turn`, `waiting-opponent`,
`chat-too-fast`, `chat-repeated`, `muted`, `not-host`, `bad-target`, `banned`, `game-over`,
`occupied`, `column-full`, `invalid-index`. O cliente traduz pelo código (chaves
`error.<código>`).

## Exemplo

```text
A → { "type": "host", "config": { "size": 3, "winLength": 3, "variant": "classic" }, "clock": { "moveMs": 30000, "gameMs": 0 } }
A ← { "type": "room", "code": "K7Q2MX", "token": "…", "id": 1, "role": "host", "symbol": "X", "revision": 0, "clockStarted": false, "snapshot": {…} }
B → { "type": "join", "code": "K7Q2MX" }
B ← { "type": "room", "id": 2, "role": "guest", "symbol": "O", "clockStarted": true, … }
A ← { "type": "peer", "players": [{ "id": 1, "symbol": "X", "connected": true, "name": "" }, { "id": 2, "symbol": "O", "connected": true, "name": "" }], "spectators": 0, "watchers": [] }
A ← { "type": "state", "revision": 0, "clockStarted": true, "snapshot": {…} }
A → { "type": "move", "index": 4, "revision": 0 }
A, B ← { "type": "state", "revision": 1, "snapshot": {…} }
```

## Reconexão

O cliente guarda `code`, `token`, papel e nome. Se a conexão cair, tenta de novo até 5 vezes,
com espera crescente. O jogador envia `resume`: o servidor mantém o lugar dele (marcado como
desconectado) até a sala expirar, e o relógio continua correndo. Espectadores que caem são
removidos da sala, então o cliente do espectador volta com `watch` (novo token, histórico do chat
de novo). Quem foi expulso não tenta voltar.
