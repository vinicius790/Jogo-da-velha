import { expect, test } from '@playwright/test';
import { createOmegaServer } from '../../server/server.mjs';

const cell = (page, name) => page.getByRole('button', { name: new RegExp(`^${name},`) });

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.goto('/');
});

test('a página carrega com um tabuleiro jogável', async ({ page }) => {
  await expect(page).toHaveTitle('OMEGA Tic-Tac-Toe');
  await expect(page.locator('#board')).toHaveAttribute('role', 'grid');
  await expect(page.locator('#board [role="row"]')).toHaveCount(3);
  await expect(page.locator('#board [role="gridcell"]')).toHaveCount(9);
  await expect(page.locator('#turn')).toHaveText('Sua vez (X)');
});

test('jogar contra a IA: o lance aparece e a IA responde pelo Web Worker', async ({ page }) => {
  await cell(page, 'B2').click();
  await expect(cell(page, 'B2')).toHaveText('X');
  await expect(page.locator('#board .mark-o')).toHaveCount(1);
  await expect(page.locator('#moves')).toHaveText('2 lances');
  await expect(page.locator('#engine-info')).not.toHaveText('—');
});

test('desfazer e refazer contra a IA', async ({ page }) => {
  await cell(page, 'A1').click();
  await expect(page.locator('#board .mark-o')).toHaveCount(1);
  await page.locator('#undo').click();
  await expect(page.locator('#moves')).toHaveText('0 lances');
  await page.locator('#redo').click();
  await expect(page.locator('#moves')).toHaveText('2 lances');
});

test('jogando com O, a IA abre a partida', async ({ page }) => {
  await page.locator('#symbol').selectOption('O');
  await page.locator('#start').click();
  await expect(page.locator('#board .mark-x')).toHaveCount(1);
  await expect(page.locator('#turn')).toHaveText('Sua vez (O)');
});

test('a partida em andamento é retomada ao recarregar a página', async ({ page }) => {
  await cell(page, 'C3').click();
  await expect(page.locator('#moves')).toHaveText('2 lances');
  await page.reload();
  await expect(page.locator('#moves')).toHaveText('2 lances');
  await expect(cell(page, 'C3')).toHaveText('X');
});

test('partida local até a vitória não altera o perfil', async ({ page }) => {
  await page.locator('#mode').selectOption('local');
  await page.locator('#start').click();
  for (const name of ['A1', 'A2', 'B1', 'B2', 'C1']) await cell(page, name).click();
  await expect(page.locator('#result-title')).toHaveText('Vitória de X');
  await expect(page.locator('#result-detail')).toContainText('não contabilizada');
  await page.locator('#close-result').click();
  await expect(page.locator('#played')).toHaveText('0');
  await expect(page.locator('#board .winner')).toHaveCount(3);
});

test('teclado: setas movem o foco e Enter joga', async ({ page }) => {
  await page.locator('#mode').selectOption('local');
  await page.locator('#start').click();
  await cell(page, 'A1').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(cell(page, 'B2')).toHaveText('X');
});

test('troca de idioma traduz a interface', async ({ page }) => {
  await page.locator('#settings-button').click();
  await page.locator('#settings-language').selectOption('en');
  await page.locator('#settings-dialog button[value="save"]').click();
  await expect(page.locator('#start')).toHaveText('New game');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#turn')).toHaveText('Your turn (X)');
});

test('puzzle diário abre com tabuleiro (antes quebrava com TypeError)', async ({ page }) => {
  await page.getByRole('button', { name: 'Puzzles' }).click();
  await page.locator('#daily-challenge').click();
  await expect(page.locator('#puzzle-board [role="gridcell"]').first()).toBeVisible();
  await expect(page.locator('#puzzle-status')).toContainText('Desafio de');
});

test('torneio: criar, simular uma partida IA × IA e ver o resultado', async ({ page }) => {
  await page.getByRole('button', { name: 'Torneios' }).click();
  await page.locator('#create-tournament').click();
  await expect(page.locator('.match-row')).toHaveCount(6);
  await page.getByRole('button', { name: 'Simular' }).first().click();
  await expect(page.locator('.match-row .badge')).toHaveCount(1);
});

test('arena: simula exatamente 100 partidas com progresso', async ({ page }) => {
  await page.getByRole('button', { name: 'Análise' }).click();
  await page.locator('#arena-run').click();
  await expect(page.locator('#arena-results')).toContainText('100/100', { timeout: 20_000 });
});

