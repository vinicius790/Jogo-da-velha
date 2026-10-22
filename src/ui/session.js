/**
 * Estado da sessão da interface, compartilhado pelos controladores.
 * As regras do jogo ficam em `GameEngine`; aqui só há o que a tela precisa lembrar.
 */
export const session = {
  /** @type {import('../core/engine/game.js').GameEngine | null} */
  game: null,
  profile: null,
  /** A IA está calculando: bloqueia cliques no tabuleiro. */
  aiBusy: false,
  /** Último veredito da IA (para o painel de leitura da posição). */
  lastVerdict: null,
  /** Casa sugerida pela última dica (destacada no tabuleiro). */
  hintCell: -1,
  /** Avaliação estática a cada lance, para o gráfico. */
  evalSeries: [],
  /** Série local melhor-de-N, persistida à parte do perfil e do ranking. */
  localMatch: null,
  startedAt: Date.now(),
  /** Id da última partida já finalizada na tela (evita mostrar o resultado duas vezes). */
  finalizedId: null,
  /** Ids de partidas abertas por link: podem ser jogadas, mas nunca entram no perfil. */
  unratedIds: new Set(),
  /**
   * Sala online. `clockOffset` = relógio do servidor − relógio local; `clockStarted` diz se o
   * relógio da sala já corre (só depois que o segundo jogador entra).
   */
  online: { client: null, role: null, symbol: null, clockOffset: 0, clockStarted: false },
};

/** Símbolo do jogador humano na partida atual (null quando não há um humano identificado). */
export function humanSymbol(state) {
  if (state.mode === 'ai') return state.meta?.human ?? 'X';
  if (state.mode === 'online') return session.online.symbol;
  return null;
}