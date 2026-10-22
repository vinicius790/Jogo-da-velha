# Persistência

Arquivos: `src/state/store.js`, `storage.js`, `indexeddb.js`, `normalize.js`, `profile.js`.

## Camadas

`storage` grava cada chave em três lugares, nesta ordem de preferência na leitura:

1. **IndexedDB** — banco `omega-ttt`, armazém `kv`;
2. **localStorage** — chave `omega-ttt:<nome>`, valor em JSON (espelho);
3. **memória** — para ambientes sem nenhum dos dois (modo privado restrito, Node nos testes).

Uma falha em uma camada (cota, bloqueio, API ausente) é ignorada e a operação segue nas outras.

## O que é gravado e quando

| Dado                 | Quando                                                        |
| -------------------- | ------------------------------------------------------------- |
| Partida em andamento | a cada lance (modos contra a IA e local) e ao ocultar a aba   |
| Perfil               | fim de partida registrada, conquista, mudança de configuração |
| Replays              | fim de partida (até 200, os mais recentes)                    |
| Torneios             | criação e cada resultado (até 20)                             |
| Puzzles resolvidos   | ao resolver (até 500 ids)                                     |

Ao terminar, a partida ativa é apagada do armazenamento (o que fica é o replay). Partidas online e
IA × IA não são retomadas ao reabrir: dependem de uma sessão viva.

## Carregamento

`loadStore()` lê as cinco chaves e passa tudo por `normalizeState`: o que estiver corrompido ou
adulterado é descartado em vez de quebrar o app. Uma partida salva só é retomada se o histórico de
lances reproduzir exatamente o tabuleiro, o turno e o status gravados.

## Entre abas

Com duas abas abertas, alterações de perfil, replays, torneios e puzzles são avisadas pelo
`BroadcastChannel` (`omega-ttt-sync`) e a outra aba atualiza o painel. A partida em andamento
**não** é sincronizada: cada aba joga a sua, e a última a gravar define o que será retomado.

## Migração

- Histórico do perfil sem o campo `outcome` (versões anteriores à 12) é convertido ao carregar.
- Backups antigos, com o estado no campo `getState`, continuam importáveis.
- Não há número de versão de esquema: a compatibilidade é garantida pelos validadores, que
  preenchem o que falta com os valores padrão.
