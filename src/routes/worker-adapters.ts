// Адаптеры routes для Cloudflare Workers
import type { PrismaClient } from '@prisma/client';

type Logger = { info: Function; warn: Function; error: Function };

// Matches handler - адаптация из index.ts
export async function matchesHandler(
  request: Request, 
  env: any, 
  logger: Logger,
  cachedDataService?: any,
  user?: any,
  prisma?: PrismaClient
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    // Handle /api/matches/:id/predictions
    if (path.match(/^\/api\/matches\/[^\/]+\/predictions$/)) {
      if (!user) {
        return new Response(JSON.stringify({ error: 'NO_AUTH' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const matchId = path.split('/')[3];
      const match = await prisma.match.findUnique({ where: { id: matchId } });
      if (!match) {
        return new Response(JSON.stringify({ error: 'MATCH_NOT_FOUND' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const now = new Date();
      const kickoffAt = new Date(match.kickoffAt as any);
      if (now < kickoffAt) {
        return new Response(JSON.stringify({ error: 'LOCKED' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const predictions = await prisma.prediction.findMany({
        where: { matchId },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      });

      const hasActual = match.scoreHome != null && match.scoreAway != null;
      const actual = hasActual ? { home: match.scoreHome as number, away: match.scoreAway as number } : undefined;

      // Import scoring function
      const { scoring } = await import('../services/scoring.js');
      
      const items = predictions.map((p: any) => {
        const pts = actual ? scoring({ home: p.predHome, away: p.predAway }, actual) : 0;
        return {
          userId: p.userId,
          name: p.user?.name,
          tg_user_id: p.user?.tg_user_id,
          predHome: p.predHome,
          predAway: p.predAway,
          points: pts,
          createdAt: p.createdAt,
        };
      });

      // Sort by live points desc, then by createdAt asc as a stable secondary key
      items.sort((a: any, b: any) => (b.points - a.points) || (a.createdAt as any).valueOf() - (b.createdAt as any).valueOf());

      return new Response(JSON.stringify({
        match: {
          id: match.id,
          scoreHome: match.scoreHome,
          scoreAway: match.scoreAway,
          kickoffAt: match.kickoffAt,
          status: match.status,
        },
        predictions: items,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!cachedDataService) {
      return new Response(JSON.stringify({ error: 'Cache service not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const matches = await cachedDataService.getMatches();

    // If user is authenticated and DB available, include their predictions
    if (user && prisma) {
      try {
        const userPredictions = await (prisma as any).prediction.findMany({
          where: { userId: user.id },
          select: { matchId: true, predHome: true, predAway: true }
        });

        const predictionsMap = userPredictions.reduce((acc: Record<string, { predHome: number; predAway: number }>, p: any) => {
          acc[p.matchId] = { predHome: p.predHome, predAway: p.predAway };
          return acc;
        }, {} as Record<string, { predHome: number; predAway: number }>);

        const matchesWithPredictions = matches.map((match: any) => ({
          ...match,
          userPrediction: predictionsMap[match.id] || null,
        }));

        return new Response(JSON.stringify({ matches: matchesWithPredictions }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        logger.warn({ e }, 'Failed to include user predictions');
        // Fallback to matches without user predictions
      }
    }

    return new Response(JSON.stringify({ matches }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get matches');
    return new Response(JSON.stringify({ error: 'Failed to get matches' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function predictionsHandler(
  request: Request, 
  env: any, 
  logger: Logger,
  cachedDataService?: any,
  user?: any,
  prisma?: any
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle GET /api/predictions/:userId/:matchId/history
    if (path.match(/^\/api\/predictions\/[^\/]+\/[^\/]+\/history$/) && request.method === 'GET') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const pathParts = path.split('/');
      const targetUserId = pathParts[3];
      const matchId = pathParts[4];

      try {
        // Get user info
        const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) {
          return new Response(JSON.stringify({ error: 'USER_NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Get match info
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match) {
          return new Response(JSON.stringify({ error: 'MATCH_NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Get prediction history
        const history = await prisma.predictionHistory.findMany({
          where: {
            userId: targetUserId,
            matchId: matchId
          },
          orderBy: { createdAt: 'asc' }
        });

        // Get current prediction
        const current = await prisma.prediction.findUnique({
          where: {
            userId_matchId: {
              userId: targetUserId,
              matchId: matchId
            }
          }
        });

        return new Response(JSON.stringify({
          user: {
            id: targetUser.id,
            name: targetUser.name,
            avatar: targetUser.avatar
          },
          match: {
            id: match.id,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            kickoffAt: match.kickoffAt
          },
          history: history.map((h: any) => ({
            predHome: h.predHome,
            predAway: h.predAway,
            createdAt: h.createdAt
          })),
          current: current ? {
            predHome: current.predHome,
            predAway: current.predAway,
            createdAt: current.createdAt
          } : null,
          totalChanges: history.length
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        logger.error({ error }, 'Failed to get prediction history');
        return new Response(JSON.stringify({ error: 'FAILED_TO_GET_HISTORY' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'NO_AUTH' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json() as any;
      const { matchId, predHome, predAway } = body || {};
      
      if (!matchId || typeof predHome !== 'number' || typeof predAway !== 'number') {
        return new Response(JSON.stringify({ error: 'BAD_INPUT' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        // Check if match exists and is not locked
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match) {
          return new Response(JSON.stringify({ error: 'MATCH_NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (new Date() >= new Date(match.kickoffAt)) {
          return new Response(JSON.stringify({ error: 'LOCKED' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Save current prediction to history if exists
        const existing = await prisma.prediction.findUnique({ 
          where: { userId_matchId: { userId: user.id, matchId } } 
        });
        
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

        // Create or update prediction
        const prediction = await prisma.prediction.upsert({
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

        return new Response(JSON.stringify({ prediction }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        logger.error({ error }, 'Failed to create prediction');
        return new Response(JSON.stringify({ error: 'PREDICTION_CREATION_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ 
      message: 'Predictions endpoint',
      method: request.method,
      user: user?.name || 'anonymous'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to handle predictions');
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function leaderboardHandler(
  request: Request, 
  env: any, 
  logger: Logger,
  cachedDataService?: any,
  user?: any,
  prisma?: PrismaClient
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Handle /api/leaderboard/by-rounds
    if (path === '/api/leaderboard/by-rounds') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      logger.info('Fetching historical leaderboard by rounds');

      // Получаем все завершенные матчи с прогнозами
      const matches = await prisma.match.findMany({
        where: {
          matchday: { not: null },
          status: 'FINISHED',
          scoreHome: { not: null },
          scoreAway: { not: null }
        },
        include: {
          predictions: {
            include: {
              user: true
            }
          }
        },
        orderBy: { matchday: 'asc' }
      });

      // Группируем матчи по турам
      const matchesByRound = new Map<number, typeof matches>();
      matches.forEach(match => {
        if (match.matchday !== null) {
          if (!matchesByRound.has(match.matchday)) {
            matchesByRound.set(match.matchday, []);
          }
          matchesByRound.get(match.matchday)!.push(match);
        }
      });

      // Import scoring function
      const { scoring } = await import('../services/scoring.js');

      // Вычисляем очки для каждого тура
      const roundsData: Array<{
        round: number;
        leaderboard: Array<{
          userId: string;
          userName: string;
          userAvatar?: string;
          points: number;
          exactCount: number;
          diffCount: number;
          outcomeCount: number;
          cumulativePoints: number;
        }>;
      }> = [];

      const cumulativeScores = new Map<string, number>();

      const sortedRounds = Array.from(matchesByRound.keys()).sort((a, b) => a - b);

      for (const round of sortedRounds) {
        const roundMatches = matchesByRound.get(round)!;
        
        // Подсчет очков за текущий тур
        const userScores = new Map<string, {
          userId: string;
          userName: string;
          userAvatar?: string;
          points: number;
          exactCount: number;
          diffCount: number;
          outcomeCount: number;
        }>();

        roundMatches.forEach(match => {
          if (match.scoreHome !== null && match.scoreAway !== null) {
            const actual = { home: match.scoreHome, away: match.scoreAway };

            match.predictions.forEach((pred: any) => {
              if (!userScores.has(pred.userId)) {
                userScores.set(pred.userId, {
                  userId: pred.userId,
                  userName: pred.user.name,
                  userAvatar: pred.user.avatar || undefined,
                  points: 0,
                  exactCount: 0,
                  diffCount: 0,
                  outcomeCount: 0
                });
              }

              const score = userScores.get(pred.userId)!;
              const points = scoring(
                { home: pred.predHome, away: pred.predAway },
                actual
              );

              score.points += points;
              if (points === 5) score.exactCount++;
              else if (points === 3) score.diffCount++;
              else if (points === 2) score.outcomeCount++;
            });
          }
        });

        // Обновляем кумулятивные очки
        userScores.forEach(score => {
          const current = cumulativeScores.get(score.userId) || 0;
          cumulativeScores.set(score.userId, current + score.points);
        });

        // Формируем лидерборд для тура
        const roundLeaderboard = Array.from(userScores.values()).map(score => ({
          ...score,
          cumulativePoints: cumulativeScores.get(score.userId) || 0
        })).sort((a, b) => {
          // Сортируем по очкам за тур
          if (b.points !== a.points) return b.points - a.points;
          if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
          if (b.diffCount !== a.diffCount) return b.diffCount - a.diffCount;
          return b.outcomeCount - a.outcomeCount;
        });

        roundsData.push({
          round,
          leaderboard: roundLeaderboard
        });
      }

      return new Response(JSON.stringify({ rounds: roundsData }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle /api/leaderboard (default)
    if (!cachedDataService) {
      return new Response(JSON.stringify({ error: 'Cache service not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const leaderboard = await cachedDataService.getLeaderboard();
    return new Response(JSON.stringify({ leaderboard }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get leaderboard');
    return new Response(JSON.stringify({ error: 'Failed to get leaderboard' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function adminHandler(
  request: Request, 
  env: any, 
  logger: Logger,
  cachedDataService?: any,
  user?: any,
  prisma?: any
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
  
    // Handle claim admin BEFORE admin permission check (requires only auth)
    if (path === '/api/admin/claim' && request.method === 'POST') {
      logger.info({ event: 'claim_attempt', userId: user?.id, hasUser: !!user }, 'Admin claim attempt');
      if (!user) {
        return new Response(JSON.stringify({ error: 'NO_AUTH' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        const body = await request.json() as any;
        const password = body?.password;
        logger.info({ event: 'claim_body', hasPassword: !!password, len: typeof password === 'string' ? password.length : undefined });
        if (password !== 'Kukuruza') {
          return new Response(JSON.stringify({ error: 'BAD_PASSWORD' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const updated = await (prisma as any).user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
        logger.info({ event: 'claim_success', userId: user.id }, 'Admin claim success');
        return new Response(JSON.stringify({ user: updated }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error, userId: user.id }, 'Failed to claim admin');
        return new Response(JSON.stringify({ error: 'CLAIM_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Check admin permissions for all other admin endpoints
    if (!user || user.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle different admin endpoints
    if (path === '/api/admin/sync' && request.method === 'POST') {
      const body = await request.json() as any;
      const season = Number(body?.season) || 2025; // Current Champions League season 2025-26
      const force = body?.force === true;
      
      if (!cachedDataService) {
        return new Response(JSON.stringify({ error: 'Cache service not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Force parameter is now always respected (no cache on syncMatchesFromAPI)
      if (force) {
        logger.info({ season, force }, 'Force sync requested');
      }
      
      const result = await cachedDataService.syncMatchesFromAPI(season);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/api/admin/refresh-cache' && request.method === 'POST') {
      if (!cachedDataService) {
        return new Response(JSON.stringify({ error: 'Cache service not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const result = await cachedDataService.refreshAll();
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Recalculate scores for a specific match
    if (path.match(/^\/api\/admin\/recalc\/[^\/]+$/) && request.method === 'POST') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        const pathParts = path.split('/');
        const matchId = pathParts[4]; // /api/admin/recalc/{matchId}
        const { recalcForMatch } = await import('../services/recalc.js');
        const result = await recalcForMatch(prisma as unknown as PrismaClient, matchId, cachedDataService);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to recalc for match');
        return new Response(JSON.stringify({ error: 'RECALC_MATCH_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Recalculate scores for all finished matches
    if (path === '/api/admin/recalc-all' && request.method === 'POST') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        const { recalcAll } = await import('../services/recalc.js');
        const result = await recalcAll(prisma as unknown as PrismaClient, cachedDataService);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to recalc all');
        return new Response(JSON.stringify({ error: 'RECALC_ALL_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (path === '/api/admin/cache-stats' && request.method === 'GET') {
      if (!cachedDataService) {
        return new Response(JSON.stringify({ error: 'Cache service not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const stats = cachedDataService.getStats();
      return new Response(JSON.stringify({ stats }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/api/admin/users' && request.method === 'GET') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
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
        return new Response(JSON.stringify({ users }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get users');
        return new Response(JSON.stringify({ error: 'Failed to get users' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/admin/teams - Get unique list of teams from matches
    if (path === '/api/admin/teams' && request.method === 'GET') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const matches = await prisma.match.findMany({ select: { homeTeam: true, awayTeam: true } });
        const set = new Set<string>();
        for (const m of matches) {
          if (m.homeTeam) set.add(m.homeTeam);
          if (m.awayTeam) set.add(m.awayTeam);
        }
        const teams = Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
        return new Response(JSON.stringify({ teams }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get teams');
        return new Response(JSON.stringify({ error: 'GET_TEAMS_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/admin/users/:userId/picks - Get user's tournament picks
    if (path.match(/^\/api\/admin\/users\/[^\/]+\/picks$/) && request.method === 'GET') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const pathParts = path.split('/');
        const userId = pathParts[4];
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'USER_ID_REQUIRED' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const u = await prisma.user.findUnique({ where: { id: userId } });
        if (!u) {
          return new Response(JSON.stringify({ error: 'USER_NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ 
          userId, 
          championPick: (u as any).championPick ?? null, 
          topScorerPick: (u as any).topScorerPick ?? null 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get picks');
        return new Response(JSON.stringify({ error: 'GET_PICKS_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /api/admin/users/:userId/picks - Set user's tournament picks
    if (path.match(/^\/api\/admin\/users\/[^\/]+\/picks$/) && request.method === 'POST') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const pathParts = path.split('/');
        const userId = pathParts[4];
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'USER_ID_REQUIRED' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const body = await request.json() as any;
        const { championPick, topScorerPick } = body || {};

        const u = await prisma.user.update({
          where: { id: userId },
          data: {
            championPick: typeof championPick === 'string' ? championPick : undefined,
            topScorerPick: typeof topScorerPick === 'string' ? topScorerPick : undefined,
          }
        });
        
        return new Response(JSON.stringify({ user: u }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to set picks');
        return new Response(JSON.stringify({ error: 'SET_PICKS_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /api/admin/award-bonuses - Award bonuses at the end of tournament
    if (path === '/api/admin/award-bonuses' && request.method === 'POST') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const body = await request.json() as any;
        const { champion, topScorer, championPoints = 5, topScorerPoints = 5 } = body || {};
        
        if (!champion && !topScorer) {
          return new Response(JSON.stringify({ error: 'BAD_INPUT' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const users = await prisma.user.findMany();

        const ops = users.map((u: any) => {
          const championOk = champion && (u as any).championPick && (u as any).championPick === champion;
          const topScorerOk = topScorer && (u as any).topScorerPick && (u as any).topScorerPick === topScorer;
          const bonus = (championOk ? Number(championPoints) : 0) + (topScorerOk ? Number(topScorerPoints) : 0);
          return prisma.score.upsert({
            where: { userId: u.id },
            create: {
              userId: u.id,
              bonusPoints: bonus,
              lastUpdated: new Date()
            },
            update: {
              bonusPoints: bonus,
              lastUpdated: new Date()
            }
          });
        });

        await prisma.$transaction(ops);

        if (cachedDataService) {
          try {
            await cachedDataService.refreshAll();
          } catch (e) {
            logger.warn({ e }, 'Failed to refresh cache after awarding bonuses');
          }
        }

        return new Response(JSON.stringify({ updated: users.length }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to award bonuses');
        return new Response(JSON.stringify({ error: 'AWARD_BONUSES_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Handle user predictions endpoint: /api/admin/users/:userId/predictions
    if (path.match(/^\/api\/admin\/users\/[^\/]+\/predictions$/) && request.method === 'GET') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const pathParts = path.split('/');
        const userId = pathParts[4]; // /api/admin/users/{userId}/predictions
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'USER_ID_REQUIRED' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) {
          return new Response(JSON.stringify({ error: 'USER_NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const predictions = await prisma.prediction.findMany({
          where: { userId },
          include: { match: true },
          orderBy: { match: { kickoffAt: 'asc' } }
        });

        const matches = await prisma.match.findMany({
          orderBy: { kickoffAt: 'asc' }
        });

        return new Response(JSON.stringify({ user: targetUser, predictions, matches }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get user predictions');
        return new Response(JSON.stringify({ error: 'Failed to get user predictions' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle GET /api/admin/matches (get all matches)
    if (path === '/api/admin/matches' && request.method === 'GET') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const matches = await prisma.match.findMany({ orderBy: { kickoffAt: 'asc' } });
        return new Response(JSON.stringify({ matches }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get matches');
        return new Response(JSON.stringify({ error: 'GET_MATCHES_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle PATCH /api/admin/matches/:id (update match score)
    if (path.match(/^\/api\/admin\/matches\/[^\/]+$/) && request.method === 'PATCH') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const pathParts = path.split('/');
        const matchId = pathParts[4]; // /api/admin/matches/{matchId}
        
        if (!matchId) {
          return new Response(JSON.stringify({ error: 'MATCH_ID_REQUIRED' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const body = await request.json() as any;
        let { scoreHome, scoreAway, status, kickoffAt } = body || {};
        
        // ВАЖНО: Если есть полный счет (оба значения не null), автоматически устанавливаем статус FINISHED
        const hasFullScore = scoreHome != null && scoreAway != null;
        if (hasFullScore && status !== 'FINISHED') {
          status = 'FINISHED';
          logger.info({ matchId, scoreHome, scoreAway }, 'Auto-setting status to FINISHED due to full score');
        }
        
        // Get the match before updating to check if scores changed
        const oldMatch = await prisma.match.findUnique({ where: { id: matchId } });
        
        const match = await prisma.match.update({
          where: { id: matchId },
          data: {
            scoreHome,
            scoreAway,
            status,
            kickoffAt: kickoffAt ? new Date(kickoffAt) : undefined,
          },
        });

        // If scores were updated and match is finished, recalculate points
        const scoresChanged = (oldMatch?.scoreHome !== scoreHome || oldMatch?.scoreAway !== scoreAway) && 
                             scoreHome != null && scoreAway != null && 
                             (status === 'FINISHED' || match.status === 'FINISHED');
        
        if (scoresChanged) {
          try {
            const { recalcForMatch } = await import('../services/recalc.js');
            await recalcForMatch(prisma, matchId, cachedDataService);
          } catch (error) {
            logger.error({ error, matchId }, 'Failed to recalculate scores after match update');
            // Don't fail the request, just log the error
          }
        }

        return new Response(JSON.stringify({ match }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error, matchId: path.split('/')[4] }, 'Failed to update match');
        return new Response(JSON.stringify({ error: 'UPDATE_MATCH_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle POST /api/admin/users/:userId/predictions (create or update prediction)
    if (path.match(/^\/api\/admin\/users\/[^\/]+\/predictions$/) && request.method === 'POST') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const pathParts = path.split('/');
        const userId = pathParts[4]; // /api/admin/users/{userId}/predictions
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'USER_ID_REQUIRED' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const body = await request.json() as any;
        const { matchId, predHome, predAway } = body || {};
        
        if (!matchId || typeof predHome !== 'number' || typeof predAway !== 'number') {
          return new Response(JSON.stringify({ error: 'BAD_INPUT' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) {
          return new Response(JSON.stringify({ error: 'USER_NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match) {
          return new Response(JSON.stringify({ error: 'MATCH_NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

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

        return new Response(JSON.stringify({ prediction }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to update user prediction');
        return new Response(JSON.stringify({ error: 'UPDATE_PREDICTION_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle DELETE /api/admin/users/:userId/predictions/:matchId
    if (path.match(/^\/api\/admin\/users\/[^\/]+\/predictions\/[^\/]+$/) && request.method === 'DELETE') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const pathParts = path.split('/');
        const userId = pathParts[4]; // /api/admin/users/{userId}/predictions/{matchId}
        const matchId = pathParts[6];
        
        if (!userId || !matchId) {
          return new Response(JSON.stringify({ error: 'BAD_INPUT' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const existing = await prisma.prediction.findUnique({ 
          where: { userId_matchId: { userId, matchId } } 
        });
        
        if (!existing) {
          return new Response(JSON.stringify({ error: 'PREDICTION_NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

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

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to delete user prediction');
        return new Response(JSON.stringify({ error: 'DELETE_PREDICTION_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle DELETE /api/admin/users/:userId (delete single user)
    if (path.match(/^\/api\/admin\/users\/[^\/]+$/) && request.method === 'DELETE') {
      if (!prisma) {
        return new Response(JSON.stringify({ error: 'Database not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const pathParts = path.split('/');
        const userId = pathParts[4]; // /api/admin/users/{userId}
        
        if (!userId) {
          return new Response(JSON.stringify({ error: 'USER_ID_REQUIRED' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Prevent admin from deleting themselves
        if (userId === user.id) {
          return new Response(JSON.stringify({ error: 'CANNOT_DELETE_SELF' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) {
          return new Response(JSON.stringify({ error: 'USER_NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Delete all dependent records (cascade delete)
        await prisma.predictionHistory.deleteMany({ where: { userId } });
        await prisma.prediction.deleteMany({ where: { userId } });
        await prisma.score.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });

        logger.info({ userId, deletedUser: targetUser.name }, 'User deleted by admin');
        return new Response(JSON.stringify({ success: true, deletedUser: targetUser.name }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        logger.error({ error }, 'Failed to delete user');
        return new Response(JSON.stringify({ error: 'DELETE_USER_FAILED' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response(JSON.stringify({ 
      message: 'Admin endpoint not found',
      path,
      method: request.method
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logger.error({ error }, 'Admin handler error');
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function recalcHandler(
  request: Request, 
  env: any, 
  logger: Logger,
  cachedDataService?: any,
  user?: any
): Promise<Response> {
  return new Response(JSON.stringify({ 
    message: 'Recalc endpoint',
    path: new URL(request.url).pathname,
    method: request.method
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function backupHandler(
  request: Request,
  env: any,
  logger: Logger,
  user?: any,
  prisma?: any
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Check admin permissions
    if (!user || user.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Import backup service
    const { createBackup, restoreBackup, cleanupOldBackups } = await import('../services/backup.js');

    // POST /api/backup/create - Create manual backup
    if (path === '/api/backup/create' && request.method === 'POST') {
      try {
        const result = await createBackup(env);
        logger.info({ result }, 'Manual backup created');
        
        return new Response(JSON.stringify({
          message: 'Backup created successfully',
          ...result,
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        logger.error({ error }, 'Backup creation failed');
        return new Response(JSON.stringify({
          success: false,
          error: 'Backup creation failed',
          details: error.message,
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/backup/list - List available backups
    if (path === '/api/backup/list' && request.method === 'GET') {
      try {
        if (!env.BACKUP_BUCKET) {
          return new Response(JSON.stringify({
            error: 'R2 bucket not configured',
          }), {
            status: 501,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const list = await env.BACKUP_BUCKET.list({ prefix: 'backup-' });
        
        const backups = (list.objects || []).map((obj: any) => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
          metadata: obj.customMetadata,
        }));

        return new Response(JSON.stringify({
          success: true,
          backups,
          count: backups.length,
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to list backups');
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to list backups',
          details: error.message,
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /api/backup/restore - Restore from backup
    if (path === '/api/backup/restore' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const { backupKey } = body;

        if (!backupKey) {
          return new Response(JSON.stringify({
            error: 'backupKey is required',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (!env.BACKUP_BUCKET) {
          return new Response(JSON.stringify({
            error: 'R2 bucket not configured',
          }), {
            status: 501,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Load backup from R2
        const object = await env.BACKUP_BUCKET.get(backupKey);
        
        if (!object) {
          return new Response(JSON.stringify({
            error: 'Backup not found',
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const backupData = await object.json();
        
        // Restore data
        const result = await restoreBackup(env, backupData);

        logger.info({ result, backupKey }, 'Database restored from backup');

        return new Response(JSON.stringify({
          message: 'Database restored successfully',
          ...result,
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        logger.error({ error }, 'Restore failed');
        return new Response(JSON.stringify({
          success: false,
          error: 'Restore failed',
          details: error.message,
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      error: 'Backup endpoint not found',
      path,
      method: request.method
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error({ error }, 'Backup handler error');
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Scorers handler - получение топ-10 бомбардиров из Football Data API
export async function scorersHandler(
  request: Request, 
  env: any, 
  logger: Logger
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    // GET /api/scorers
    if (request.method === 'GET' && path === '/api/scorers') {
      const season = parseInt(url.searchParams.get('season') || String(new Date().getFullYear()));
      
      try {
        const { getTopScorers } = await import('../services/footballData.js');
        const scorers = await getTopScorers(season, env);
        
        return new Response(JSON.stringify(scorers), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to get scorers');
        return new Response(JSON.stringify({ 
          error: 'Failed to get scorers',
          details: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      error: 'Scorers endpoint not found',
      path,
      method: request.method
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error({ error }, 'Scorers handler error');
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
