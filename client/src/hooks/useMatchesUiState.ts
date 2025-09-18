import { useCallback, useMemo, useSyncExternalStore } from 'react';

// In-memory UI store for Matches screen state (lives until page reload)
type Subscriber = () => void;

type MatchesUiState = {
  collapsedGroups: Set<string>;
  collapsedDays: Set<string>;
  initializedDays: boolean;
};

const state: MatchesUiState = {
  collapsedGroups: new Set<string>(),
  collapsedDays: new Set<string>(),
  initializedDays: false,
};

const subscribers = new Set<Subscriber>();

function emit() {
  subscribers.forEach((cb) => cb());
}

function subscribe(cb: Subscriber) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function getSnapshot(): MatchesUiState {
  return state;
}

export function useMatchesUiState() {
  // Subscribe to store
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const toggleGroup = useCallback((groupName: string) => {
    if (state.collapsedGroups.has(groupName)) {
      state.collapsedGroups.delete(groupName);
    } else {
      state.collapsedGroups.add(groupName);
    }
    emit();
  }, []);

  const toggleDay = useCallback((dayKey: string) => {
    if (state.collapsedDays.has(dayKey)) {
      state.collapsedDays.delete(dayKey);
    } else {
      state.collapsedDays.add(dayKey);
    }
    emit();
  }, []);

  const setCollapsedGroups = useCallback((groups: Set<string>) => {
    state.collapsedGroups = new Set(groups);
    emit();
  }, []);

  const setCollapsedDays = useCallback((days: Set<string>) => {
    state.collapsedDays = new Set(days);
    emit();
  }, []);

  const setInitializedDays = useCallback((v: boolean) => {
    state.initializedDays = v;
    emit();
  }, []);

  return useMemo(() => ({
    collapsedGroups: snapshot.collapsedGroups,
    collapsedDays: snapshot.collapsedDays,
    initializedDays: snapshot.initializedDays,
    toggleGroup,
    toggleDay,
    setCollapsedGroups,
    setCollapsedDays,
    setInitializedDays,
  }), [snapshot, toggleGroup, toggleDay, setCollapsedGroups, setCollapsedDays, setInitializedDays]);
}


