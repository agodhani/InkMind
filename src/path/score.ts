export function emptyPathCounts() {
  return { cases: 0, expectedSteps: 0, predictedSteps: 0, stepHits: 0, knownExpected: 0, knownHits: 0,
    partialExpected: 0, partialHits: 0, mustSkip: 0, mustSkipViolations: 0, orderingViolations: 0,
    deterministic: 0, replans: 0, replanStable: 0, doneExpected: 0, doneHits: 0, reasonsOk: 0, reasonsTotal: 0 };
}
export type PathCounts = ReturnType<typeof emptyPathCounts>;
