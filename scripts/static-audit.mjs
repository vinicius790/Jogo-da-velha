// Auditoria estática sem dependências (roda antes mesmo do `npm install`):
// imports relativos que não resolvem, ids usados no código e ausentes no HTML, APIs proibidas.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const problems = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['node_modules', 'dist', '.git'].includes(entry.name) ? [] : walk(full);
    }
    return /\.(js|mjs)$/.test(entry.name) ? [full] : [];
  });
}

const files = ['src', 'server', 'scripts', 'tests', 'public'].flatMap((dir) =>
  walk(path.join(root, dir)),
);
const relative = (file) => path.relative(root, file).replaceAll('\\', '/');

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [, target] of text.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
      problems.push(`import ausente: ${relative(file)} -> ${target}`);
    }
  }
  const isProduct = /^(src|server|public)\//.test(relative(file));
  if (isProduct && /\binnerHTML\b|\beval\s*\(|new Function\s*\(/.test(text)) {
    problems.push(`API proibida (innerHTML/eval/new Function): ${relative(file)}`);
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
for (const file of files.filter((item) => relative(item).startsWith('src/'))) {
  for (const [, id] of fs.readFileSync(file, 'utf8').matchAll(/\$\(\s*'#([\w-]+)'/g)) {
    if (!ids.has(id)) problems.push(`id ausente no index.html: #${id} (${relative(file)})`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checkedFiles: files.length, htmlIds: ids.size }));
