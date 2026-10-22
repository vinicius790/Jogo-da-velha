// Glicko-2 conforme Glickman, "Example of the Glicko-2 system" (2013).
const SCALE = 173.7178;
const TAU = 0.5; // restringe a variação da volatilidade
const EPSILON = 0.000001;

const g = (phi) => 1 / Math.sqrt(1 + (3 * phi * phi) / Math.PI ** 2);
const expectation = (mu, muJ, phiJ) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** Pontuação esperada contra um adversário, considerando a incerteza do rating dele. */
export function expectedGlicko(rating, opponentRating, opponentDeviation) {
  return expectation(
    (rating - 1500) / SCALE,
    (opponentRating - 1500) / SCALE,
    opponentDeviation / SCALE,
  );
}

/**
 * Atualiza rating, desvio e volatilidade após um período de jogos.
 * `results`: lista de `{ opponentRating, opponentDeviation, score }` (score 1, 0,5 ou 0).
 * Sem jogos no período, só o desvio aumenta (passo 6 do artigo).
 */
export function updateGlicko2(player, results = []) {
  const rating = player.rating ?? 1500;
  const deviation = player.deviation ?? 350;
  const sigma = player.volatility ?? 0.06;
  const mu = (rating - 1500) / SCALE;
  const phi = deviation / SCALE;

  if (!results.length) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { rating, deviation: Math.min(350, phiStar * SCALE), volatility: sigma };
  }

  let vInverse = 0;
  let deltaSum = 0;
  for (const { opponentRating = 1500, opponentDeviation = 350, score } of results) {
    const muJ = (opponentRating - 1500) / SCALE;
    const phiJ = opponentDeviation / SCALE;
    const gJ = g(phiJ);
    const e = expectation(mu, muJ, phiJ);
    vInverse += gJ * gJ * e * (1 - e);
    deltaSum += gJ * (score - e);
  }
  const v = 1 / vInverse;
  const delta = v * deltaSum;

  // Nova volatilidade: raiz de f(x) pelo método Illinois (passo 5 do artigo).
  const a = Math.log(sigma * sigma);
  const f = (x) => {
    const ex = Math.exp(x);
    const numerator = ex * (delta * delta - phi * phi - v - ex);
    const denominator = 2 * (phi * phi + v + ex) ** 2;
    return numerator / denominator - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k += 1;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > EPSILON; i += 1) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const sigmaPrime = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * deltaSum;
  return {
    rating: muPrime * SCALE + 1500,
    deviation: phiPrime * SCALE,
    volatility: sigmaPrime,
  };
}