test('hexagonal até a vitória e análise pós-jogo pelo diálogo de resultado', async ({ page }) => {
  await page.locator('#mode').selectOption('local');
  await page.locator('#size').selectOption('4');
  await page.locator('#win').selectOption('3');
  await page.locator('#variant').selectOption('hex');
  await page.locator('#start').click();
  await expect(page.locator('#board')).toHaveClass(/\bhex\b/);
  // C1, B2, A3: antidiagonal, casas vizinhas no hexágono.
  for (const name of ['C1', 'A1', 'B2', 'B1', 'A3']) await cell(page, name).click();
  await expect(page.locator('#result-title')).toHaveText('Vitória de X');
  await page.locator('#review-game').click();
  await expect(page.locator('[data-view-panel="replays"]').first()).toBeVisible();
  await expect(page.locator('#replay-board')).toHaveClass(/\bhex\b/);
  await expect(page.locator('#review-next-mistake')).toBeEnabled({ timeout: 15_000 });
  // Posição inicial da análise: o primeiro lance (X em C1), com nota e alternativas.
  await expect(page.locator('#review-detail')).toContainText('C1');
  await expect(page.locator('#review-detail ol li')).not.toHaveCount(0);
});

test('relógio: deixar o tempo do lance acabar antes de jogar perde e entra no ranking', async ({
  page,
}) => {
  await page.locator('#clock-move').selectOption('5000');
  await page.locator('#start').click();
  await expect(page.locator('#clock-x')).toBeVisible();
  await expect(page.locator('#clock-x')).toContainText('X');
  // Nenhum lance: a derrota no relógio conta mesmo assim.
  await expect(page.locator('#result-title')).toHaveText('Tempo esgotado: vitória de O', {
    timeout: 10_000,
  });
  await page.locator('#close-result').click();
  await expect(page.locator('#played')).toHaveText('1');
  await expect(page.locator('#ranking tr')).toHaveCount(1);
  await expect(page.locator('#ranking')).toContainText('3×3');
  await expect(page.locator('#ranking')).toContainText('0-0-1');
});

test('puzzle hexagonal: tabuleiro de hexágonos e um lance vencedor resolve', async ({ page }) => {
  await page.getByRole('button', { name: 'Puzzles' }).click();
  const option = page.locator('#puzzle-size option', { hasText: 'Hexagonal' }).first();
  const hexValue = await option.getAttribute('value');
  // Regressão: o tamanho da casa vinha de um cálculo circular e às vezes caía para 2 px.
  for (const value of ['4', '5', '6', hexValue]) {
    await page.locator('#puzzle-size').selectOption(value);
    await page.locator('#new-puzzle').click();
    await expect(page.locator('#puzzle-board')).toHaveClass(/\bhex\b/);
    const widths = await page
      .locator('#puzzle-board button.cell')
      .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));
    expect(Math.min(...widths), `opção ${value}`).toBeGreaterThan(20);
  }
  // Tenta as casas vazias até achar a resposta. Cada tentativa termina com um aviso (erro ou
  // acerto); só depois dele o estado do puzzle é lido.
  const empty = page.locator('#puzzle-board button.cell:not([class*="mark-"])');
  const total = await empty.count();
  for (let i = 0; i < total; i += 1) {
    const answered = page.evaluate(
      () =>
        new Promise((resolve) => {
          const observer = new MutationObserver((changes) => {
            if (!changes.some((change) => change.addedNodes.length)) return;
            observer.disconnect();
            resolve();
          });
          observer.observe(document.querySelector('#toast'), { childList: true });
        }),
    );
    await empty.nth(i).click();
    await answered;
    if ((await page.locator('#puzzle-status').textContent()).includes('Resolvido')) break;
  }
  await expect(page.locator('#puzzle-status')).toContainText('Resolvido');
  await expect(page.locator('#puzzle-board .winner')).not.toHaveCount(0);
});

/** Servidor de salas real numa porta livre e um segundo navegador (outro contexto). */
async function onlineSetup(browser) {
  const app = createOmegaServer({ corsOrigin: 'http://127.0.0.1:4173' });
  const port = await app.listen(0);
  const contexts = [];
  return {
    enter: async (target) => {
      await target.locator('#mode').selectOption('online');
      await target.locator('#server-url').fill(`ws://127.0.0.1:${port}`);
    },
    open: async () => {
      const context = await browser.newContext();
      contexts.push(context);
      const other = await context.newPage();
      await other.goto('/');
      return other;
    },
    close: async () => {
      await Promise.all(contexts.map((context) => context.close()));
      await app.close();
    },
  };
}

