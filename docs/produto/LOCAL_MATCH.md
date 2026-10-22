# Série local entre dois jogadores

A série local organiza partidas presenciais no mesmo aparelho em um confronto melhor de 3, 5 ou 7. O primeiro a alcançar, respectivamente, 2, 3 ou 4 vitórias vence. Um empate não dá ponto e não encerra a série; ela continua até alguém alcançar a meta.

## Revezamento e configuração

- X começa a primeira partida. Depois de cada partida concluída — inclusive empate — os jogadores trocam os símbolos. Assim, ambos alternam quem começa.
- Variante, tamanho, condição de vitória e relógio são capturados ao iniciar a série e repetidos em todas as partidas.
- O painel mostra o placar, quem joga com cada símbolo na próxima partida e os oito resultados mais recentes.
- A tela identifica o nome do jogador da vez. A interface continua usando o motor normal, então gravidade, misère, tabuleiros hexagonais, desfazer/refazer e relógio mantêm as mesmas regras das partidas locais avulsas.
- Só partidas encerradas contam. Se alguém encerrar a série ou começar outra partida no meio, o jogo interrompido não altera o placar.

## Persistência e escopo

O confronto ativo é salvo no `localStorage` deste navegador na chave `omega-local-match-v1`; se houver uma partida da série em andamento, o identificador dela é salvo junto. Ao reabrir a página, a série e uma partida local salva podem ser retomadas. O carregamento valida o formato e os contadores antes de usar os dados. Se o navegador bloquear o armazenamento, a partida continua jogável, mas a série dura só até a página ser fechada.

Os nomes são texto local de exibição, normalizados e limitados a 32 caracteres. A série não usa servidor, conta, rating, ranking, backup ou sincronização entre abas. Cada partida concluída continua sendo salva individualmente no acervo de replays pelas regras existentes.

A série é distinta dos torneios: é um confronto direto de duas pessoas com alternância de símbolo, enquanto torneios executam todos-contra-todos com participantes de IA e pontuação por partida.

## Modelo e testes

O modelo puro fica em `src/features/local-match.js`. `sanitizeLocalMatch` valida dados persistidos; `recordLocalMatchGame` aceita somente partidas locais concluídas com a configuração da série e é idempotente para o último identificador registrado. Os testes cobrem formatos, nomes, configurações, alternância, empates, conclusão, persistência validada, duplicatas e vitória por tempo — inclusive antes do primeiro lance.