import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { registerAdminRoutes } from './admin.js';
import { registerPredictionRoutes } from './predictions.js';
import { registerMatchRoutes } from './matches.js';
import { registerLeaderboardRoutes } from './leaderboard.js';
import { registerRecalcRoutes } from './recalc.js';
import { getTopScorers } from '../services/footballData.js';

type Logger = { info: Function; warn: Function; error: Function };

export function registerRoutes(app: Express, prisma: PrismaClient, logger: Logger) {
  // Auth probe: returns current user from initDataAuth
  app.get('/api/me', (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user) return res.status(401).json({ error: 'NO_AUTH' });
    res.json({ user });
  });

  // Top scorers endpoint (public)
  app.get('/api/scorers', async (req: Request, res: Response) => {
    try {
      const season = parseInt(req.query.season as string) || new Date().getFullYear();
      const env = (req as any).env || process.env;
      const scorers = await getTopScorers(season, env);
      res.json(scorers);
    } catch (error) {
      logger.error({ error }, 'Failed to get scorers');
      res.status(500).json({ error: 'Failed to get scorers' });
    }
  });

  // Matches public list (cached) with user predictions
  app.get('/api/matches', async (req, res) => {
    try {
      const user = (req as any).authUser;
      const cachedDataService = (req as any).cachedDataService;
      
      if (!cachedDataService) {
        // Fallback to direct DB query if cache service not available
        const matches = await prisma.match.findMany({ orderBy: { kickoffAt: 'asc' } });
        
        // If user is authenticated, include their predictions
        if (user) {
          const userPredictions = await prisma.prediction.findMany({
            where: { userId: user.id },
            select: { matchId: true, predHome: true, predAway: true }
          });
          
          const predictionsMap = userPredictions.reduce((acc, pred) => {
            acc[pred.matchId] = { predHome: pred.predHome, predAway: pred.predAway };
            return acc;
          }, {} as Record<string, { predHome: number; predAway: number }>);
          
          const matchesWithPredictions = matches.map((match: any) => ({
            ...match,
            userPrediction: predictionsMap[match.id] || null
          }));
          
          return res.json({ matches: matchesWithPredictions });
        }
        
        return res.json({ matches });
      }
      
      const matches = await cachedDataService.getMatches();
      
      // If user is authenticated, include their predictions
      if (user) {
        const userPredictions = await prisma.prediction.findMany({
          where: { userId: user.id },
          select: { matchId: true, predHome: true, predAway: true }
        });
        
        const predictionsMap = userPredictions.reduce((acc, pred) => {
          acc[pred.matchId] = { predHome: pred.predHome, predAway: pred.predAway };
          return acc;
        }, {} as Record<string, { predHome: number; predAway: number }>);
        
        const matchesWithPredictions = matches.map((match: any) => ({
          ...match,
          userPrediction: predictionsMap[match.id] || null
        }));
        
        res.json({ matches: matchesWithPredictions });
      } else {
        res.json({ matches });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to get matches');
      res.status(500).json({ error: 'Failed to get matches' });
    }
  });

  registerAdminRoutes(app, prisma, logger);
  registerPredictionRoutes(app, prisma, logger);
  registerMatchRoutes(app, prisma, logger);
  registerLeaderboardRoutes(app, prisma, logger);
  registerRecalcRoutes(app, prisma, logger);
}


