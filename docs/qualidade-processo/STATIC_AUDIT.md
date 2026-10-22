# Auditorias estáticas

Scripts pequenos em `scripts/`, sem dependências (usam só Node). Servem para uma checagem rápida
antes mesmo do `npm ci`; as verificações completas são o ESLint e os testes.

| Comando                  | Script               | O que verifica                                                                                                                    |
| ------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npm run audit`          | `static-audit.mjs`   | imports relativos que não resolvem; ids usados no código e ausentes no `index.html`; uso de `innerHTML`, `eval` ou `new Function` |
| `npm run ui-audit`       | `ui-audit.mjs`       | no `index.html`: ids duplicados, botões sem nome, manipuladores inline, campos sem rótulo, imagens sem `alt`                      |
| `npm run syntax`         | `syntax-check.mjs`   | `node --check` em todos os arquivos de `src`, `server` e `scripts`                                                                |
| `npm run smoke`          | `smoke.mjs`          | joga uma partida IA × IA completa pela API pública e valida o estado final                                                        |
| `npm run doctor`         | `doctor.mjs`         | versão do Node e se as dependências instaladas batem com o `package.json`                                                         |
| `npm run verify-build`   | `verify-build.mjs`   | depois do build: precache do service worker preenchido e apontando para arquivos que existem; caminhos relativos                  |
| `npm run sbom`           | `sbom.mjs`           | gera `sbom.cdx.json` (CycloneDX 1.5) a partir do `package-lock.json`                                                              |
| `npm run release-report` | `release-report.mjs` | gera `release-manifest.json` com tamanho e SHA-256 de cada arquivo do repositório                                                 |
| `npm run benchmark`      | `benchmark.mjs`      | arena de força entre os níveis da IA                                                                                              |

Todos saem com código diferente de zero quando encontram problema.

## Relação com os testes

`tests/platform.test.mjs` repete, de forma mais rigorosa, as checagens de ids, rótulos e APIs
proibidas, e acrescenta as de i18n, versão e dependências. Os scripts existem para uso avulso na
linha de comando.

## ESLint e Prettier

- `npm run lint`: regras recomendadas do ESLint mais `eqeqeq`, `no-var`, `prefer-const` e
  variáveis não usadas como erro.
- `npm run format:check`: todo o repositório segue o Prettier (aspas simples, 100 colunas).

## Sobre o SBOM

`sbom.cdx.json` lista todos os pacotes do lockfile, inclusive os opcionais de outras plataformas.
A única dependência de produção é `ws` (escopo `required`); o restante é ferramenta de
desenvolvimento (escopo `excluded`). O arquivo deve ser regenerado quando o lockfile mudar.
