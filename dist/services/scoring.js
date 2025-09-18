export function scoring(pred, actual) {
    if (pred.home === actual.home && pred.away === actual.away)
        return 5;
    const predDiff = pred.home - pred.away;
    const actualDiff = actual.home - actual.away;
    const predOutcome = Math.sign(predDiff);
    const actualOutcome = Math.sign(actualDiff);
    if (predOutcome === actualOutcome && Math.abs(predDiff) === Math.abs(actualDiff))
        return 3;
    if (predOutcome === actualOutcome)
        return 2;
    return 0;
}
// Notes:
// - Only 90 minutes considered for actual score per product decision.
// - Draws: outcome=0. If predicted draw but not exact (e.g., 1:1 vs 2:2) => 3 points.
