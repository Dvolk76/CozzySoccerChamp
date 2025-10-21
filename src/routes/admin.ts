import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';

type Logger = { info: Function; warn: Function; error: Function };

export function registerAdminRoutes(app: Express, prisma: PrismaClient, logger: Logger) {
  // DEV ONLY: Direct user wipe without auth (for development reset)
  const DEV_ENDPOINTS_ENABLED = process.env.TG_INIT_BYPASS === '1';
  if (DEV_ENDPOINTS_ENABLED) {
    app.post('/dev/wipe-users', async (req: Request, res: Response) => {
      const { password } = req.body || {};
      if (password !== 'Kukuruza') return res.status(403).json({ error: 'BAD_PASSWORD' });
      try {
        // Delete dependent records first due to foreign keys
        await prisma.predictionHistory.deleteMany({});
        await prisma.prediction.deleteMany({});
        await prisma.score.deleteMany({});
        const result = await prisma.user.deleteMany({});
        res.json({ deletedUsers: result.count });
      } catch (e) {
        logger.error({ e }, 'wipe-users error');
        res.status(500).json({ error: 'WIPE_FAILED' });
      }
    });
  }

  // Claim admin via shared password (simple for friends)
  app.post('/api/admin/claim', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user) return res.status(401).json({ error: 'NO_AUTH' });
    const { password } = req.body || {};
    if (password !== 'Kukuruza') return res.status(403).json({ error: 'BAD_PASSWORD' });
    const updated = await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    res.json({ user: updated });
  });

  // Danger: wipe all users (dev helper). Protected by password only.
  if (DEV_ENDPOINTS_ENABLED) {
    app.post('/api/admin/wipe-users', async (req: Request, res: Response) => {
      const { password } = req.body || {};
      if (password !== 'Kukuruza') return res.status(403).json({ error: 'BAD_PASSWORD' });
      try {
        // Delete dependent records first due to foreign keys
        await prisma.predictionHistory.deleteMany({});
        await prisma.prediction.deleteMany({});
        await prisma.score.deleteMany({});
        const result = await prisma.user.deleteMany({});
        res.json({ deletedUsers: result.count });
      } catch (e) {
        logger.error({ e }, 'wipe-users error');
        res.status(500).json({ error: 'WIPE_FAILED' });
      }
    });
  }

  // Trigger sync with football-data.org (cached with rate limiting)
  app.post('/api/admin/sync', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    const season = Number(req.body?.season) || new Date().getUTCFullYear();
    
    try {
      const cachedDataService = (req as any).cachedDataService;
      if (!cachedDataService) {
        // Fallback to direct sync if cache service not available
        const { syncChampionsLeague } = await import('../services/footballData.js');
        const result = await syncChampionsLeague(prisma, season);
        return res.json(result);
      }
      
      const result = await cachedDataService.syncMatchesFromAPI(season);
      res.json(result);
    } catch (e) {
      logger.error({ e }, 'sync error');
      res.status(500).json({ error: 'SYNC_FAILED' });
    }
  });

  // Force refresh all cached data
  app.post('/api/admin/refresh-cache', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    
    try {
      const cachedDataService = (req as any).cachedDataService;
      if (!cachedDataService) {
        return res.status(503).json({ error: 'CACHE_SERVICE_UNAVAILABLE' });
      }
      
      const result = await cachedDataService.refreshAll();
      res.json(result);
    } catch (e) {
      logger.error({ e }, 'refresh cache error');
      res.status(500).json({ error: 'REFRESH_FAILED' });
    }
  });

  // Get cache statistics
  app.get('/api/admin/cache-stats', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    
    try {
      const cachedDataService = (req as any).cachedDataService;
      if (!cachedDataService) {
        return res.status(503).json({ error: 'CACHE_SERVICE_UNAVAILABLE' });
      }
      
      const stats = cachedDataService.getStats();
      res.json({ stats });
    } catch (e) {
      logger.error({ e }, 'get cache stats error');
      res.status(500).json({ error: 'GET_STATS_FAILED' });
    }
  });

  // Get all users for admin
  app.get('/api/admin/users', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    
    try {
      const users = await prisma.user.findMany({
        include: {
          scores: true,
          _count: {
            select: { predictions: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ users });
    } catch (e) {
      logger.error({ e }, 'get users error');
      res.status(500).json({ error: 'GET_USERS_FAILED' });
    }
  });

  // Get user's predictions for admin editing
  app.get('/api/admin/users/:userId/predictions', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'USER_ID_REQUIRED' });

    try {
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) return res.status(404).json({ error: 'USER_NOT_FOUND' });

      const predictions = await prisma.prediction.findMany({
        where: { userId },
        include: { match: true },
        orderBy: { match: { kickoffAt: 'asc' } }
      });

      const matches = await prisma.match.findMany({
        orderBy: { kickoffAt: 'asc' }
      });

      res.json({ user: targetUser, predictions, matches });
    } catch (e) {
      logger.error({ e }, 'get user predictions error');
      res.status(500).json({ error: 'GET_PREDICTIONS_FAILED' });
    }
  });

  // Create or update prediction for user (admin only)
  app.post('/api/admin/users/:userId/predictions', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    
    const { userId } = req.params;
    const { matchId, predHome, predAway } = req.body || {};
    
    if (!userId || !matchId || typeof predHome !== 'number' || typeof predAway !== 'number') {
      return res.status(400).json({ error: 'BAD_INPUT' });
    }

    try {
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) return res.status(404).json({ error: 'USER_NOT_FOUND' });

      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });

      // Save current prediction to history if exists
      const existing = await prisma.prediction.findUnique({ 
        where: { userId_matchId: { userId, matchId } } 
      });
      
      if (existing) {
        await prisma.predictionHistory.create({
          data: {
            userId,
            matchId,
            predHome: existing.predHome,
            predAway: existing.predAway,
          },
        });
      }

      // Create or update prediction
      const prediction = await prisma.prediction.upsert({
        where: { userId_matchId: { userId, matchId } },
        create: { userId, matchId, predHome, predAway },
        update: { predHome, predAway },
        include: { match: true }
      });

      // Update firstPredAt for tie-break if needed
      await prisma.score.upsert({
        where: { userId },
        create: { userId, firstPredAt: new Date() },
        update: {
          firstPredAt: !existing ? new Date() : undefined,
        },
      });

      res.json({ prediction });
    } catch (e) {
      logger.error({ e }, 'admin update prediction error');
      res.status(500).json({ error: 'UPDATE_PREDICTION_FAILED' });
    }
  });

  // Delete prediction for user (admin only)
  app.delete('/api/admin/users/:userId/predictions/:matchId', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    
    const { userId, matchId } = req.params;
    
    if (!userId || !matchId) {
      return res.status(400).json({ error: 'BAD_INPUT' });
    }

    try {
      const existing = await prisma.prediction.findUnique({ 
        where: { userId_matchId: { userId, matchId } } 
      });
      
      if (!existing) return res.status(404).json({ error: 'PREDICTION_NOT_FOUND' });

      // Save to history before deleting
      await prisma.predictionHistory.create({
        data: {
          userId,
          matchId,
          predHome: existing.predHome,
          predAway: existing.predAway,
        },
      });

      await prisma.prediction.delete({
        where: { userId_matchId: { userId, matchId } }
      });

      res.json({ success: true });
    } catch (e) {
      logger.error({ e }, 'admin delete prediction error');
      res.status(500).json({ error: 'DELETE_PREDICTION_FAILED' });
    }
  });

  // Delete single user (admin only)
  app.delete('/api/admin/users/:userId', async (req: Request, res: Response) => {
    const user = (req as any).authUser;
    if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: 'FORBIDDEN' });
    
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'USER_ID_REQUIRED' });
    }

    // Prevent admin from deleting themselves
    if (userId === user.id) {
      return res.status(400).json({ error: 'CANNOT_DELETE_SELF' });
    }

    try {
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) return res.status(404).json({ error: 'USER_NOT_FOUND' });

      // Delete all dependent records (cascade delete)
      await prisma.predictionHistory.deleteMany({ where: { userId } });
      await prisma.prediction.deleteMany({ where: { userId } });
      await prisma.score.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });

      logger.info({ userId, deletedUser: targetUser.name }, 'User deleted by admin');
      res.json({ success: true, deletedUser: targetUser.name });
    } catch (e) {
      logger.error({ e }, 'admin delete user error');
      res.status(500).json({ error: 'DELETE_USER_FAILED' });
    }
  });
}


