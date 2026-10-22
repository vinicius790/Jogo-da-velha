# Modelo de segurança

## O que há para proteger

O app não tem contas, senhas de acesso nem dados sensíveis. O que existe:

- o perfil local (nome escolhido, histórico, ratings) e os replays — ficam só no navegador;
- a integridade do jogo: ninguém deve conseguir pôr o app, ou uma sala online, em um estado que as
  regras não permitem;
- o navegador do usuário: conteúdo vindo de fora não pode virar código executado.

## Fronteiras de confiança

Tudo o que cruza uma destas fronteiras é tratado como não confiável:

| Entrada                                      | Validação                                                |
| -------------------------------------------- | -------------------------------------------------------- |
| Armazenamento local (IndexedDB/localStorage) | `normalizeState` ao carregar                             |
| Arquivo de backup importado                  | soma ou decifragem, depois `normalizeState`              |
| Link de partida (`#share=`)                  | `decodeState` + `GameEngine.from`                        |
| Mensagem de outra aba (BroadcastChannel)     | `applySyncMessage`, mesmos validadores                   |
| Mensagem do servidor de salas                | `GameEngine.from` no snapshot                            |
| Mensagem do cliente (no servidor)            | `validateMessage` e depois as checagens de `RoomManager` |

`normalizeState` (`src/state/normalize.js`) não confia em nenhum campo: perfil saneado campo a
campo, partida reexecutada lance a lance, replays reexecutados, torneios conferidos, ids de
puzzles filtrados. O que não passa é descartado.

## Controles no navegador

- **Sem HTML dinâmico**: nenhum uso de `innerHTML`, `outerHTML`, `document.write`, `eval` ou
  `new Function` (um teste falha se aparecer). Texto entra no DOM como nó de texto.
- **Content-Security-Policy** (meta no `index.html`): `default-src 'self'`; scripts, estilos e
  workers só da própria origem, sem `unsafe-inline`; conexões só para a própria origem e para
  `ws:`/`wss:` (o endereço do servidor de salas é digitado pelo usuário).
- **Sem dependências de terceiros no navegador**: o pacote final só tem código do projeto.
- **Sem telemetria**: nada é enviado a servidor algum, exceto as mensagens do modo Online para o
  servidor que o usuário indicar.

## Controles no servidor

Veja [MULTIPLAYER_AUTHORITATIVE.md](../multiplayer-infra/MULTIPLAYER_AUTHORITATIVE.md): checagem
de origem, limites por IP, tamanho de mensagem, validação de formato, tokens de sessão.

## Segredos

O projeto não usa chaves de API nem credenciais. `.env.example` só tem configuração; `.env` está
no `.gitignore`.

## Como relatar um problema

Veja [SECURITY.md](../../SECURITY.md).
