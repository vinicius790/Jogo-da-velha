import { cellToCoordinate } from '../../core/notation.js';
import { formatNumber, t } from '../../services/i18n.js';
import { $, el } from '../dom.js';

/** Texto com o que a última busca da IA fez de fato (algoritmo, profundidade, nós, tempo). */
export function engineSummary(verdict) {
  if (!verdict) return '—';
  const parts = [t(`algorithm.${verdict.algorithm}`)];
  if (verdict.depth) parts.push(t('engine.depth', { depth: verdict.depth }));
  if (verdict.nodes) parts.push(t('engine.nodes', { nodes: formatNumber(verdict.nodes) }));
  parts.push(`${formatNumber(verdict.elapsedMs)} ms`);
  return parts.join(' · ');
}

/**
 * Painel "Leitura da posição". Tudo o que aparece aqui é calculado:
 * `analysis` vem de `analyzePosition` e `verdict` é o último resultado real do motor.
 */
export function renderInsights({ analysis, size, verdict, bestMove }) {
  const cells = (list) => list.map((index) => cellToCoordinate(index, size)).join(', ');
  $('#threat').textContent = analysis.tactical.blocks.length
    ? cells(analysis.tactical.blocks)
    : t('insights.none');
  $('#best-move').textContent = bestMove >= 0 ? cellToCoordinate(bestMove, size) : '—';
  $('#evaluation').textContent = formatNumber(analysis.evalScore, 1);
  $('#free-cells').textContent = `${analysis.free}/${analysis.total}`;
  $('#engine-info').textContent = engineSummary(verdict);

  const reasons = (verdict?.reasons ?? []).map((reason) => t(reason.key, reason.params));
  if (analysis.exact && analysis.free) {
    reasons.push(
      t(`reason.tablebase.${analysis.exact.outcome}`, { distance: analysis.exact.distance }),
    );
  }
  $('#reasoning').replaceChildren(...reasons.map((text) => el('li', {}, text)));
}
