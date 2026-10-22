# Solução exata do 3×3

Arquivo: `src/core/ai/tablebase3x3.js`.

`probe3x3(board, player)` resolve o jogo da velha clássico 3×3 por busca completa com memorização.
Para a posição e o jogador da vez devolve:

- `outcome`: `1` (vence), `0` (empata) ou `-1` (perde), com jogo perfeito dos dois lados;
- `distance`: número de lances até o fim com jogo perfeito;
- `moves`: **todos** os lances ótimos — a vitória mais rápida, a derrota mais demorada ou qualquer
  lance que mantém o empate;
- `move`: o primeiro de `moves`.

As posições são resolvidas sob demanda e ficam em memória durante a vida do processo (o jogo tem
poucos milhares de posições alcançáveis). Entrada que não é um tabuleiro 3×3 válido devolve `null`.

## Onde é usada

- **IA**: Especialista e OMEGA, no 3×3 clássico, sorteiam entre `moves`. Por isso jogam perfeito
  sem repetir sempre a mesma abertura. Os outros níveis usam alpha-beta limitado mais o erro
  deliberado.
- **Painel "Leitura da posição"**: mostra o resultado exato da posição atual ("com jogo perfeito,
  quem tem a vez vence em N lances").

Não se aplica a Misère, Gravity nem a outros tamanhos. Nesses casos o resultado só é exato quando
a busca alpha-beta alcança o fim do jogo.

## Verificação

`tests/ai.test.mjs` confere: o tabuleiro vazio é empate com os nove lances ótimos; depois de X no
canto só o centro salva O; e, em 120 partidas, o Especialista não perde nenhuma.
