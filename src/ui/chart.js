const PALETTES = {
  accent: { stroke: '#7c5cff', fill: 'rgba(124, 92, 255, 0.14)' },
  info: { stroke: '#00d4ff', fill: 'rgba(0, 212, 255, 0.12)' },
};

/** Gráfico de linha simples em canvas (sem biblioteca), ajustado à densidade de pixels da tela. */
export function drawSparkline(canvas, values, palette = 'accent') {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return; // canvas escondido
  const ratio = globalThis.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  context.clearRect(0, 0, rect.width, rect.height);
  if (!values.length) return;

  const { stroke, fill } = PALETTES[palette];
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const stepX = (rect.width - 10) / Math.max(1, values.length - 1);
  const points = values.map((value, i) => [
    5 + i * stepX,
    rect.height - 8 - ((value - min) / range) * (rect.height - 18),
  ]);
  const trace = () => {
    context.beginPath();
    points.forEach(([x, y], i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
  };

  trace();
  context.lineTo(points.at(-1)[0], rect.height);
  context.lineTo(points[0][0], rect.height);
  context.closePath();
  context.fillStyle = fill;
  context.fill();

  trace();
  context.strokeStyle = stroke;
  context.lineWidth = 2;
  context.stroke();
}
