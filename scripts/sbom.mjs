// Gera sbom.cdx.json (CycloneDX 1.5) a partir do package-lock.json: todos os pacotes
// instalados, diretos e transitivos, com versão exata e hash de integridade.
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

const components = Object.entries(lock.packages)
  .filter(([location]) => location.startsWith('node_modules/'))
  .map(([location, info]) => {
    const name = location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const component = {
      type: 'library',
      name,
      version: info.version,
      purl: `pkg:npm/${name.replace('@', '%40')}@${info.version}`,
      scope: info.dev ? 'excluded' : 'required',
    };
    const [algorithm, digest] = (info.integrity ?? '').split('-');
    if (algorithm === 'sha512' && digest) {
      component.hashes = [
        { alg: 'SHA-512', content: Buffer.from(digest, 'base64').toString('hex') },
      ];
    }
    return component;
  })
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: { component: { type: 'application', name: pkg.name, version: pkg.version } },
  components,
};
fs.writeFileSync('sbom.cdx.json', `${JSON.stringify(sbom, null, 2)}\n`);
const required = components.filter((component) => component.scope === 'required').length;
console.log(`sbom.cdx.json: ${components.length} componentes (${required} de produção).`);
