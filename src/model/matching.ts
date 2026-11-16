/** Maximum-weight one-to-one assignment; nonpositive scores leave items unmatched. */
export function matchPairs(scores: number[][]): Map<number, number> {
  const n = scores.length, real = scores[0]?.length ?? 0, m = real + n;
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const min = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const cost = -(j <= real ? scores[i0 - 1][j - 1] : 0) - u[i0] - v[j];
        if (cost < min[j]) { min[j] = cost; way[j] = j0; }
        if (min[j] < delta) { delta = min[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else min[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0);
  }
  return new Map(p.flatMap((i, j) => i && j > 0 && j <= real && scores[i - 1][j - 1] > 0 ? [[i - 1, j - 1]] : []));
}
