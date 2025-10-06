import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { useDataPolling } from './useAutoRefresh';
import type { Match, RoundLeaderboard } from '../types';

// Custom hook for matches data with auto-refresh
export function useMatches(autoRefresh: boolean = true) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevMatchesRef = useRef<Map<string, Match>>(new Map());

  const fetchMatches = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getMatches();
      const incoming: Match[] = data.matches || [];

      // Build new map and merge by id to preserve stable references if unchanged
      const nextMap = new Map<string, Match>();
      const prevMap = prevMatchesRef.current;

      for (const m of incoming) {
        const prev = prevMap.get(m.id);
        if (prev) {
          // Shallow compare fields we render often; if equal, reuse prev instance
          const same =
            prev.scoreHome === m.scoreHome &&
            prev.scoreAway === m.scoreAway &&
            prev.status === m.status &&
            prev.kickoffAt === m.kickoffAt &&
            prev.homeTeam === m.homeTeam &&
            prev.awayTeam === m.awayTeam &&
            prev.stage === m.stage &&
            prev.matchday === m.matchday &&
            JSON.stringify(prev.userPrediction) === JSON.stringify(m.userPrediction);

          nextMap.set(m.id, same ? prev : { ...prev, ...m });
        } else {
          nextMap.set(m.id, m);
        }
      }

      // Keep the original order from incoming
      const mergedList = incoming.map(m => nextMap.get(m.id)!) as Match[];

      prevMatchesRef.current = nextMap;
      setMatches(mergedList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
      console.error('Failed to fetch matches:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Use polling hook for automatic updates
  const { isPolling, lastUpdate, manualPoll } = useDataPolling(
    fetchMatches,
    30000, // 30 seconds
    autoRefresh
  );

  // Initial fetch
  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const refresh = useCallback(() => {
    setLoading(true);
    return manualPoll();
  }, [manualPoll]);

  return {
    matches,
    loading,
    error,
    refresh,
    isPolling,
    lastUpdate
  };
}

// Custom hook for leaderboard data with auto-refresh
export function useLeaderboard(autoRefresh: boolean = true) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getLeaderboard();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch leaderboard';
      setError(errorMessage);
      console.error('Failed to fetch leaderboard:', err);
      // Keep existing data on error rather than clearing it
    } finally {
      setLoading(false);
    }
  }, []);

  // Use polling hook for automatic updates
  const { isPolling, lastUpdate, manualPoll } = useDataPolling(
    fetchLeaderboard,
    30000, // 30 seconds
    autoRefresh
  );

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const refresh = useCallback(() => {
    setLoading(true);
    return manualPoll();
  }, [manualPoll]);

  return {
    leaderboard,
    loading,
    error,
    refresh,
    isPolling,
    lastUpdate
  };
}

// Custom hook for leaderboard by rounds
export function useLeaderboardByRounds(autoRefresh: boolean = false) {
  const [rounds, setRounds] = useState<RoundLeaderboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRounds = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getLeaderboardByRounds();
      setRounds(data.rounds || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch rounds leaderboard';
      setError(errorMessage);
      console.error('Failed to fetch rounds leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Use polling hook for automatic updates (disabled by default since this is historical data)
  const { isPolling, lastUpdate, manualPoll } = useDataPolling(
    fetchRounds,
    60000, // 60 seconds (slower refresh since historical data changes less frequently)
    autoRefresh
  );

  // Initial fetch
  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  const refresh = useCallback(() => {
    setLoading(true);
    return manualPoll();
  }, [manualPoll]);

  return {
    rounds,
    loading,
    error,
    refresh,
    isPolling,
    lastUpdate
  };
}

// Custom hook for user predictions with manual refresh
export function useUserPredictions(userId?: string) {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserPredictions = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await api.getUserPredictions(userId);
      setPredictions(data.predictions || []);
      setMatches(data.matches || []);
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user predictions');
      console.error('Failed to fetch user predictions:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserPredictions();
  }, [fetchUserPredictions]);

  const refresh = useCallback(() => {
    setLoading(true);
    return fetchUserPredictions();
  }, [fetchUserPredictions]);

  return {
    predictions,
    matches,
    user,
    loading,
    error,
    refresh
  };
}

// Hook for cache statistics (admin only)
export function useCacheStats(enabled: boolean = false) {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCacheStats();
      setStats(data.stats || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cache stats');
      console.error('Failed to fetch cache stats:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Auto-refresh cache stats every 10 seconds when enabled
  const { manualPoll, lastUpdate } = useDataPolling(
    fetchStats,
    10000, // 10 seconds
    enabled
  );

  useEffect(() => {
    if (enabled) {
      fetchStats();
    }
  }, [fetchStats, enabled]);

  const refresh = useCallback(() => {
    return manualPoll();
  }, [manualPoll]);

  const refreshCache = useCallback(async () => {
    try {
      setLoading(true);
      await api.refreshCache();
      // Refresh stats after cache refresh
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh cache');
      console.error('Failed to refresh cache:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh,
    refreshCache,
    lastUpdate
  };
}
