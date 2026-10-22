const finite = (values) => values.filter(Number.isFinite);

export function mean(values) {
  const v = finite(values);
  return v.length ? v.reduce((sum, x) => sum + x, 0) / v.length : 0;
}

/** Percentil com interpolação linear; `p` em [0, 1]. */
export function percentile(values, p) {
  const v = finite(values).sort((a, b) => a - b);
  if (!v.length) return 0;
  const position = (v.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(position);
  const hi = Math.ceil(position);
  return v[lo] + (v[hi] - v[lo]) * (position - lo);
}

export function describe(values) {
  const v = finite(values);
  return {
    count: v.length,
    mean: mean(v),
    min: v.length ? v.reduce((a, b) => Math.min(a, b)) : 0,
    max: v.length ? v.reduce((a, b) => Math.max(a, b)) : 0,
    p50: percentile(v, 0.5),
    p95: percentile(v, 0.95),
  };
}
