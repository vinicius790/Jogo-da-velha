import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd(),
  skip = new Set(['.git', 'node_modules', 'dist', 'coverage', '.cache']);
const files = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(root);
const entries = files
  .map((file) => {
    const data = fs.readFileSync(file);
    return {
      path: path.relative(root, file).replaceAll('\\', '/'),
      bytes: data.length,
      sha256: crypto.createHash('sha256').update(data).digest('hex'),
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const report = {
  project: pkg.name,
  version: pkg.version,
  generatedAt: new Date().toISOString(),
  node: process.version,
  fileCount: entries.length,
  totalBytes: entries.reduce((a, f) => a + f.bytes, 0),
  files: entries,
};
fs.writeFileSync('release-manifest.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      project: report.project,
      version: report.version,
      fileCount: report.fileCount,
      totalBytes: report.totalBytes,
      manifest: 'release-manifest.json',
    },
    null,
    2,
  ),
);
