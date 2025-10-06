import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import pino from 'pino';
import { initDataAuth } from './telegram/initDataAuth-worker.js';
import { initializeCache, CachedDataService } from './services/cache.js';

// Types for Cloudflare Workers environment
export interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  FOOTBALL_API_TOKEN: string;
  CORS_ORIGIN: string;
  NODE_ENV: string;
  LOG_LEVEL: string;
  PAGES_HOST?: string; // e.g. 14309aa5.cozzysoccerchamp.pages.dev
}

// Create logger for Workers environment
const createLogger = (env: Env) => {
  return pino({ 
    level: env.LOG_LEVEL || 'info',
    // Use console transport for Workers
    browser: {
      write: {
        info: console.log,
        error: console.error,
        warn: console.warn,
        debug: console.debug,
      }
    }
  });
};

// Initialize Prisma with D1 adapter
const createPrismaClient = (env: Env) => {
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter } as any);
};

// CORS headers for Workers
const getCorsHeaders = (origin: string | null, allowedOrigins: string[]) => {
  const isAllowed = !allowedOrigins.length || 
    allowedOrigins.includes('*') || 
    (origin && allowedOrigins.includes(origin));

  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data',
    'Access-Control-Allow-Credentials': 'true',
  };
};

// Handle preflight requests
const handleOptions = (request: Request, env: Env) => {
  const origin = request.headers.get('Origin');
  const allowedOrigins = env.CORS_ORIGIN?.split(',') || ['*'];
  const corsHeaders = getCorsHeaders(origin, allowedOrigins);

  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
};

// Global cache and services for Workers persistence
let globalPrisma: any = null;
let globalCache: any = null;
let globalCachedDataService: any = null;
let globalLastApiSyncAtMs: number = 0;
let globalIsApiSyncInProgress: boolean = false;
let globalSyncStartTime: number = 0;

// Main request handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const logger = createLogger(env);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    try {
      // Reuse global instances for performance and state persistence
      if (!globalPrisma) {
        globalPrisma = createPrismaClient(env);
      }
      if (!globalCache) {
        globalCache = initializeCache(globalPrisma, logger);
      }
      if (!globalCachedDataService) {
        globalCachedDataService = new CachedDataService(globalCache, globalPrisma, logger, env);
      }

      const prisma = globalPrisma;
      const cache = globalCache;
      const cachedDataService = globalCachedDataService;

      // Add CORS headers to all responses
      const origin = request.headers.get('Origin');
      const allowedOrigins = env.CORS_ORIGIN?.split(',') || ['*'];
      const corsHeaders = getCorsHeaders(origin, allowedOrigins);

      // Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // API routes
      if (url.pathname.startsWith('/api/')) {
        // Telegram auth for API routes
        const authFunction = await initDataAuth(prisma, logger, env);
        const authResult = await authFunction(request);
        if (authResult instanceof Response) {
          // Auth failed, return error response with CORS headers
          const response = new Response(authResult.body, {
            status: authResult.status,
            headers: {
              ...Object.fromEntries(authResult.headers.entries()),
              ...corsHeaders,
            },
          });
          return response;
        }

        // Best-effort background sync before handling API route
        try {
          const now = Date.now();
          const timeSinceLastSync = now - globalLastApiSyncAtMs;
          const timeSinceSyncStarted = now - globalSyncStartTime;
          
          // Reset stuck sync flag if it's been more than 30 seconds
          if (globalIsApiSyncInProgress && timeSinceSyncStarted > 30000) {
            logger.warn({ timeSinceSyncStarted }, '[Worker] Resetting stuck sync flag');
            globalIsApiSyncInProgress = false;
          }
          
          const shouldTriggerSync = timeSinceLastSync > 60000 && !globalIsApiSyncInProgress;
          
          logger.info({ 
            timeSinceLastSync, 
            shouldTriggerSync, 
            globalIsApiSyncInProgress,
            timeSinceSyncStarted
          }, '[Worker] Background sync check');
          
          if (shouldTriggerSync) {
            logger.info('[Worker] Triggering background API sync...');
            globalIsApiSyncInProgress = true;
            globalSyncStartTime = now;
            
            // Fire and forget background sync
            cachedDataService
              .syncMatchesFromAPI(new Date().getFullYear())
              .then((result: any) => {
                globalLastApiSyncAtMs = Date.now();
                logger.info({ count: result?.count }, '[Worker] Background API sync completed');
              })
              .catch((err: any) => {
                logger.error({ err: err?.message || err }, '[Worker] Background API sync failed');
              })
              .finally(() => {
                globalIsApiSyncInProgress = false;
                globalSyncStartTime = 0;
              });
          }
        } catch (e: any) {
          logger.error({ e: e?.message || e }, '[Worker] Failed to trigger background sync');
        }

        // Route handling with context
        return await handleApiRoute(request, env, logger, corsHeaders, cachedDataService, authResult.user, prisma);
      }

      // Default: proxy static assets from Cloudflare Pages to bypass ISP blocks
      const pagesHost = env.PAGES_HOST;
      if (pagesHost) {
        const targetUrl = new URL(request.url);
        targetUrl.hostname = pagesHost;
        targetUrl.protocol = 'https:';
        const proxied = await fetch(targetUrl.toString(), {
          headers: {
            'User-Agent': request.headers.get('User-Agent') || '',
            'Accept': request.headers.get('Accept') || '*/*',
          },
          cf: { cacheEverything: true },
        });
        // Stream response with CORS
        return new Response(proxied.body, {
          status: proxied.status,
          headers: {
            ...Object.fromEntries(proxied.headers.entries()),
            ...corsHeaders,
          },
        });
      }

      return new Response('Static files are served by Cloudflare Pages', {
        headers: {
          'Content-Type': 'text/plain',
          ...corsHeaders,
        },
      });

    } catch (error) {
      logger.error({ error }, 'Request handling failed');
      
      const origin = request.headers.get('Origin');
      const allowedOrigins = env.CORS_ORIGIN?.split(',') || ['*'];
      const corsHeaders = getCorsHeaders(origin, allowedOrigins);

      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  },
};

// Handle API routes
async function handleApiRoute(
  request: Request,
  env: Env,
  logger: any,
  corsHeaders: Record<string, string>,
  cachedDataService: CachedDataService,
  user: any,
  prisma: any
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Import route handlers 
  const { 
    matchesHandler,
    predictionsHandler,
    leaderboardHandler,
    adminHandler,
    recalcHandler
  } = await import('./routes/worker-adapters.js');

  try {
    let response: Response;

    if (path === '/api/me') {
      // Return current user info
      response = new Response(JSON.stringify({ user }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (path.startsWith('/api/matches')) {
      response = await matchesHandler(request, env, logger, cachedDataService, user, prisma);
    } else if (path.startsWith('/api/predictions')) {
      response = await predictionsHandler(request, env, logger, cachedDataService, user, prisma);
    } else if (path.startsWith('/api/leaderboard')) {
      response = await leaderboardHandler(request, env, logger, cachedDataService, user);
    } else if (path.startsWith('/api/admin')) {
      response = await adminHandler(request, env, logger, cachedDataService, user, prisma);
    } else if (path.startsWith('/api/recalc')) {
      response = await recalcHandler(request, env, logger, cachedDataService, user);
    } else {
      response = new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add CORS headers to response
    const responseWithCors = new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders,
      },
    });

    return responseWithCors;

  } catch (error) {
    logger.error({ error, path }, 'API route handler failed');
    
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}
