# Orientações para agentes de código

Projeto: OMEGA Tic-Tac-Toe — JavaScript puro (módulos ES), Vite, testes com `node --test`.

## Comandos

```bash
npm ci
npm run check   # lint + formato + testes + build + verificação do build
npm run e2e     # Playwright (use PW_CHANNEL=msedge ou chrome para um navegador instalado)
```

## Regras

- Mantenha as regras do jogo puras e determinísticas, em `src/core`, sem acesso a DOM.
- Toda IA nova respeita o contrato de `chooseMove` e nunca devolve casa ocupada.
- Estado importado (arquivo, link, outra aba, rede) é entrada não confiável: passe pelos
  validadores.
- Não use `innerHTML`. Não escreva texto de interface fora dos dicionários de i18n.
- Buscas longas rodam no Web Worker (`runTask`).
- Não exiba métricas que não foram medidas e não documente o que o código não faz.
- A versão vem só do `package.json`.
- Correção de defeito exige teste de regressão.

Detalhes em [CONTRIBUTING.md](CONTRIBUTING.md) e [docs/INDICE.md](docs/INDICE.md).
