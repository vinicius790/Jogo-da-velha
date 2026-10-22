# Formato do replay e da notação

## Replay (`src/features/replay.js`)

```js
{
  id: 'game-<uuid>',          // mesmo id da partida
  createdAt: 1790000000000,
  config: { size, winLength, variant },
  mode: 'ai' | 'local' | 'online' | 'spectator',
  difficulty: 'easy' | ... | 'omega',
  result: 'X' | 'O' | 'draw' | null,   // null = partida não terminada
  endReason: null | 'timeout',         // vitória/derrota no relógio
  player: 'X' | 'O' | null,            // símbolo do humano, quando há um
  moves: [{ index, mark, turn }]
}
```

O replay **não guarda o tabuleiro**. `replayFrame(replay, n)` reexecuta os `n` primeiros lances
pelo `GameEngine`; se um lance for ilegal, a reexecução falha. `validateReplay` só aceita um replay
se todos os lances forem legais, as marcas alternarem corretamente e o resultado reexecutado for o
declarado. Em Gravity, `index` é a casa de pouso. Com `endReason: 'timeout'`, o último quadro
aplica a derrota por tempo de quem tinha a vez depois do último lance.

São guardados os 200 replays mais recentes. Entram no acervo as partidas contra a IA, locais e
online como jogador; partidas IA × IA e abertas por link não entram.

## Exportação em JSONL

O botão "Exportar acervo (.jsonl)" grava um replay por linha (`src/core/serialization/jsonl.js`):

```text
{"id":"game-…","createdAt":…,"config":{"size":3,"winLength":3,"variant":"classic"},…}
{"id":"game-…",…}
```

Não há importação de JSONL; o acervo volta por meio do backup completo.

## Notação de lances (`src/core/notation.js`)

Coordenada = letra da coluna + número da linha, com `A1` no canto superior esquerdo. Uma partida
é `MARCA+COORDENADA` separada por hífens:

```text
XA1-OB2-XB1-OC3-XC1
```

Na variante Hexagonal a notação é a mesma: a letra é a coluna `q` e o número é a linha `r` do
losango (`A1` é o hexágono do canto superior esquerdo).

`decodeMoves(notacao, config)` reconstrói a partida e rejeita turno fora de ordem ou lance ilegal.
A notação da partida fica gravada em cada entrada do histórico do perfil.

## Código de compartilhamento (`src/core/serialization/share.js`)

`OMEGA-S1.<base64url do JSON { g: estado }>`. O link do app é `…/#share=<código>`. Ao abrir, o
estado é validado por `GameEngine.from`, a partida vira local (os dois lados jogáveis) e nunca é
registrada no perfil. Códigos com o prefixo antigo `OMEGA11` continuam abrindo.
