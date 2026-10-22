# Backup simples

Arquivo: `src/core/serialization/backup.js`. Botões "Exportar" e "Importar" no painel Histórico.

## Formato

```json
{
  "format": "OMEGA-BACKUP",
  "version": 1,
  "createdAt": "2026-10-02T12:00:00.000Z",
  "sha256": "<64 dígitos hexadecimais>",
  "payload": {
    "app": "12.1.0",
    "exportedAt": "2026-10-02T12:00:00.000Z",
    "state": { "profile": {}, "game": null, "replays": [], "tournaments": [], "puzzles": [] }
  }
}
```

`sha256` é a soma SHA-256 de `JSON.stringify(payload)`.

## Para que serve a soma

Para detectar **corrupção acidental** (arquivo truncado, editado por engano). Não é autenticação:
quem altera o conteúdo pode recalcular a soma. O backup simples é legível por qualquer pessoa com
acesso ao arquivo. Para sigilo e detecção de adulteração, use o
[backup com senha](SECURE_BACKUPS.md).

## Importação

1. O JSON é lido; se não for um backup reconhecido, a importação para com erro.
2. A soma é conferida; se não bater, a importação para ("o backup está corrompido").
3. O conteúdo passa por `restoreState` → `normalizeState`: perfil saneado, partida e replays
   reexecutados, torneios conferidos. O que for inválido é descartado; o resto é importado.
4. O estado atual é **substituído** e gravado.

A proteção real contra um arquivo malicioso é o passo 3, não a soma.

## Casos particulares

- Em página servida sem HTTPS (fora de `localhost`) o navegador não oferece Web Crypto: o backup é
  gerado com `"sha256": null` e, na importação, não há soma a conferir. A validação do passo 3
  continua valendo.
- Backups da versão 11 guardavam o estado em `payload.getState`; continuam importáveis.

## Testes

`tests/serialization.test.mjs`: a soma confere; alterar o conteúdo, o formato ou o tipo da soma
faz a verificação falhar. `tests/validator.test.mjs`: conteúdo forjado é descartado por
`normalizeState`.
