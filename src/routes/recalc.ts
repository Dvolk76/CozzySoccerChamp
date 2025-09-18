import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

type Logger = { info: Function; warn: Function; error: Function };

export function registerRecalcRoutes(app: Express, prisma: PrismaClient, logger: Logger) {
  app.post('/api/admin/recalc/:matchId', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    const { recalcForMatch } = await import('../services/recalc.js');
    const result = await recalcForMatch(prisma, req.params.matchId);
    res.json(result);
  });

  app.post('/api/admin/recalc-all', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    const { recalcAll } = await import('../services/recalc.js');
    const result = await recalcAll(prisma);
    res.json(result);
  });
}


