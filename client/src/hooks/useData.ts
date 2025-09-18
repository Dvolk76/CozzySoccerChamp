import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useDataPolling } from './useAutoRefresh';

// Custom hook for matches data with auto-refresh
export function useMatches(autoRefresh: boolean = true) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getMatches();
      setMatches(data.matches || []);
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
  const { manualPoll } = useDataPolling(
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
    refreshCache
  };
}
