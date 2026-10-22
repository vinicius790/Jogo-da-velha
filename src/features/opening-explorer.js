const sameConfig = (a, b) =>
  a.size === b.size &&
  a.winLength === b.winLength &&
  (a.variant ?? 'classic') === (b.variant ?? 'classic');

/**
 * Árvore de aberturas do acervo de replays: para cada prefixo de lances (até `depth`),
 * quantas partidas passaram por ele e como terminaram.
 * Só faz sentido comparar partidas da mesma configuração; passe `config` para filtrar.
 */
export function buildOpeningExplorer(replays = [], { depth = 4, config = null } = {}) {
  const lines = new Map();
  for (const replay of replays) {
    if (config && !sameConfig(replay.config, config)) continue;
    const moves = replay.moves.slice(0, depth);
    for (let plies = 1; plies <= moves.length; plies += 1) {
      const prefix = moves
        .slice(0, plies)
        .map((move) => move.index)
        .join('.');
      const entry = lines.get(prefix) ?? { prefix, plies, games: 0, winsX: 0, winsO: 0, draws: 0 };
      entry.games += 1;
      if (replay.result === 'X') entry.winsX += 1;
      else if (replay.result === 'O') entry.winsO += 1;
      else if (replay.result === 'draw') entry.draws += 1;
      lines.set(prefix, entry);
    }
  }
  return [...lines.values()].sort((a, b) => b.games - a.games || a.plies - b.plies);
}

/** Resumo: quantas partidas, quantas linhas distintas e o primeiro lance mais jogado. */
export function openingStats(replays = [], config = null) {
  const lines = buildOpeningExplorer(replays, { depth: 4, config });
  const firstMoves = lines.filter((line) => line.plies === 1);
  return {
    games: firstMoves.reduce((sum, line) => sum + line.games, 0),
    uniqueLines: lines.length,
    firstMoves: firstMoves.length,
    mostPlayed: firstMoves[0] ?? null,
  };
}
