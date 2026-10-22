# Internacionalização

Idiomas: português do Brasil (`pt-BR`, padrão), inglês (`en`) e espanhol (`es`). Todo texto da
interface vem dos dicionários; não há texto fixo no JavaScript.

## Como funciona

- Dicionários: `src/services/locales/pt-BR.js`, `en.js`, `es.js` — objetos planos
  `{ 'chave': 'texto com {parametro}' }`.
- `src/services/i18n.js`:
  - `t(chave, params)` devolve o texto no idioma atual, trocando `{nome}` pelos parâmetros; se a
    chave não existir no idioma atual, usa o português;
  - `setLanguage(idioma)`; idioma desconhecido cai para `pt-BR`;
  - `applyTranslations()` percorre o HTML e aplica `data-i18n` (texto do elemento),
    `data-i18n-title` (`title` + `aria-label`) e `data-i18n-label` (`aria-label`), e ajusta o
    atributo `lang` do documento;
  - `formatDate` e `formatNumber` usam o idioma atual.
- O idioma fica em `profile.settings.language`. Ao trocar, o HTML estático é retraduzido e os
  controladores redesenham o que geraram.

## Textos que nascem fora da interface

- **Erros**: o código lança `OmegaError(codigo, mensagem)`; o servidor envia `{ code, message }`.
  A interface mostra `t('error.<codigo>')` quando existe tradução, e a mensagem original como
  reserva.
- **Explicações da IA**: `chooseMove` devolve `reasons: [{ key, params }]`; a interface traduz.
- **Conquistas, níveis, variantes, modos**: as constantes guardam só os ids; os nomes são
  `ach.<id>.title`, `level.<id>` etc.

## Garantias testadas (`tests/platform.test.mjs`)

- os três dicionários têm exatamente as mesmas chaves, nenhuma vazia;
- cada texto usa os mesmos parâmetros `{x}` nos três idiomas;
- toda chave usada no HTML ou no código existe, e nenhuma chave do dicionário está sem uso.

## Adicionar um idioma

1. Copie `pt-BR.js` para `src/services/locales/<codigo>.js` e traduza os valores.
2. Registre em `dictionaries` (`src/services/i18n.js`) e em `LANGUAGES` (`src/state/profile.js`).
3. Acrescente a `<option>` em `#settings-language` no `index.html`.
4. Rode `npm test`: os testes acusam chaves ou parâmetros faltando.

## Limites

- Sem regras de plural: os textos usam formas como "{count} lances" e "jogador(es)".
- Só idiomas da esquerda para a direita foram considerados.
- As traduções para inglês e espanhol foram escritas junto com o código e não passaram por revisão
  de falantes nativos.
- A descrição no manifesto da PWA e a `meta description` ficam em português.
