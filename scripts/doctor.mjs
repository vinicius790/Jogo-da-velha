// Diagnóstico do ambiente local: versões de Node/npm e se as dependências estão instaladas.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

function npmVersion() {
  try {
    return execSync('npm --version', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function installedVersion(name) {
  try {
    return JSON.parse(fs.readFileSync(`node_modules/${name}/package.json`, 'utf8')).version;
  } catch {
    return null;
  }
}

const dependencies = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).map(
  ([name, wanted]) => ({ name, wanted, installed: installedVersion(name) }),
);
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = major > 22 || (major === 22 && minor >= 13);

const report = {
  project: pkg.name,
  version: pkg.version,
  node: { version: process.version, required: pkg.engines.node, ok: nodeOk },
  npm: npmVersion(),
  dependencies,
  ready: nodeOk && dependencies.every((item) => item.installed === item.wanted),
};
console.log(JSON.stringify(report, null, 2));
if (!report.ready) {
  console.error('Ambiente incompleto: confira a versão do Node e rode "npm ci".');
  process.exit(1);
}
