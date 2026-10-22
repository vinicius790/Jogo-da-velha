# Como contribuir — OMEGA Tic-Tac-Toe 🎮

Obrigado pelo seu interesse em contribuir com o **OMEGA Tic-Tac-Toe**! Este documento descreve o ambiente de desenvolvimento, regras arquiteturais, convenções de commits semânticos e o fluxo de Pull Requests.

---

## 🛠️ Ambiente de Desenvolvimento

```bash
npm ci
npm run dev
```

Requer **Node.js 22.13 ou mais novo**.

---

## 🧪 Verificações Obrigatórias Antes de Enviar

```bash
npm run check   # lint, formato, testes, build e verificação do build
npm run e2e     # se a alteração mexe na interface ou no service worker
```

`npm run format` aplica a formatação com o Prettier.

---

## 📐 Regras de Arquitetura e Código

- **Regras do jogo só em `src/core`.** Nada ali pode usar DOM, `window` ou armazenamento. A interface altera a partida apenas por `GameEngine`.
- **Dado de fora é não confiável.** O que vem de arquivo, link, outra aba ou rede passa pelos validadores (`validateSnapshot`, `normalizeState`, `validateMessage`) antes de ser usado.
- **Sem `innerHTML`.** Monte o DOM com `el()` (`src/ui/dom.js`) e `textContent`.
- **Sem texto fixo na interface.** Toda mensagem é uma chave nos três dicionários de `src/services/locales/`; os testes falham se faltar em algum idioma ou se sobrar chave sem uso.
- **Erros com código.** Erros que podem chegar ao usuário são `OmegaError(codigo, mensagem)`, com a tradução em `error.<codigo>`.
- **Busca da IA fora da thread principal.** Use `runTask` (`src/services/ai-worker-client.js`).
- **Nada de número inventado.** Métrica exibida tem de ser medida ou calculada.
- **Versão em um lugar só**: o campo `version` do `package.json`.

---

## 🧪 Testes e Documentação

- Correção de defeito vem com um teste que falharia antes da correção (nome começando por `"regressão:"`).
- Testes que dependem de sorteio usam `seededRng`. Veja [docs/qualidade-processo/TESTING.md](docs/qualidade-processo/TESTING.md).
- Se o comportamento muda, atualize o documento correspondente em `docs/` e o `CHANGELOG.md`.

---

## 📋 Padrão de Commits (Conventional Commits)

Adotamos a convenção do [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/):

```text
<tipo>(<escopo>): <descrição no imperativo>
```

### Exemplos:
- `feat(ia): aprimora poda alfa-beta no tabuleiro 5x5`
- `fix(core): corrige deteccao de vitoria na variante hexagonal`
- `docs(readme): adiciona badges e quick start em 3 passos`
- `test(engine): adiciona caso de regressao para empate no modo gravity`
- `perf(worker): reduz latencia de serializacao de estados do minimax`

---

## 🚀 Como Submeter um Pull Request (PR)

1. **Fork e Branch**:
   ```bash
   git checkout -b feat/nova-variante-ou-ia
   ```
2. **Executar Verificações**:
   ```bash
   npm run check
   ```
   Certifique-se de que a validação de lint, testes e build passem sem qualquer falha.
3. **Commit Semântico**:
   ```bash
   git commit -m "feat(ia): adiciona avaliacao posicional para variante misere"
   ```
4. **Abrir Pull Request**:
   - Detalhe a lógica implementada e garanta que testes de regressão foram incluídos se for uma correção de bug.
