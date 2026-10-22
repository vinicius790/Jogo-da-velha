# Competição: perfil, ratings, conquistas e torneios

## Quais partidas contam para o perfil

Regra única, em `applyGameResult` (`src/features/progression.js`):

| Situação                                    | Histórico e XP | Elo / Glicko-2 | Replay salvo |
| ------------------------------------------- | -------------- | -------------- | ------------ |
| Contra a IA                                 | sim            | sim            | sim          |
| Online, como jogador                        | sim            | não            | sim          |
| Online, como espectador                     | não            | não            | não          |
| Dois jogadores no mesmo aparelho            | não            | não            | sim          |
| IA × IA                                     | não            | não            | não          |
| Partida aberta por link de compartilhamento | não            | não            | não          |
| Partida abandonada ou em andamento          | não            | não            | não          |

A mesma partida (mesmo id) nunca é registrada duas vezes. Partidas online não alteram o rating
porque o servidor não conhece o rating de ninguém.

XP: 25 por vitória, 10 por empate, 5 por derrota; a cada 100 XP sobe um nível.

## Ranking local (`src/features/ranking.js`)

Cada partida que entra no perfil também entra no quadro do seu tabuleiro, identificado por
`<tamanho>-<variante>` (ex.: `5-hex`). Cada quadro tem:

- partidas, vitórias, empates e derrotas, sequência atual e melhor sequência;
- um **Elo próprio**, que começa em 1000 e só muda em partidas contra a IA (mesma fórmula e
  mesmos ratings nominais do Elo geral);
- as **cinco melhores vitórias**: menos lances primeiro e, no empate, menos tempo.

A tabela "Ranking local" (aba Jogar, abaixo do perfil) ordena os quadros por Elo, depois por
vitórias e partidas. O ranking fica no perfil (`profile.ranking`), então vai junto no backup e
na sincronização entre abas, sempre passando por `sanitizeRanking` (chaves inválidas e campos
fora de faixa são descartados).

Vitória ou derrota por tempo conta no perfil e no ranking, inclusive quando acontece antes do
primeiro lance (quem não jogou a tempo perde). A vitória por tempo não desbloqueia **Relâmpago**
e não entra nas cinco melhores vitórias do quadro (o adversário não foi vencido em lances).

## Ratings

- **Elo** (`src/services/rating.js`): K = 24, começa em 1000.
- **Glicko-2** (`src/services/glicko2.js`): começa em 1500 ± 350, volatilidade 0,06, τ = 0,5.
  A implementação reproduz o exemplo numérico do artigo de Glickman (teste em
  `tests/edge.test.mjs`).

O adversário é o nível da IA, com rating nominal fixo (`AI_RATING` em `src/core/constants.js`):

| Nível        | Elo  | Glicko |
| ------------ | ---- | ------ |
| Fácil        | 800  | 1300   |
| Normal       | 1000 | 1500   |
| Difícil      | 1200 | 1700   |
| Especialista | 1400 | 1900   |
| OMEGA        | 1600 | 2100   |

Esses valores são convenções do projeto, não medições. O rating serve para acompanhar a própria
evolução. Atenção: o desfazer é permitido contra a IA, então o rating não é uma medida rigorosa.

## Conquistas

18 conquistas (`ACHIEVEMENTS`), avaliadas em `src/features/achievements.js`:

| Id                                  | Condição                                                    |
| ----------------------------------- | ----------------------------------------------------------- |
| `first-win`                         | vencer uma partida                                          |
| `perfect`                           | 5 partidas registradas seguidas sem derrota                 |
| `streak-3`, `streak-7`, `streak-10` | 3, 7 e 10 vitórias seguidas                                 |
| `comeback`                          | vencer depois de ter ficado a um lance da derrota           |
| `speed`                             | vencer com o mínimo de lances possível (a linha de vitória) |
| `omega`                             | vencer a IA no nível OMEGA                                  |
| `variant-master`                    | ter vitórias nas três variantes                             |
| `giant`                             | concluir uma partida no 12×12                               |
| `custom`                            | concluir uma partida fora do 3×3 clássico                   |
| `hundred`                           | 100 partidas registradas                                    |
| `offline`                           | concluir uma partida sem conexão                            |
| `puzzle`                            | resolver um puzzle                                          |
| `replay`                            | assistir a um replay até o fim                              |
| `import`                            | importar um backup                                          |
| `tournament`                        | concluir todas as partidas de um torneio                    |
| `engineer`                          | usar o laboratório de motores                               |

Observação: `omega` é inalcançável no 3×3 clássico (o nível joga a solução exata); em outros
tabuleiros é possível.

## Torneios

`src/features/tournaments.js` + `src/ui/controllers/tournaments.js`.

- Formato: pontos corridos em turno único entre você e três níveis da IA (Fácil, Normal,
  Difícil), no tabuleiro e na variante escolhidos na aba Jogar. São 6 partidas, 3 delas suas.
- Quem joga com X alterna entre os confrontos.
- **Jogar**: abre uma partida normal contra aquele nível; ao terminar, o resultado entra na tabela.
  Essas partidas contam para o perfil como qualquer partida contra a IA.
- **Simular**: as partidas IA × IA são jogadas de verdade pelo motor, no Web Worker.
- Pontuação: 3 por vitória, 1 por empate; desempate por número de vitórias.
- Com as 6 partidas concluídas aparece o campeão e sai a conquista `tournament`.
- Os torneios ficam salvos (até 20) e entram no backup.

Não há mata-mata, torneio entre humanos, nem escolha dos participantes. Se você começar outra
partida no meio de um confronto de torneio, ele continua pendente e pode ser jogado de novo.
