# Acessibilidade

## O que está implementado

**Tabuleiro** (`src/ui/views/board-view.js`)

- Estrutura ARIA de grade: `role="grid"` → `role="row"` → `role="gridcell"` → `<button>`, com
  `aria-rowcount`/`aria-colcount` e nome acessível ("Tabuleiro 3 por 3").
- Cada casa tem nome por coordenada e conteúdo: "B2, vazia", "A1, X".
- Teclado: só uma casa fica na ordem de tabulação (roving tabindex); as setas movem o foco;
  Enter ou Espaço jogam.
- Casas não jogáveis usam `aria-disabled` em vez de `disabled`, para continuarem alcançáveis pelas
  setas e legíveis pelo leitor de tela.
- O foco é preservado quando o tabuleiro é redesenhado depois de um lance.

**Avisos**

- Cada lance é anunciado em uma região `aria-live="assertive"` ("X jogou em B2.").
- A vez de quem joga, o estado da sala online e o status dos puzzles/replays ficam em elementos
  `role="status"`.
- Mensagens temporárias (toasts) ficam em região `aria-live="polite"`.

**Página**

- `lang` do documento acompanha o idioma escolhido.
- Link "Pular para o conteúdo"; marcos `header`, `nav`, `main`.
- Todo campo de formulário está dentro de um `<label>` ou tem `aria-label`; botões só com ícone
  têm `aria-label` e `title`.
- Diálogos são `<dialog>` nativos abertos com `showModal()` (prendem o foco e fecham com Esc),
  com `aria-labelledby`.
- A senha do backup é pedida em campo `type="password"`, não em `prompt()`.
- Indicador de foco visível em todos os controles (`:focus-visible`).
- Menos animação: respeita `prefers-reduced-motion` e há a opção "Animações: Reduzidas".
- Vitória não depende só de cor: as casas vencedoras ganham uma borda interna e o resultado é
  escrito em texto.
- Gráficos em `<canvas>` têm `role="img"` e `aria-label`; os mesmos dados aparecem em texto ao lado.

## Verificação automática

- `tests/platform.test.mjs`: ids únicos, botões de ícone com nome, campos com rótulo, sem
  manipuladores inline, estrutura grid/row/gridcell.
- `tests/e2e/smoke.spec.js`: localiza as casas pelo nome acessível e joga pelo teclado.
- `npm run ui-audit`: checagem rápida do HTML sem dependências.

## O que NÃO foi feito

- Nenhum teste com leitor de tela real (NVDA, JAWS, VoiceOver, TalkBack).
- Nenhuma auditoria automatizada de contraste ou de WCAG (axe, Lighthouse). As cores foram
  escolhidas com contraste em mente, mas não medidas.
- Em tabuleiros grandes (10×10 ou mais) em telas pequenas, as casas ficam menores que o alvo de
  toque recomendado de 44 px.
- O gráfico de avaliação não tem alternativa tabular lance a lance.
