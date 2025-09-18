import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

type Logger = { info: Function; warn: Function; error: Function };

export function registerMatchRoutes(app: Express, prisma: PrismaClient, _logger: Logger) {
  // Admin CRUD minimal
  app.post('/api/admin/matches', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    const { stage, group, matchday, homeTeam, awayTeam, kickoffAt, status } = req.body || {};
    const m = await prisma.match.create({
      data: { stage, group, matchday, homeTeam, awayTeam, kickoffAt: new Date(kickoffAt), status: status ?? 'SCHEDULED' },
    });
    res.json({ match: m });
  });

  app.patch('/api/admin/matches/:id', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    const { scoreHome, scoreAway, status, kickoffAt } = req.body || {};
    const m = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        scoreHome,
        scoreAway,
        status,
        kickoffAt: kickoffAt ? new Date(kickoffAt) : undefined,
      },
    });
    res.json({ match: m });
  });

  app.get('/api/admin/matches', async (_req: Request, res: Response) => {
    const matches = await prisma.match.findMany({ orderBy: { kickoffAt: 'asc' } });
    res.json({ matches });
  });
}


