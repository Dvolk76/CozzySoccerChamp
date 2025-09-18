// Адаптеры routes для Cloudflare Workers
import type { PrismaClient } from '@prisma/client';

type Logger = { info: Function; warn: Function; error: Function };

// Matches handler - адаптация из index.ts
export async function matchesHandler(
  request: Request, 
  env: any, 
  logger: Logger,
  cachedDataService?: any,
  user?: any
): Promise<Response> {
  const url = new URL(request.url);
  
  try {
    if (!cachedDataService) {
      return new Response(JSON.stringify({ error: 'Cache service not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const matches = await cachedDataService.getMatches();
    
    // If user is authenticated, include their predictions
    if (user) {
      // We don't have prisma directly here, need to use cachedDataService or get it from env
      // For now, return matches without user predictions in workers context
      // TODO: Add user predictions support to cachedDataService
      return new Response(JSON.stringify({ matches }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ matches }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
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
  user?: any
): Promise<Response> {
  try {
    if (!user) {
      return new Response(JSON.stringify({ error: 'NO_AUTH' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      const body = await request.json() as any;
      const { matchId, predHome, predAway } = body || {};
      
      if (!matchId || typeof predHome !== 'number' || typeof predAway !== 'number') {
        return new Response(JSON.stringify({ error: 'BAD_INPUT' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // TODO: Implement prediction creation logic with direct Prisma access
      return new Response(JSON.stringify({ 
        message: 'Prediction creation not yet implemented in workers',
        matchId,
        predHome,
        predAway,
        user: user.name
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
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
  user?: any
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
