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
  user?: any
): Promise<Response> {
  try {
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
      
      if (!cachedDataService) {
        return new Response(JSON.stringify({ error: 'Cache service not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
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
        const { scoreHome, scoreAway, status, kickoffAt } = body || {};
        
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
                             scoreHome !== null && scoreAway !== null && 
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
