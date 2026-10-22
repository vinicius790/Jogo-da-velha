# Resiliência dos dados

O que acontece em cada cenário de falha. Para o funcionamento normal, veja
[PERSISTENCE.md](PERSISTENCE.md).

| Cenário                                        | Comportamento                                                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Página fechada no meio da partida              | A partida foi gravada no último lance; ao reabrir, é retomada (modos contra a IA e local).                                 |
| Página fechada enquanto a IA pensava           | Ao reabrir é a vez da IA e ela joga de novo.                                                                               |
| IndexedDB indisponível                         | Leitura e gravação usam o espelho em localStorage.                                                                         |
| IndexedDB e localStorage indisponíveis         | O app funciona só em memória; nada sobrevive ao fechar. Não há aviso na tela.                                              |
| Cota de armazenamento cheia                    | A gravação falha em silêncio naquela camada; o estado em memória segue correto.                                            |
| Dado salvo corrompido ou adulterado            | O item inválido é descartado ao carregar (perfil volta ao padrão campo a campo; partida, replay ou torneio inválido some). |
| Usuário limpa os dados do site                 | Perde tudo. A única proteção é o backup exportado.                                                                         |
| Atualização do app com formato de dados antigo | Validadores preenchem campos novos com o padrão e migram o histórico antigo.                                               |
| Conexão cai durante partida online             | O cliente tenta reconectar 5 vezes e retoma com o token; o servidor guarda o lugar.                                        |
| Servidor de salas reinicia                     | As salas se perdem; a partida online não pode ser retomada.                                                                |
| Sem rede (modos locais)                        | Nenhum efeito: tudo roda no aparelho e o app abre pelo cache do service worker.                                            |

## Backup

O usuário exporta manualmente (botões "Exportar" e "Backup com senha" no painel Histórico). O
arquivo contém perfil, partida em andamento, replays, torneios e puzzles resolvidos. Importar
**substitui** o estado atual — não há mesclagem.

## Fragilidades conhecidas

- Não há backup automático nem sincronização entre aparelhos.
- A falha de gravação é silenciosa: o usuário só descobre ao reabrir o app.
- Com duas abas jogando ao mesmo tempo, a partida retomada depois é a da aba que gravou por último.
