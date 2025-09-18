import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

type Logger = { info: Function; warn: Function; error: Function };

export function registerLeaderboardRoutes(app: Express, prisma: PrismaClient, logger: Logger) {
  // Global leaderboard (cached)
  app.get('/api/leaderboard', async (req: Request, res: Response) => {
    try {
      const cachedDataService = (req as any).cachedDataService;
      if (!cachedDataService) {
        // Fallback to direct DB query if cache service not available
        const items = await prisma.score.findMany({
          include: { user: true },
          orderBy: [
            { pointsTotal: 'desc' },
            { exactCount: 'desc' },
            { diffCount: 'desc' },
            { firstPredAt: 'asc' },
          ],
          take: 100,
        });
        return res.json({ leaderboard: items });
      }
      
      const leaderboard = await cachedDataService.getLeaderboard();
      res.json({ leaderboard });
    } catch (error) {
      logger.error({ error }, 'Failed to get leaderboard');
      res.status(500).json({ error: 'Failed to get leaderboard' });
    }
  });
}


