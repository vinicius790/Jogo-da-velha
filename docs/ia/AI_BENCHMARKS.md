# Medições da IA

Resultados de `npm run benchmark` (script `scripts/benchmark.mjs`), executado em 1º e 2 de outubro
de 2026 em um notebook com Windows 11 e Node 24.16. Cada par de níveis joga N partidas com cada
cor (X sempre começa). Formato: **vitórias – derrotas – empates** do nível citado primeiro.

Como a busca tem orçamento de tempo, os números de tabuleiros grandes variam com a máquina e com
a carga do sistema. As amostras de tabuleiros grandes são pequenas (cada partida leva de segundos
a minutos): servem para indicar tendência, não para afirmar diferenças finas.

## 3×3 clássico — 100 partidas por cor (200 por par)

| Confronto              | Resultado    |
| ---------------------- | ------------ |
| Normal × Fácil         | 96 – 19 – 85 |
| Difícil × Fácil        | 100 – 8 – 92 |
| Especialista × Fácil   | 104 – 0 – 96 |
| OMEGA × Fácil          | 97 – 0 – 103 |
| Difícil × Normal       | 29 – 8 – 163 |
| Especialista × Normal  | 24 – 0 – 176 |
| OMEGA × Normal         | 26 – 0 – 174 |
| Especialista × Difícil | 9 – 0 – 191  |
| OMEGA × Difícil        | 10 – 0 – 190 |
| OMEGA × Especialista   | 0 – 0 – 200  |

Leitura: a ordem Fácil < Normal < Difícil < Especialista é clara. Especialista e OMEGA jogam a
solução exata e não perderam nenhuma partida; entre si, só empatam.
Tempo por lance: abaixo de 3 ms em média.

## 5×5, vitória com 4, clássica

| Confronto              | Partidas por cor | Resultado  |
| ---------------------- | ---------------- | ---------- |
| Normal × Fácil         | 8                | 14 – 0 – 2 |
| Difícil × Fácil        | 8                | 15 – 0 – 1 |
| Difícil × Normal       | 8                | 8 – 7 – 1  |
| Especialista × Difícil | 6                | 6 – 6 – 0  |
| OMEGA × Difícil        | 6                | 6 – 3 – 3  |
| OMEGA × Especialista   | 6                | 4 – 0 – 8  |

Leitura: todos vencem o Fácil com folga. Entre Normal, Difícil e Especialista os resultados ficam
divididos — nessas partidas quem começa (X) quase sempre vence, e isso pesa mais do que a
diferença de nível. O OMEGA foi o único que não perdeu para o Especialista.

## 8×8, vitória com 5, clássica — 4 partidas por cor

| Confronto              | Resultado |
| ---------------------- | --------- |
| Especialista × Difícil | 6 – 1 – 1 |
| OMEGA × Difícil        | 2 – 0 – 6 |
| OMEGA × Especialista   | 0 – 1 – 7 |

## 6×6, vitória com 4, Gravity — 6 partidas por cor

| Confronto              | Resultado  |
| ---------------------- | ---------- |
| Especialista × Difícil | 11 – 1 – 0 |
| OMEGA × Difícil        | 11 – 1 – 0 |
| OMEGA × Especialista   | 4 – 3 – 5  |

## 4×4, vitória com 4, Misère — 6 partidas por cor

| Confronto              | Resultado  |
| ---------------------- | ---------- |
| Difícil × Normal       | 0 – 1 – 11 |
| Especialista × Normal  | 2 – 0 – 10 |
| OMEGA × Normal         | 3 – 0 – 9  |
| Especialista × Difícil | 6 – 0 – 6  |
| OMEGA × Difícil        | 1 – 0 – 11 |
| OMEGA × Especialista   | 2 – 0 – 10 |

## Tempo por lance (média / p95)

| Tabuleiro    | Difícil       | Especialista   | OMEGA           |
| ------------ | ------------- | -------------- | --------------- |
| 5×5 clássica | ≈ 80 / 320 ms | ≈ 270 / 670 ms | ≈ 460 / 1120 ms |
| 8×8 clássica | —             | ≈ 400 / 770 ms | ≈ 600 / 1110 ms |
| 6×6 Gravity  | —             | ≈ 66 / 300 ms  | ≈ 260 / 1110 ms |

(Valores medidos nos confrontos acima; cada célula mistura os dois níveis do par, então são
aproximações. O p95 encosta no teto de tempo do nível.)

## Conclusões

- Especialista e OMEGA são claramente mais fortes que Difícil em Gravity e em 8×8, e nunca perdem
  no 3×3.
- OMEGA e Especialista são equivalentes dentro do que estas amostras permitem afirmar; o
  desempate por MCTS não mostrou ganho consistente.
- Em 5×5 a vantagem de quem começa domina os confrontos entre níveis vizinhos.

## Como reproduzir

```bash
npm run benchmark -- 3 3 classic 100
npm run benchmark -- 5 4 classic 6 hard,expert,omega
npm run benchmark -- 6 4 gravity 6 hard,expert,omega
```

Argumentos: tamanho, linha de vitória, variante, partidas por cor, níveis (opcional).
A mesma simulação está na aba Análise do app (Arena IA × IA).
