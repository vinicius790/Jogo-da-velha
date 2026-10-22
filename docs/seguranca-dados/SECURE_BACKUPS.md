# Backup cifrado por senha

Arquivo: `src/core/serialization/secure-backup.js`. Botão "Backup com senha" no painel Histórico.

## Esquema

- **Derivação da chave**: PBKDF2-SHA-256, 210 000 iterações, sal aleatório de 16 bytes.
- **Cifra**: AES-256-GCM, vetor de inicialização aleatório de 12 bytes.
- Implementação: Web Crypto (`crypto.subtle`) do navegador; nenhum código de criptografia próprio.

## Formato

```json
{
  "format": "OMEGA-ENCRYPTED-BACKUP",
  "version": 1,
  "kdf": "PBKDF2-SHA256",
  "iterations": 210000,
  "cipher": "AES-256-GCM",
  "salt": "<base64url>",
  "iv": "<base64url>",
  "ciphertext": "<base64url>"
}
```

O texto cifrado contém o mesmo `payload` do [backup simples](BACKUP_SECURITY.md).

## Propriedades

- **Sigilo**: sem a senha, o conteúdo não é legível.
- **Integridade**: o GCM autentica o conteúdo. Senha errada e arquivo adulterado produzem o mesmo
  erro ("senha incorreta ou backup adulterado") — não dá para distinguir os dois casos.
- **A senha não é guardada** em lugar nenhum. É digitada em um campo `type="password"` de um
  diálogo e descartada depois do uso. **Senha esquecida = backup perdido**; não há recuperação.

## Regras

- Senha com no mínimo 8 caracteres. Não há medidor de força: uma senha curta e previsível pode ser
  quebrada por tentativa, apesar das 210 000 iterações.
- Na importação, o número de iterações declarado no arquivo é limitado à faixa 1 000 – 1 000 000,
  para um arquivo forjado não travar o navegador.
- Depois de decifrado, o conteúdo passa pela mesma validação de qualquer importação
  (`normalizeState`).
- Exige contexto seguro (HTTPS ou `localhost`); fora disso o navegador não oferece Web Crypto e o
  app mostra um erro.

## Testes

`tests/serialization.test.mjs`: ida e volta; o conteúdo não aparece em claro no arquivo; senha
errada, texto cifrado alterado, senha curta e formato inválido são recusados.
