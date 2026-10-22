// Checagens estáticas do projeto: versão, i18n, HTML, PWA e dependências.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { MODERATION_ACTIONS } from '../server/protocol.mjs';
import { ACHIEVEMENTS, DIFFICULTY_LEVELS, MODES, VARIANTS } from '../src/core/constants.js';
import { VERSION } from '../src/core/version.js';
import { dictionaries, setLanguage, supportedLanguages, t } from '../src/services/i18n.js';
import { LANGUAGES } from '../src/state/profile.js';

const read = (path) => readFileSync(path, 'utf8');
const pkg = JSON.parse(read('package.json'));
const html = read('index.html');

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(js|mjs)$/.test(entry.name) ? [full] : [];
  });
}
const sources = ['src', 'server', 'public'].flatMap(sourceFiles);
const uiSource = sourceFiles('src/ui').concat('src/main.js').map(read).join('\n');

// ---------- Versão ----------

test('regressão: a versão tem uma única fonte (package.json)', () => {
  assert.equal(VERSION, pkg.version);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  const hardcoded = sources.filter((file) => /['"`]\d+\.\d+\.\d+['"`]/.test(read(file)));
  assert.deepEqual(hardcoded, [], 'nenhum arquivo de código repete o número da versão');
  assert.ok(read('CHANGELOG.md').includes(`## ${VERSION}`), 'o CHANGELOG tem a entrada da versão');
});

// ---------- Internacionalização ----------

test('regressão: os três idiomas têm exatamente as mesmas chaves, todas preenchidas', () => {
  assert.deepEqual(supportedLanguages(), ['pt-BR', 'en', 'es']);
  assert.deepEqual(supportedLanguages(), [...LANGUAGES]);
  const reference = Object.keys(dictionaries['pt-BR']).sort();
  assert.ok(reference.length > 250, `dicionário com ${reference.length} chaves`);
  for (const language of supportedLanguages()) {
    assert.deepEqual(Object.keys(dictionaries[language]).sort(), reference, language);
    for (const [key, text] of Object.entries(dictionaries[language])) {
      assert.ok(typeof text === 'string' && text.trim(), `${language}:${key} vazio`);
    }
  }
});

test('os parâmetros {x} de cada texto são os mesmos nos três idiomas', () => {
  const params = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const key of Object.keys(dictionaries['pt-BR'])) {
    const expected = params(dictionaries['pt-BR'][key]);
    assert.deepEqual(params(dictionaries.en[key]), expected, `en:${key}`);
    assert.deepEqual(params(dictionaries.es[key]), expected, `es:${key}`);
  }
});

test('toda chave usada no HTML e no código existe no dicionário', () => {
  const known = new Set(Object.keys(dictionaries['pt-BR']));
  const used = new Set();
  for (const [, key] of html.matchAll(/data-i18n(?:-title|-label)?="([^"]+)"/g)) used.add(key);
  for (const [, key] of uiSource.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(key);
  // Chaves que aparecem como literais fora de uma chamada direta a t() (ternários, tabelas).
  const literal = /'((?:status|puzzle|ach|network|password|tournament|localMatch)\.[\w.-]+)'/g;
  for (const [, key] of uiSource.matchAll(literal)) used.add(key);
  for (const file of sources) {
    for (const [, key] of read(file).matchAll(/'(reason\.[\w.-]+)'/g)) used.add(key);
    for (const [, code] of read(file).matchAll(/OmegaError\(\s*'([\w-]+)'/g)) {
      used.add(`error.${code}`);
    }
    for (const [, code] of read(file).matchAll(/sendError\(socket, '([\w-]+)'/g)) {
      used.add(`error.${code}`);
    }
  }
  // Famílias de chaves montadas dinamicamente.
  for (const level of DIFFICULTY_LEVELS) used.add(`level.${level}`);
  for (const mode of MODES) used.add(`mode.${mode}`);
  for (const variant of VARIANTS) used.add(`variant.${variant}`).add(`variant.${variant}.help`);
  for (const { id } of ACHIEVEMENTS) used.add(`ach.${id}.title`).add(`ach.${id}.desc`);
  for (const name of ['none', 'random', 'tactical', 'tablebase', 'alpha-beta', 'alpha-beta+mcts']) {
    used.add(`algorithm.${name}`);
  }
  for (const outcome of ['win', 'draw', 'loss'])
    used.add(`outcome.${outcome}`).add(`result.${outcome}`);
  for (const role of ['host', 'guest', 'spectator']) used.add(`online.role.${role}`);
  for (const action of MODERATION_ACTIONS) used.add(`online.${action}`);
  for (const status of ['closed', 'reconnecting', 'lost', 'protocol-error']) {
    used.add(`online.status.${status}`);
  }
  for (const outcome of ['1', '0', '-1']) used.add(`reason.tablebase.${outcome}`);
  for (const severity of ['inaccuracy', 'blunder']) used.add(`study.${severity}`);
  for (const grade of ['brilliant', 'best', 'excellent', 'good', 'inaccuracy', 'blunder']) {
    used.add(`review.grade.${grade}`);
  }

  const missing = [...used].filter((key) => !known.has(key));
  assert.deepEqual(missing, [], 'chaves usadas sem tradução');
  const unused = [...known].filter((key) => !used.has(key));
  assert.deepEqual(unused, [], 'chaves no dicionário que ninguém usa');
});

test('t() interpola parâmetros e cai para o português em idioma desconhecido', () => {
  setLanguage('en');
  assert.equal(t('status.won', { mark: 'X' }), 'X wins');
  assert.equal(t('chave.inexistente'), 'chave.inexistente');
  assert.equal(setLanguage('klingon'), 'pt-BR');
  assert.equal(t('status.won', { mark: 'O' }), 'Vitória de O');
});

// ---------- HTML e interface ----------

test('ids do HTML são únicos e todo id usado pelo código existe', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(duplicated, []);
  const referenced = [...uiSource.matchAll(/\$\(\s*'#([\w-]+)'/g)].map((match) => match[1]);
  assert.ok(referenced.length > 60);
  const missing = [...new Set(referenced)].filter((id) => !ids.includes(id));
  assert.deepEqual(missing, [], 'ids usados no código e ausentes no index.html');
});

test('regressão: o tabuleiro usa grid → row → gridcell', () => {
  assert.match(html, /id="board"[^>]*role="grid"/);
  const view = read('src/ui/views/board-view.js');
  assert.ok(view.includes("role: 'row'"));
  assert.ok(view.includes("role: 'gridcell'"));
});

test('acessibilidade básica do HTML', () => {
  assert.match(html, /<html lang="pt-BR"/);
  assert.match(html, /<meta name="viewport"/);
  assert.equal([...html.matchAll(/<img\b(?![^>]*\balt=)/g)].length, 0);
  assert.equal([...html.matchAll(/\son\w+="/g)].length, 0, 'sem manipuladores inline');
  // Todo botão só com ícone tem nome acessível.
  for (const [tag] of html.matchAll(/<button[^>]*class="icon-button"[^>]*>/g)) {
    assert.match(tag, /aria-label="/, tag);
  }
  // Todo campo de formulário está dentro de um <label> ou tem aria-label.
  const fields = [...html.matchAll(/<(?:select|input|textarea)\b[^>]*>/g)].map((match) => match[0]);
  const labelled = [...html.matchAll(/<label[\s\S]*?<\/label>/g)].map((match) => match[0]).join('');
  for (const field of fields) {
    assert.ok(labelled.includes(field) || field.includes('aria-label='), field);
  }
});

test('segurança: sem innerHTML, eval ou document.write no código', () => {
  const pattern = /\binnerHTML\b|\bouterHTML\b|\beval\s*\(|new Function\s*\(|document\.write/;
  assert.deepEqual(
    sources.filter((file) => pattern.test(read(file))),
    [],
  );
  assert.match(html, /Content-Security-Policy/);
  assert.ok(!/script-src[^;]*unsafe-inline/.test(html));
});

test('regressão: métricas fixas e rótulos enganosos saíram da interface', () => {
  assert.ok(!uiSource.includes("'100%'"));
  assert.ok(!uiSource.includes('120+'));
  assert.ok(!html.includes('Simular 10.000 partidas'));
  assert.ok(!/\/18\b/.test(uiSource), 'total de conquistas não é fixo');
  // A arena simula a quantidade escolhida, fora da thread principal.
  const analytics = read('src/ui/controllers/analytics.js');
  assert.ok(analytics.includes("runTask('arena'"));
  assert.ok(html.includes('<option value="10000">'));
});

test('regressão: a IA roda no Web Worker em qualquer tamanho de tabuleiro', () => {
  const game = read('src/ui/controllers/game.js');
  assert.ok(game.includes("runTask('move'"));
  assert.ok(!game.includes('chooseMove('), 'a interface não chama a busca na thread principal');
  assert.ok(!/size\s*>=\s*5/.test(game));
});

// ---------- PWA ----------

test('regressão: service worker não lista caminhos de desenvolvimento; manifesto é relativo', () => {
  const sw = read('public/sw.js');
  assert.ok(!sw.includes('src/main.js'));
  assert.ok(!sw.includes('app.css'));
  assert.ok(!/omega-v\d+/.test(sw), 'nome de cache não é fixo');
  assert.ok(sw.includes('__PRECACHE_MANIFEST__') && sw.includes('__CACHE_VERSION__'));
  assert.ok(read('vite.config.js').includes('__PRECACHE_MANIFEST__'), 'o build preenche a lista');

  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  for (const icon of manifest.icons) assert.ok(!icon.src.startsWith('/'), icon.src);
  assert.equal(manifest.start_url, './');
  assert.ok(read('src/main.js').includes('import.meta.env?.PROD'), 'SW só no build de produção');
});

// ---------- Dependências ----------

test('regressão: toda dependência declarada é usada, e toda usada é declarada', () => {
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };
  const code = [...sources, ...sourceFiles('tests'), ...sourceFiles('scripts')]
    .concat(['vite.config.js', 'eslint.config.js', 'playwright.config.js'])
    .map(read)
    .join('\n');
  const imported = new Set(
    [...code.matchAll(/from\s+'((?:@[\w-]+\/)?[\w-]+)(?:\/[^']*)?'/g)]
      .map((match) => match[1])
      .filter((name) => !name.startsWith('node')),
  );
  for (const name of imported) assert.ok(name in declared, `${name} importado sem estar declarado`);
  const cliOnly = ['prettier', 'eslint']; // usados só pela linha de comando (format e lint)
  for (const name of Object.keys(declared)) {
    assert.ok(imported.has(name) || cliOnly.includes(name), `${name} declarado sem uso`);
  }
  assert.deepEqual(
    Object.keys(pkg.dependencies),
    ['ws'],
    'em produção só o servidor depende de ws',
  );
  for (const version of Object.values(declared)) assert.match(version, /^\d+\.\d+\.\d+$/);
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.packages[''].version, pkg.version);
  assert.ok(lock.packages['node_modules/ws'], 'lockfile cobre as dependências');
});
