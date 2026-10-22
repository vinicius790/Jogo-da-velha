/**
 * Telemetria local da sessão: guarda em memória as medições reais das decisões da IA
 * (algoritmo, tempo, nós) para o painel de Analytics. Nada é enviado para fora do navegador.
 */
const LIMIT = 500;
const samples = [];

export function track(name, data = {}) {
  samples.push({ name, data, at: Date.now() });
  if (samples.length > LIMIT) samples.shift();
}

export function snapshot(name = null) {
  return name ? samples.filter((sample) => sample.name === name) : samples.slice();
}
