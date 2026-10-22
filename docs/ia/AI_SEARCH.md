# Busca alpha-beta

Arquivos: `src/core/ai/minimax.js`, `evaluate.js`, `transposition.js`.

## Algoritmo

`alphaBeta(board, config, player, { depth, timeBudgetMs, useTable })`:

- **Minimax com poda alpha-beta**, pontuação sempre do ponto de vista de `player`.
- **Aprofundamento iterativo**: pesquisa com profundidade 1, 2, 3… até o limite do nível, o fim do
  jogo ou o estouro do tempo. Vale o resultado da última profundidade concluída.
- **Raiz com janela completa**: cada lance da raiz recebe a pontuação exata daquela profundidade
  (é o que alimenta `candidates`). Custa poda; foi uma escolha pela simplicidade.
- **Fim de jogo**: vitória vale `100000 - lances`, derrota `lances - 100000` (prefere ganhar
  rápido e perder devagar); empate vale 0. Pontuação com módulo ≥ 99000 significa resultado
  forçado. `exact: true` significa que a busca chegou ao fim do jogo.
- **Parada antecipada**: vitória forçada encontrada, ou só um lance possível.

## Tabela de transposição

Chave: tabuleiro + quem joga. Valor: `{ depth, value, flag, move }`.

`flag` diz o que `value` significa:

- `EXACT` — valor exato do nó;
- `LOWER` — houve corte beta: o valor real é **pelo menos** esse;
- `UPPER` — nenhum lance superou alpha: o valor real é **no máximo** esse.

Ao reencontrar a posição com profundidade suficiente, um `EXACT` é devolvido direto; `LOWER` e
`UPPER` só estreitam a janela. O `move` guardado é tentado primeiro (ordenação).

Até a versão 11 a tabela gravava qualquer valor como exato, inclusive os obtidos com corte, e a
busca devolvia pontuações erradas. O teste `tests/advanced.test.mjs` compara a busca com e sem
tabela em posições aleatórias de quatro configurações: as pontuações de todos os lances têm de
coincidir.

A tabela tem limite de 100 000 entradas com descarte da menos recentemente usada, e vive só
durante uma chamada de `alphaBeta`.

## Avaliação estática (`scanPosition`)

Para cada janela de `winLength` casas alinhadas ocupada por um só lado, soma um peso que cresce
com o número de peças (1, 8, 60, 450, 3200, 24000), positivo para `player` e negativo para o
adversário. Soma também um pequeno bônus por centralidade.

Na mesma varredura são coletadas as casas que completam uma linha **agora** para cada lado. Fora
do Misère, a folha usa isso como resultado certo:

- quem tem a vez e pode completar uma linha → vitória;
- quem não tem a vez mas ameaça duas casas diferentes → vitória no lance seguinte (o adversário só
  bloqueia uma).

Isso equivale a enxergar um a dois lances além da profundidade nominal em posições táticas.

## Lances considerados (`candidateMoves`)

Ordenados do centro para as bordas. Em tabuleiros com mais de 36 casas (exceto Gravity) só entram
casas a até 2 de distância de alguma peça (1 de distância em tabuleiros maiores que 8×8); com o
tabuleiro vazio, só o centro. Toda linha vencedora nasce ao lado de peças existentes, então
nenhuma ameaça imediata fica de fora, mas planos de longo alcance ficam.

## Limites

Fora do 3×3 (e de finais com poucas casas livres) a busca não chega ao fim do jogo: a qualidade
depende da avaliação heurística. Não há quiescência além da tática de um lance, nem livro de
aberturas, nem busca paralela.
