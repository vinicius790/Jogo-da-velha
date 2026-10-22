import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  // Código do navegador (inclui o Web Worker).
  {
    files: ['src/**/*.js', 'legacy/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
  },
  { files: ['public/sw.js'], languageOptions: { globals: globals.serviceworker } },
  // Código executado em Node: servidor, scripts, testes e arquivos de configuração.
  {
    files: ['server/**', 'scripts/**', 'tests/**', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  // Testes e2e: as funções passadas a `page.evaluate` rodam dentro do navegador.
  {
    files: ['tests/e2e/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  { files: ['legacy/**/*.js'], languageOptions: { sourceType: 'script' } },
];
