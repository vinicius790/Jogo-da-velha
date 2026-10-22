import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig } from 'vite';

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

/**
 * Depois do build, preenche dist/sw.js com a lista real de arquivos gerados (nomes com hash)
 * e com uma versão de cache derivada do conteúdo: qualquer mudança no build troca o cache.
 */
function serviceWorkerManifest() {
  let outDir = 'dist';
  return {
    name: 'omega-sw-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      const files = listFiles(outDir)
        .filter((file) => file !== swPath && !file.endsWith('.map'))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(file));
      const manifest = files.map((file) => relative(outDir, file).replaceAll('\\', '/'));
      const source = readFileSync(swPath, 'utf8')
        .replace('__CACHE_VERSION__', hash.digest('hex').slice(0, 12))
        .replace('self.__PRECACHE_MANIFEST__ || []', JSON.stringify(manifest));
      writeFileSync(swPath, source);
    },
  };
}

export default defineConfig({
  // Caminhos relativos: o build funciona na raiz de um domínio ou em um subcaminho (GitHub Pages).
  base: './',
  plugins: [serviceWorkerManifest()],
  server: { host: '127.0.0.1', port: 4173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { target: 'es2022', sourcemap: true },
  worker: { format: 'es' },
});
