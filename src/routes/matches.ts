import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { scoring } from '../services/scoring.js';

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
    
    // Get the match before updating to check if scores changed
    const oldMatch = await prisma.match.findUnique({ where: { id: req.params.id } });
    
    const m = await prisma.match.update({
      where: { id: req.params.id },
      data: {
        scoreHome,
        scoreAway,
        status,
        kickoffAt: kickoffAt ? new Date(kickoffAt) : undefined,
      },
    });
    
    // If scores were updated and match is finished, recalculate points
    const scoresChanged = (oldMatch?.scoreHome !== scoreHome || oldMatch?.scoreAway !== scoreAway) && 
                         scoreHome !== null && scoreAway !== null && 
                         (status === 'FINISHED' || m.status === 'FINISHED');
    
    if (scoresChanged) {
      try {
        const { recalcForMatch } = await import('../services/recalc.js');
        const cachedDataService = (req as any).cachedDataService;
        await recalcForMatch(prisma, req.params.id, cachedDataService);
      } catch (error) {
        console.error('Failed to recalculate scores after match update:', error);
        // Don't fail the request, just log the error
      }
    }
    
    res.json({ match: m });
  });

  app.get('/api/admin/matches', async (_req: Request, res: Response) => {
    const matches = await prisma.match.findMany({ orderBy: { kickoffAt: 'asc' } });
    res.json({ matches });
  });

  // Public: predictions for a match (visible after kickoff)
  app.get('/api/matches/:id/predictions', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user) return res.status(401).json({ error: 'NO_AUTH' });

    const match = await prisma.match.findUnique({ where: { id: req.params.id } });
    if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

    const now = new Date();
    const kickoffAt = new Date(match.kickoffAt as any);
    if (now < kickoffAt) return res.status(403).json({ error: 'LOCKED' });

    const predictions = await prisma.prediction.findMany({
      where: { matchId: req.params.id },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    const hasActual = match.scoreHome != null && match.scoreAway != null;
    const actual = hasActual ? { home: match.scoreHome as number, away: match.scoreAway as number } : undefined;

    const items = predictions.map(p => {
      const pts = actual ? scoring({ home: p.predHome, away: p.predAway }, actual) : 0;
      return {
        userId: p.userId,
        name: p.user?.name,
        tg_user_id: (p.user as any)?.tg_user_id,
        predHome: p.predHome,
        predAway: p.predAway,
        points: pts,
        createdAt: p.createdAt,
      };
    });

    // Sort by live points desc, then by createdAt asc as a stable secondary key
    items.sort((a, b) => (b.points - a.points) || (a.createdAt as any).valueOf() - (b.createdAt as any).valueOf());

    res.json({
      match: {
        id: match.id,
        scoreHome: match.scoreHome,
        scoreAway: match.scoreAway,
        kickoffAt: match.kickoffAt,
        status: match.status,
      },
      predictions: items,
    });
  });
}


