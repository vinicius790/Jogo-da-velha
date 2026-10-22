import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !['node_modules', 'dist', '.git'].includes(e.name))
      out = out.concat(walk(p));
    else if (/\.(js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = ['src', 'server', 'scripts'].flatMap((d) => walk(d));
for (const file of files) {
  if (file.endsWith('syntax-check.mjs')) continue;
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}
console.log(JSON.stringify({ ok: true, checkedFiles: files.length }));
