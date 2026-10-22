# Servidor como autoridade

## Princípio

O estado de uma partida online existe só no servidor (`server/room.mjs`), dentro de um
`GameEngine` — o mesmo motor de regras do navegador. O cliente **nunca** envia um tabuleiro: envia
a casa em que quer jogar e a revisão do estado que estava vendo.

## Checagens de um lance

`RoomManager.move(code, token, index, baseRevision)` recusa o lance se:

1. a sala não existe ou expirou (`room-unavailable`);
2. o token não pertence à sala (`no-session`);
3. o participante é espectador (`spectator`);
4. `baseRevision` não é a revisão atual (`stale-revision`) — o cliente decidiu olhando um estado
   velho;
5. a partida já acabou (`game-over`);
6. não é a vez do símbolo daquele participante (`not-your-turn`);
7. a sala tem relógio e o segundo jogador ainda não entrou (`waiting-opponent`);
8. o motor rejeita o lance: casa ocupada, coluna cheia, índice inválido.

Só então a revisão é incrementada e o novo snapshot vai para todos na sala. Se o tempo de quem
jogou já tinha acabado, o lance não é aplicado: a partida termina por tempo e esse é o snapshot
difundido.

## Relógio

O relógio de uma sala vive no `GameEngine` do servidor (`clock` no estado). `checkClocks`, chamado
a cada 200 ms, encerra por tempo as partidas em que o saldo de quem tem a vez chegou a zero e
difunde o resultado. O cliente nunca encerra uma partida online por tempo: só exibe o relógio,
corrigindo a diferença para o horário do servidor (`serverNow`).

## No cliente

O snapshot recebido passa por `GameEngine.from` (validação completa: o histórico de lances é
reexecutado) antes de ir para a tela. Um servidor defeituoso ou malicioso não consegue pôr o
cliente em um estado impossível. Snapshots com revisão menor que a já vista são ignorados.

## Identidade

Não há contas. Ao entrar, cada participante recebe um token aleatório de 192 bits, que é o que
prova quem ele é nos lances e na retomada. O código da sala (6 caracteres) é só o convite: quem o
conhece pode entrar como segundo jogador, se a vaga estiver livre, ou assistir.

## Proteções do servidor (`server/server.mjs`)

- **Origem**: o handshake WebSocket só é aceito se o cabeçalho `Origin` estiver em
  `OMEGA_CORS_ORIGIN` (ou se a variável for `*`). Sem `Origin`, é recusado. Isso impede que uma
  página de outro site use o navegador da vítima para falar com o servidor; não impede clientes
  que não são navegadores, que podem forjar o cabeçalho.
- **Limites por IP**: conexões simultâneas (padrão 16) e mensagens por segundo somando todas as
  conexões do mesmo endereço (padrão 40) e salas abertas criadas pelo mesmo endereço (padrão 8).
  Atrás de proxy, defina `OMEGA_TRUST_PROXY=1`; vale o último endereço de `X-Forwarded-For`.
- **Tamanho**: mensagens acima de 4 096 bytes derrubam a conexão.
- **Validação de formato** antes de qualquer processamento; erros não derrubam a conexão.
- **Conexões mortas**: ping a cada 30 s; quem não responde é desconectado.
- **Salas**: limite total (padrão 500), limite de participantes por sala (padrão 32) e expiração
  por inatividade (padrão 3 h).
- **Chat**: limpeza do texto, uma mensagem a cada 400 ms por participante, recusa de mensagem
  repetida por 30 s, e moderação pelo dono da sala (silenciar e expulsar espectadores; o IP
  expulso não volta a assistir aquela sala). O IP nunca é enviado aos clientes.

## O que não existe

Autenticação de usuários, ranking online, persistência das salas (nem do chat, que guarda só as
últimas 50 mensagens em memória), denúncia de mensagens e moderação global, pareamento
automático, criptografia própria (use TLS no proxy: `wss://`).
