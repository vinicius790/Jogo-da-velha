// Confere o build de produção (rode depois de `npm run build`):
// - o service worker foi preenchido e todo arquivo do precache existe em dist/;
// - o manifesto e o index.html só apontam para caminhos relativos que existem.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const problems = [];
const mustExist = (path, origin) => {
  if (!existsSync(join(dist, path))) problems.push(`${origin}: "${path}" não existe em dist/`);
};

const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
if (sw.includes('__CACHE_VERSION__') || sw.includes('__PRECACHE_MANIFEST__')) {
  problems.push('sw.js: os marcadores do build não foram substituídos');
}
const precache = JSON.parse(sw.match(/const PRECACHE = (\[.*?\]);/s)?.[1] ?? '[]');
if (!precache.includes('index.html')) problems.push('sw.js: index.html fora do precache');
if (!precache.some((path) => path.endsWith('.js')))
  problems.push('sw.js: nenhum script no precache');
for (const path of precache) mustExist(path, 'sw.js');

const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons) {
  if (icon.src.startsWith('/'))
    problems.push(`manifesto: ícone com caminho absoluto (${icon.src})`);
  mustExist(icon.src, 'manifesto');
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
for (const [, ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^[a-z]+:/i.test(ref)) continue;
  if (ref.startsWith('/')) problems.push(`index.html: caminho absoluto (${ref})`);
  else mustExist(ref.replace(/^\.\//, ''), 'index.html');
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Build ok: ${precache.length} arquivos no precache do service worker.`);
