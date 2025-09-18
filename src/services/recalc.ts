import type { PrismaClient } from '@prisma/client';
import { scoring } from './scoring.js';

export async function recalcForMatch(prisma: PrismaClient, matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.scoreHome == null || match.scoreAway == null) return { updated: 0 };
  const actual = { home: match.scoreHome, away: match.scoreAway };

  const preds = await prisma.prediction.findMany({ where: { matchId } });
  const aggregates: Record<string, { total: number; exact: number; diff: number; outcome: number }> = {};

  for (const p of preds) {
    const pts = scoring({ home: p.predHome, away: p.predAway }, actual);
    if (!aggregates[p.userId]) aggregates[p.userId] = { total: 0, exact: 0, diff: 0, outcome: 0 };
    aggregates[p.userId].total += pts;
    if (pts === 5) aggregates[p.userId].exact += 1;
    else if (pts === 3) aggregates[p.userId].diff += 1;
    else if (pts === 2) aggregates[p.userId].outcome += 1;
  }

  const ops = Object.entries(aggregates).map(([userId, a]) =>
    prisma.score.upsert({
      where: { userId },
      create: {
        userId,
        pointsTotal: a.total,
        exactCount: a.exact,
        diffCount: a.diff,
        outcomeCount: a.outcome,
        lastUpdated: new Date(),
      },
      update: {
        pointsTotal: { increment: a.total },
        exactCount: { increment: a.exact },
        diffCount: { increment: a.diff },
        outcomeCount: { increment: a.outcome },
        lastUpdated: new Date(),
      },
    })
  );
  await prisma.$transaction(ops);
  return { updated: ops.length };
}

export async function recalcAll(prisma: PrismaClient) {
  const finished = await prisma.match.findMany({ where: { status: 'FINISHED' } });
  // Reset scores
  await prisma.score.updateMany({ data: { pointsTotal: 0, exactCount: 0, diffCount: 0, outcomeCount: 0 } });
  for (const m of finished) await recalcForMatch(prisma, m.id);
  return { matches: finished.length };
}


