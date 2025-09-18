import { useEffect, useRef, useState } from 'react';

interface UseAutoRefreshOptions {
  enabled?: boolean;
  interval?: number; // in milliseconds
  onRefresh?: () => Promise<void> | void;
}

export function useAutoRefresh({ 
  enabled = true, 
  interval = 30000, // 30 seconds by default
  onRefresh 
}: UseAutoRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const refresh = async () => {
    if (!mountedRef.current || isRefreshing || !onRefresh) return;
    
    try {
      setIsRefreshing(true);
      await onRefresh();
      if (mountedRef.current) {
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Auto refresh failed:', error);
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  };

  const startRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(refresh, interval);
  };

  const stopRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    if (enabled && onRefresh) {
      startRefresh();
    } else {
      stopRefresh();
    }

    return () => {
      mountedRef.current = false;
      stopRefresh();
    };
  }, [enabled, interval, onRefresh]);

  // Manual refresh function
  const manualRefresh = () => {
    refresh();
  };

  return {
    isRefreshing,
    lastRefresh,
    manualRefresh,
    startRefresh,
    stopRefresh
  };
}

// Hook for automatic data polling with visibility and focus detection
export function useDataPolling(
  fetchData: () => Promise<void>,
  intervalMs: number = 30000,
  enabled: boolean = true
) {
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const poll = async () => {
    if (!mountedRef.current || isPolling) return;
    
    try {
      setIsPolling(true);
      await fetchData();
      if (mountedRef.current) {
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Data polling failed:', error);
    } finally {
      if (mountedRef.current) {
        setIsPolling(false);
      }
    }
  };

  const startPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(poll, intervalMs);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Handle visibility change - pause when tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else if (enabled) {
        startPolling();
        // Refresh immediately when tab becomes visible
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, intervalMs]);

  // Handle window focus - refresh when user returns to app
  useEffect(() => {
    const handleFocus = () => {
      if (enabled) {
        poll();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (enabled) {
      startPolling();
      // Initial fetch
      poll();
    } else {
      stopPolling();
    }

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [enabled, intervalMs]);

  return {
    isPolling,
    lastUpdate,
    manualPoll: poll,
    startPolling,
    stopPolling
  };
}
