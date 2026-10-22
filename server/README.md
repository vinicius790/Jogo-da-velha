# Servidor de salas

Servidor WebSocket para as partidas online. É a autoridade do jogo: guarda o estado de cada sala
em um `GameEngine` (o mesmo motor de regras do navegador) e só aceita dos clientes a intenção de
lance.

```bash
npm run server                 # porta 8787
curl http://localhost:8787/health
```

## Arquivos

| Arquivo        | Papel                                                                            |
| -------------- | -------------------------------------------------------------------------------- |
| `server.mjs`   | HTTP + WebSocket, checagem de origem, limites por IP, difusão das mensagens      |
| `room.mjs`     | `RoomManager`: salas, participantes, lances, relógio, chat, moderação, expiração |
| `protocol.mjs` | validação do formato das mensagens                                               |

`createOmegaServer(opções)` devolve `{ listen, close, rooms, server }` e é usado pelos testes de
integração (`tests/server.test.mjs`).

## Resumo do protocolo

`host` cria a sala e recebe `role=host`, `symbol=X` e um token de sessão. `join` entra como `O`.
`watch` entra como espectador. `resume` recupera a sessão com `code + token`. `move` envia o
índice da casa e a revisão do estado observado; o servidor confere token, papel, revisão, turno e
legalidade antes de aplicar e difundir o novo estado. Com relógio (escolhido no `host`), o
servidor decide a derrota por tempo. `chat` fala com a sala; `moderate` (só o dono da sala)
silencia ou expulsa um espectador.

Documentação completa:

- [Protocolo](../docs/multiplayer-infra/MULTIPLAYER.md)
- [Modelo de autoridade e proteções](../docs/multiplayer-infra/MULTIPLAYER_AUTHORITATIVE.md)
- [Variáveis de ambiente e operação](../docs/multiplayer-infra/OPERATIONS.md)

## Limitações

Salas em memória (reiniciar apaga tudo), um único processo, sem contas de usuário, sem TLS próprio
(use um proxy para `wss://`).