test('sala online: espectador conversa no chat; o dono silencia e expulsa; chat pode ser ocultado', async ({
  page,
  browser,
}) => {
  const online = await onlineSetup(browser);
  try {
    await online.enter(page);
    await page.locator('#host-room').click();
    await expect(page.locator('#room-input')).toHaveValue(/^[A-Z2-9]{6}$/);
    const code = await page.locator('#room-input').inputValue();

    const watcher = await online.open();
    await online.enter(watcher);
    await watcher.locator('#room-input').fill(code);
    await watcher.locator('#watch-room').click();
    await expect(watcher.locator('#chat-box')).toBeVisible();
    await expect(page.locator('#room-people')).toContainText('Omega Player');

    await watcher.locator('#chat-input').fill('<b>boa sorte</b>');
    await watcher.locator('#chat-send').click();
    for (const target of [page, watcher]) {
      await expect(target.locator('#chat-log li')).toHaveCount(1);
      await expect(target.locator('#chat-log p')).toHaveText('<b>boa sorte</b>');
    }
    await expect(page.locator('#chat-log b')).toHaveCount(0);

    // Spam: a mesma mensagem logo em seguida é recusada.
    await watcher.waitForTimeout(500);
    await watcher.locator('#chat-input').fill('<B>boa sorte</B>');
    await watcher.locator('#chat-send').click();
    await expect(watcher.locator('#toast')).toContainText('Mensagem repetida');

    // Só o dono vê os botões de moderação.
    await expect(watcher.locator('[data-moderate]')).toHaveCount(0);
    await page.locator('[data-moderate="mute"]').click();
    await expect(page.locator('#room-people')).toContainText('(silenciado)');
    await watcher.locator('#chat-input').fill('ainda posso falar?');
    await watcher.locator('#chat-send').click();
    await expect(watcher.locator('#toast')).toContainText('silenciado');
    await expect(page.locator('#chat-log li')).toHaveCount(1);

    // Ocultar e mostrar o chat.
    await page.locator('#chat-toggle').click();
    await expect(page.locator('#chat-body')).toBeHidden();
    await expect(page.locator('#chat-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#chat-toggle [data-i18n="chat.show"]')).toBeVisible();
    await expect(page.locator('#chat-toggle [data-i18n="chat.hide"]')).toBeHidden();
    await page.locator('#chat-toggle').click();
    await expect(page.locator('#chat-body')).toBeVisible();

    await page.locator('[data-moderate="kick"]').click();
    await expect(watcher.locator('#room-status')).toHaveText(
      'Você foi removido da sala por quem a criou.',
    );
    await expect(watcher.locator('#chat-box')).toBeHidden();
    await expect(page.locator('#room-people')).not.toContainText('(silenciado)');
    await watcher.locator('#watch-room').click();
    await expect(watcher.locator('#toast')).toContainText('não pode voltar a assistir');
  } finally {
    await online.close();
  }
});

test('relógio online: começa quando o O entra e o servidor dá a derrota por tempo a todos', async ({
  page,
  browser,
}) => {
  const online = await onlineSetup(browser);
  try {
    await online.enter(page);
    await page.locator('#clock-move').selectOption('5000');
    await page.locator('#host-room').click();
    await expect(page.locator('#room-input')).toHaveValue(/^[A-Z2-9]{6}$/);
    const code = await page.locator('#room-input').inputValue();
    // Sozinho na sala, o relógio fica parado no limite.
    await expect(page.locator('#clock-x')).toContainText('00:05');
    await page.waitForTimeout(1500);
    await expect(page.locator('#clock-x')).toContainText('00:05');
    await cell(page, 'B2').click();
    await expect(page.locator('#toast')).toContainText('Aguarde o segundo jogador');

    const guest = await online.open();
    await online.enter(guest);
    await guest.locator('#room-input').fill(code);
    await guest.locator('#join-room').click();
    const watcher = await online.open();
    await online.enter(watcher);
    await watcher.locator('#room-input').fill(code);
    await watcher.locator('#watch-room').click();
    await expect(watcher.locator('#clock-x')).toBeVisible();

    // X não joga: os três recebem a derrota decidida pelo servidor.
    for (const target of [page, guest, watcher]) {
      await expect(target.locator('#turn')).toHaveText('Tempo esgotado: vitória de O', {
        timeout: 10_000,
      });
    }
    await expect(guest.locator('#result-title')).toHaveText('Tempo esgotado: vitória de O');
  } finally {
    await online.close();
  }
});

test('PWA: depois da primeira visita o app abre e joga sem rede', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#board [role="gridcell"]')).toHaveCount(9);
  await page.locator('#start').click();
  await cell(page, 'B2').click();
  await expect(page.locator('#board .mark-o')).toHaveCount(1);
  await context.setOffline(false);
});
