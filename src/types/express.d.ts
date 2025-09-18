import '@types/express';
import type { CachedDataService } from '../services/cache.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: import('@prisma/client').User;
      cachedDataService?: CachedDataService;
    }
  }
}

export {};


