// Arena de força: joga cada par de níveis nos dois lados (X e O) e imprime os resultados reais.
// Uso: node scripts/benchmark.mjs [tamanho] [vitória] [variante] [partidas-por-lado] [nivelA,nivelB,...]
// Ex.: node scripts/benchmark.mjs 5 4 classic 10 expert,omega
import { DIFFICULTY_LEVELS } from '../src/core/constants.js';
import { describe } from '../src/core/analysis/statistics.js';
import { playArena } from '../src/features/analytics.js';

const [sizeArg = '3', winArg = '3', variant = 'classic', gamesArg = '20', levelsArg] =
  process.argv.slice(2);
const config = { size: Number(sizeArg), winLength: Number(winArg), variant };
const games = Number(gamesArg);
const levels = levelsArg ? levelsArg.split(',') : DIFFICULTY_LEVELS;

console.log(
  `Arena ${config.size}×${config.size}, vitória com ${config.winLength}, variante ${variant}; ` +
    `${games} partidas por lado em cada par.`,
);
for (let i = 0; i < levels.length; i += 1) {
  for (let j = i + 1; j < levels.length; j += 1) {
    const weaker = levels[i];
    const stronger = levels[j];
    const asX = playArena({ games, config, x: stronger, o: weaker });
    const asO = playArena({ games, config, x: weaker, o: stronger });
    const wins = asX.x + asO.o;
    const losses = asX.o + asO.x;
    const draws = asX.draws + asO.draws;
    const latency = describe([...asX.moveMs, ...asO.moveMs]);
    console.log(
      `${stronger.padEnd(6)} × ${weaker.padEnd(6)} → ${stronger} venceu ${wins}, perdeu ${losses}, ` +
        `empatou ${draws} | lance: média ${latency.mean.toFixed(1)} ms, p95 ${latency.p95.toFixed(1)} ms`,
    );
  }
}
