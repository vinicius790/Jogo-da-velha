# Operação do servidor de salas

## Rodar

```bash
npm ci --omit=dev      # o servidor só precisa do pacote `ws`
npm run server         # node server/server.mjs
```

Saída esperada: `OMEGA multiplayer ouvindo na porta 8787 (origens: …)`.

O servidor lê variáveis de ambiente; ele não carrega `.env` sozinho. Para usar um arquivo:

```bash
node --env-file=.env server/server.mjs
```

## Variáveis de ambiente

| Variável                       | Padrão                                        | Significado                                                                   |
| ------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `OMEGA_SERVER_PORT`            | `8787`                                        | porta HTTP e WebSocket                                                        |
| `OMEGA_CORS_ORIGIN`            | `http://localhost:4173,http://127.0.0.1:4173` | origens autorizadas, separadas por vírgula; `*` libera todas                  |
| `OMEGA_ROOM_LIMIT`             | `32`                                          | participantes por sala (2 jogadores + espectadores)                           |
| `OMEGA_MAX_ROOMS`              | `500`                                         | salas simultâneas                                                             |
| `OMEGA_ROOM_TTL_MS`            | `10800000`                                    | vida de uma sala sem atividade (3 h)                                          |
| `OMEGA_RATE_LIMIT`             | `40`                                          | mensagens por segundo por IP                                                  |
| `OMEGA_MAX_CONNECTIONS_PER_IP` | `16`                                          | conexões simultâneas por IP                                                   |
| `OMEGA_MAX_ROOMS_PER_IP`       | `8`                                           | salas abertas criadas pelo mesmo IP                                           |
| `OMEGA_TRUST_PROXY`            | `0`                                           | `1` = usar o último endereço de `X-Forwarded-For` (o que o proxy acrescentou) |

## Publicar para outras pessoas

1. Coloque o servidor atrás de um proxy com TLS, para que o app use `wss://`. Uma página servida
   por HTTPS não consegue abrir `ws://` (conteúdo misto).
2. Defina `OMEGA_CORS_ORIGIN` com a origem exata do front-end (por exemplo
   `https://usuario.github.io`).
3. Se houver proxy, defina `OMEGA_TRUST_PROXY=1`; sem isso todos os clientes parecem vir do mesmo
   IP e dividem os mesmos limites.
4. No app, o endereço do servidor é digitado no campo "Servidor WebSocket" do modo Online.

## Verificar

```bash
curl http://localhost:8787/health
# {"service":"omega-tictactoe","status":"ok","rooms":0,"connections":0}
```

## Comportamento a conhecer

- Reiniciar o servidor apaga todas as salas (estado só em memória).
- Encerrar com Ctrl+C derruba as conexões; os clientes tentam reconectar por alguns segundos e
  depois desistem.
- O único log é a linha de inicialização.
