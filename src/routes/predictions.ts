import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

type Logger = { info: Function; warn: Function; error: Function };

export function registerPredictionRoutes(app: Express, prisma: PrismaClient, _logger: Logger) {
  // Create or update prediction before kickoff; store history
  app.post('/api/predictions', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user) return res.status(401).json({ error: 'NO_AUTH' });
    const { matchId, predHome, predAway } = req.body || {};
    if (!matchId || typeof predHome !== 'number' || typeof predAway !== 'number') {
      return res.status(400).json({ error: 'BAD_INPUT' });
    }
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
    if (new Date() >= new Date(match.kickoffAt)) return res.status(403).json({ error: 'LOCKED' });

    const existing = await prisma.prediction.findUnique({ where: { userId_matchId: { userId: user.id, matchId } } });
    if (existing) {
      await prisma.predictionHistory.create({
        data: {
          userId: user.id,
          matchId,
          predHome: existing.predHome,
          predAway: existing.predAway,
        },
      });
    }

    const pred = await prisma.prediction.upsert({
      where: { userId_matchId: { userId: user.id, matchId } },
      create: { userId: user.id, matchId, predHome, predAway },
      update: { predHome, predAway },
    });

    // Update firstPredAt for tie-break if needed
    await prisma.score.upsert({
      where: { userId: user.id },
      create: { userId: user.id, firstPredAt: new Date() },
      update: {
        firstPredAt: (existing && existing.createdAt < new Date()) ? existing.createdAt : undefined,
      },
    });

    res.json({ prediction: pred });
  });
}


