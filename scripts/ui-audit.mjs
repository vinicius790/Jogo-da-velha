import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
const buttons = [...html.matchAll(/<button\b([^>]*)>(.*?)<\/button>/gis)].map((m) => ({
  attrs: m[1],
  text: m[2].replace(/<[^>]+>/g, '').trim(),
}));
const unlabeled = buttons.filter((b) => !b.text && !/aria-label=|title=/.test(b.attrs));
const inlineHandlers = [...html.matchAll(/\son(?:click|change|input|submit|keydown|keyup)\s*=/gi)]
  .length;
const missingLabels = [...html.matchAll(/<input\b([^>]*)>/gi)].filter(
  (m) => !/(aria-label=|id=)/.test(m[1]),
).length;
const images = [...html.matchAll(/<img\b([^>]*)>/gi)].filter((m) => !/\balt=/.test(m[1])).length;
const report = {
  ok: !duplicates.length && !unlabeled.length && !inlineHandlers && !missingLabels && !images,
  ids: ids.length,
  duplicateIds: [...new Set(duplicates)],
  unlabeledButtons: unlabeled.length,
  inlineHandlers,
  inputsWithoutLabelHint: missingLabels,
  imagesWithoutAlt: images,
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
