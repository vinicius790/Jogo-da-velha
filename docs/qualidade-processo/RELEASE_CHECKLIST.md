# Checklist de versão

1. **Versão** — altere só o campo `version` do `package.json` e rode `npm install` para o
   `package-lock.json` acompanhar. O app, o backup e a API leem a versão dali
   (`src/core/version.js`).
2. **Changelog** — acrescente a seção `## <versão>` em `CHANGELOG.md` (um teste exige que exista).
3. **Verificação local**

   ```bash
   npm ci
   npm run check     # lint, formato, testes, build, verificação do build
   npm run e2e       # navegador real, inclui o teste offline
   ```

4. **Servidor** — `npm run server` e `curl http://localhost:8787/health`.
5. **Teste manual rápido** no build (`npm run preview`):
   - jogar uma partida contra a IA em 3×3 e outra em um tabuleiro maior;
   - exportar um backup, importar de volta;
   - abrir um link de partida em outra aba;
   - recarregar a página com a rede desligada.
6. **SBOM** — `npm run sbom` se o lockfile mudou.
7. **Documentação** — atualize `docs/qualidade-processo/VALIDATION.md` com o que foi executado e,
   se a IA mudou, refaça as medições de `docs/ia/AI_BENCHMARKS.md`.
8. **Publicação** — tag `v<versão>`; se o GitHub Pages estiver habilitado, dispare o workflow
   "Deploy Pages".

## O que o CI faz sozinho

A cada push e pull request: `ci.yml` roda lint, formato, testes, build e verificação do build em
Node 22 e 24; `e2e.yml` roda os testes de navegador com o Chromium do Playwright. Os itens 4, 5 e
8 são manuais.
