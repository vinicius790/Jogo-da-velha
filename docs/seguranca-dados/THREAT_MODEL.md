# Modelo de ameaças

Para cada ameaça: o que foi feito e o que fica como risco aceito.

## Navegador

| Ameaça                                                                   | Tratamento                                                                                                                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup ou link de partida forjado injeta HTML/script                     | Sem HTML dinâmico; CSP sem `unsafe-inline`; campos de texto saneados e limitados em tamanho.                                                                   |
| Backup forjado infla rating, conquistas ou histórico                     | **Aceito.** O perfil é local e do próprio usuário; os valores são limitados a faixas válidas, mas quem edita o próprio backup pode se dar o rating que quiser. |
| Link de partida faz o app registrar vitória no perfil de quem abre       | Partida aberta por link vira local e nunca é registrada (teste de regressão).                                                                                  |
| Estado salvo corrompido impede o app de abrir                            | Validação ao carregar; o inválido é descartado e o app começa limpo.                                                                                           |
| Outra aba do mesmo site envia estado malformado                          | Mensagens do BroadcastChannel passam pelos mesmos validadores.                                                                                                 |
| Backup cifrado com número absurdo de iterações trava o navegador         | Iterações declaradas no arquivo são limitadas a 1 000 000.                                                                                                     |
| Extensão do navegador ou outra pessoa com acesso ao aparelho lê os dados | **Fora de escopo.** Os dados locais não são cifrados em repouso.                                                                                               |

## Servidor de salas

| Ameaça                                                       | Tratamento                                                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cliente envia tabuleiro adulterado                           | O cliente não envia tabuleiro; só a casa e a revisão. O servidor aplica no próprio motor.                                                           |
| Jogar fora da vez, como espectador ou em sala alheia         | Token de sessão por participante + checagem de papel e de turno.                                                                                    |
| Repetir um lance antigo                                      | Número de revisão: lance com revisão velha é recusado.                                                                                              |
| Página de outro site abre WebSocket pelo navegador da vítima | Checagem do cabeçalho `Origin` no handshake.                                                                                                        |
| Inundação de mensagens ou de conexões                        | Limites por IP e tamanho máximo de mensagem. Protege contra abuso simples, não contra ataque distribuído.                                           |
| Criar salas até esgotar a memória                            | Limite de salas e expiração por inatividade.                                                                                                        |
| Adivinhar o código de uma sala                               | **Parcial.** 32⁶ ≈ 1 bilhão de códigos e limite de mensagens por IP; quem acerta só consegue assistir ou ocupar a vaga livre. Não há senha de sala. |
| Roubar o lugar de um jogador                                 | Exige o token (192 bits aleatórios), que só o próprio jogador recebe.                                                                               |
| Escuta ou alteração do tráfego                               | **Depende da implantação.** O servidor fala `ws://`; use um proxy com TLS para `wss://`.                                                            |
| Cliente fora do navegador forja o `Origin`                   | **Aceito.** A checagem de origem protege usuários de navegador, não autentica clientes.                                                             |

## Cadeia de dependências

- Produção: só `ws`, no servidor. Front-end sem dependências de terceiros.
- Versões fixas no `package.json` e hashes no `package-lock.json`; o CI usa `npm ci`.
- Dependabot configurado para npm e para as GitHub Actions.
- Não foi feita auditoria manual do código das dependências.
