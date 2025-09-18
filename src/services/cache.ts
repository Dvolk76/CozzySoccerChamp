import type { PrismaClient } from '@prisma/client';
import { syncChampionsLeague } from './footballData.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CachedData {
  matches: any[];
  leaderboard: any[];
}

class DataCache {
  private cache = new Map<string, CacheEntry<any>>();
  private refreshTimers = new Map<string, NodeJS.Timeout>();
  private isRefreshing = new Map<string, boolean>();
  
  constructor(
    private prisma: PrismaClient,
    private logger: { info: Function; warn: Function; error: Function }
  ) {}

  /**
   * Get cached data or fetch if expired
   */
  async get<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = 60000): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();

    // Return cached data if still valid
    if (entry && (now - entry.timestamp) < entry.ttl) {
      this.logger.info({ key, age: now - entry.timestamp }, 'Cache hit');
      return entry.data;
    }

    // Prevent multiple simultaneous fetches of the same data
    if (this.isRefreshing.get(key)) {
      this.logger.info({ key }, 'Already refreshing, waiting...');
      // Wait a bit and try again (simple backoff)
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.get(key, fetcher, ttlMs);
    }

    this.logger.info({ key }, 'Cache miss, fetching fresh data');
    this.isRefreshing.set(key, true);

    try {
      const data = await fetcher();
      this.cache.set(key, {
        data,
        timestamp: now,
        ttl: ttlMs
      });

      // Set up auto-refresh timer
      this.setupAutoRefresh(key, fetcher, ttlMs);
      
      return data;
    } catch (error) {
      this.logger.error({ key, error }, 'Failed to fetch data');
      
      // Return stale data if available rather than throwing
      if (entry) {
        this.logger.warn({ key }, 'Returning stale data due to fetch error');
        return entry.data;
      }
      
      throw error;
    } finally {
      this.isRefreshing.set(key, false);
    }
  }

  /**
   * Setup automatic refresh for cached data
   */
  private setupAutoRefresh<T>(key: string, fetcher: () => Promise<T>, ttlMs: number) {
    // Clear existing timer if any
    const existingTimer = this.refreshTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer to refresh data before it expires
    const refreshInterval = Math.max(ttlMs * 0.9, 30000); // Refresh at 90% of TTL or min 30s
    const timer = setTimeout(async () => {
      try {
        this.logger.info({ key }, 'Auto-refreshing cached data');
        const data = await fetcher();
        this.cache.set(key, {
          data,
          timestamp: Date.now(),
          ttl: ttlMs
        });
        
        // Schedule next refresh
        this.setupAutoRefresh(key, fetcher, ttlMs);
      } catch (error) {
        this.logger.error({ key, error }, 'Auto-refresh failed');
        // Try again in a shorter interval
        setTimeout(() => this.setupAutoRefresh(key, fetcher, ttlMs), 10000);
      }
    }, refreshInterval);

    this.refreshTimers.set(key, timer);
  }

  /**
   * Manually invalidate cache entry
   */
  invalidate(key: string) {
    this.cache.delete(key);
    const timer = this.refreshTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(key);
    }
    this.logger.info({ key }, 'Cache invalidated');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats: Record<string, any> = {};
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      stats[key] = {
        age: now - entry.timestamp,
        ttl: entry.ttl,
        expired: (now - entry.timestamp) >= entry.ttl
      };
    }
    
    return stats;
  }

  /**
   * Clear all cache and timers
   */
  clear() {
    this.cache.clear();
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();
    this.isRefreshing.clear();
    this.logger.info('Cache cleared');
  }
}

// Global cache instance
let cacheInstance: DataCache | null = null;

export function initializeCache(prisma: PrismaClient, logger: { info: Function; warn: Function; error: Function }) {
  if (!cacheInstance) {
    cacheInstance = new DataCache(prisma, logger);
  }
  return cacheInstance;
}

export function getCache(): DataCache {
  if (!cacheInstance) {
    throw new Error('Cache not initialized. Call initializeCache first.');
  }
  return cacheInstance;
}

