// Teste de fumaça do motor: joga uma partida IA × IA completa e valida o estado final.
import { chooseMove, GameEngine, validateSnapshot, VERSION } from '../src/index.js';

const game = new GameEngine({ mode: 'spectator', difficulty: 'expert' });
let state = game.state;
while (state.status === 'playing') {
  const { move } = chooseMove({
    board: state.board,
    config: state.config,
    player: state.current,
    difficulty: state.difficulty,
  });
  state = game.play(move);
}
validateSnapshot(state);
if (state.result !== 'draw') throw new Error('Dois jogadores perfeitos deveriam empatar no 3×3.');
console.log(
  JSON.stringify({ ok: true, version: VERSION, result: state.result, moves: state.moves.length }),
);
