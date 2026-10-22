import { chooseMove } from '../core/ai/engine.js';
import { GameEngine } from '../core/engine/game.js';

/** Resumo do histórico de partidas do perfil (entradas produzidas por `applyGameResult`). */
export function summarize(history) {
  const played = history.length;
  const wins = history.filter((entry) => entry.outcome === 'win').length;
  const draws = history.filter((entry) => entry.outcome === 'draw').length;
  const totalMoves = history.reduce((sum, entry) => sum + (entry.moves || 0), 0);
  return {
    played,
    wins,
    draws,
    losses: played - wins - draws,
    winRate: played ? wins / played : 0,
    avgMoves: played ? totalMoves / played : 0,
  };
}

/**
 * Joga `games` partidas IA × IA e devolve a contagem real de resultados.
 * `x` e `o` são os níveis de cada lado; X sempre começa.
 * `moveMs` traz o tempo de cada decisão da IA (para estatísticas de latência).
 */
export function playArena({ games = 10, config, x = 'hard', o = 'normal', rng = Math.random }) {
  const tally = { games: 0, x: 0, o: 0, draws: 0, moves: 0, moveMs: [] };
  for (let i = 0; i < games; i += 1) {
    const game = new GameEngine({ mode: 'spectator', config });
    let state = game.state;
    while (state.status === 'playing') {
      const started = performance.now();
      const { move } = chooseMove({
        board: state.board,
        config: state.config,
        player: state.current,
        difficulty: state.current === 'X' ? x : o,
        rng,
      });
      tally.moveMs.push(performance.now() - started);
      state = game.play(move);
    }
    tally.games += 1;
    tally.moves += state.moves.length;
    if (state.result === 'X') tally.x += 1;
    else if (state.result === 'O') tally.o += 1;
    else tally.draws += 1;
  }
  return tally;
}
