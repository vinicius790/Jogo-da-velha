# MCTS e o híbrido do nível OMEGA

Arquivos: `src/core/ai/mcts.js`, `monte-carlo.js` (simulações) e `ensemble.js` (híbrido).

## Onde o MCTS é usado

Só no nível **OMEGA**, fora do 3×3 clássico, e só quando o alpha-beta não decidiu a posição:

1. O alpha-beta roda com o orçamento do nível.
2. Se o resultado é exato ou forçado, ou se há um único melhor lance, fica o lance do alpha-beta.
3. Caso contrário, os lances cuja pontuação está perto da melhor (margem de 15%, no máximo 6
   lances) vão para o MCTS, que escolhe entre eles com 400 ms de simulações.

A ideia: quando a avaliação estática não distingue os melhores lances, simulações dão uma segunda
opinião. O veredito traz `algorithm: 'alpha-beta+mcts'` e o número de iterações.

O que as medições mostram ([AI_BENCHMARKS.md](AI_BENCHMARKS.md)): o OMEGA não perdeu para o
Especialista em 5×5, mas em Gravity 6×6 e em 8×8 os dois ficaram equivalentes dentro da margem das
amostras. O ganho do MCTS, quando existe, é pequeno.

## Algoritmo (`mcts`)

UCT clássico em árvore:

- **Seleção**: desce pelo filho de maior `média + c·√(ln N / n)`, com `c = 1,2`. A recompensa
  acumulada é sempre do ponto de vista do jogador da raiz; nos nós em que a vez é do adversário a
  média entra como `1 − média`, de modo que cada lado escolhe o melhor para si.
- **Expansão**: um lance ainda não tentado, sorteado.
- **Simulação** (`rollout`): até 30 lances; se não terminar, usa a avaliação estática convertida
  para [0, 1].
- **Retropropagação**: soma a recompensa em todos os nós do caminho.
- Resultado: o lance mais visitado. Limites: número de iterações e tempo.

`rootMoves` restringe a raiz a um subconjunto de lances (é assim que o híbrido usa o MCTS).

## Política de simulação

- Clássica e Gravity: vence se puder, bloqueia se precisar, senão sorteia entre os lances
  candidatos.
- Misère: sorteia entre os lances que não completam a própria linha; só completa se não houver
  alternativa.

## Correções em relação à versão 11

O MCTS existia, mas não era chamado por ninguém, e tinha três defeitos: a seleção maximizava a
recompensa da raiz em todos os níveis (tratava o adversário como cooperativo), as simulações
escolhiam sempre entre as quatro primeiras casas legais, e um filho reencontrado por transposição
era perdido. A árvore agora é simples (sem transposição) e os testes verificam que o MCTS encontra
a vitória e o bloqueio óbvios.