// Specific cached data fetchers
export class CachedDataService {
  constructor(
    private cache: DataCache,
    private prisma: PrismaClient,
    private logger: { info: Function; warn: Function; error: Function },
    private env?: any
  ) {}

  /**
   * Get cached matches with 1-minute TTL
   */
  async getMatches() {
    return this.cache.get(
      'matches',
      async () => {
        this.logger.info('Fetching fresh matches from database');
        return await this.prisma.match.findMany({ 
          orderBy: { kickoffAt: 'asc' } 
        });
      },
      60000 // 1 minute TTL
    );
  }

  /**
   * Get cached leaderboard with 1-minute TTL
   */
  async getLeaderboard() {
    return this.cache.get(
      'leaderboard',
      async () => {
        this.logger.info('Calculating fresh leaderboard');
        
        // Get all users with their prediction counts and scores
        const users = await this.prisma.user.findMany({
          include: {
            predictions: {
              include: {
                match: true
              }
            }
          }
        });

        // Calculate leaderboard
        const leaderboard = users.map(user => {
          const predictions = user.predictions;
          let totalScore = 0;
          let correctPredictions = 0;
          let exactScores = 0;

          predictions.forEach(prediction => {
            if (prediction.match.status === 'FINISHED' && 
                prediction.match.scoreHome !== null && 
                prediction.match.scoreAway !== null) {
              
              const actualHome = prediction.match.scoreHome;
              const actualAway = prediction.match.scoreAway;
              const predHome = prediction.predHome;
              const predAway = prediction.predAway;

              // Exact score: 3 points
              if (predHome === actualHome && predAway === actualAway) {
                totalScore += 3;
                exactScores++;
                correctPredictions++;
              }
              // Correct outcome (win/draw/loss): 1 point
              else if (
                (predHome > predAway && actualHome > actualAway) ||
                (predHome < predAway && actualHome < actualAway) ||
                (predHome === predAway && actualHome === actualAway)
              ) {
                totalScore += 1;
                correctPredictions++;
              }
            }
          });

          return {
            id: user.id,
            user: {
              id: user.id,
              name: user.name,
              tg_user_id: user.tg_user_id,
              role: user.role
            },
            pointsTotal: totalScore,
            exactCount: exactScores,
            diffCount: correctPredictions - exactScores, // correct predictions that aren't exact
            outcomeCount: 0, // we don't track this separately in our simplified logic
            firstPredAt: null // we'd need to calculate this from predictions
          };
        });

        // Sort by score (descending), then by correct predictions, then by exact scores
        leaderboard.sort((a, b) => {
          if (a.pointsTotal !== b.pointsTotal) return b.pointsTotal - a.pointsTotal;
          if (a.exactCount !== b.exactCount) return b.exactCount - a.exactCount;
          return b.diffCount - a.diffCount;
        });

        return leaderboard;
      },
      60000 // 1 minute TTL
    );
  }

  /**
   * Sync matches from external API with rate limiting protection
   */
  async syncMatchesFromAPI(season?: number) {
    const currentSeason = season || 2025; // Current Champions League season 2025-26
    const cacheKey = `api_sync_${currentSeason}`;
    
    return this.cache.get(
      cacheKey,
      async () => {
        this.logger.info({ season: currentSeason }, 'Syncing matches from external API');
        
        try {
          const result = await syncChampionsLeague(this.prisma, currentSeason, this.env);
          
          // Invalidate matches cache after API sync
          this.cache.invalidate('matches');
          this.cache.invalidate('leaderboard');
          
          return result;
        } catch (error) {
          this.logger.error({ error, season: currentSeason }, 'Failed to sync from API');
          throw error;
        }
      },
      60000 // 1 minute TTL - respects API rate limit
    );
  }

  /**
   * Force refresh all cached data
   */
  async refreshAll() {
    this.logger.info('Force refreshing all cached data');
    
    this.cache.invalidate('matches');
    this.cache.invalidate('leaderboard');
    
    // Fetch fresh data
    const [matches, leaderboard] = await Promise.all([
      this.getMatches(),
      this.getLeaderboard()
    ]);
    
    return { matches: matches.length, leaderboard: leaderboard.length };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }
}
