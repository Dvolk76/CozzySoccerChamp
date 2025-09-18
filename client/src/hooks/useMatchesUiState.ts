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
    console.log('toggleGroup called with:', groupName, 'current state:', state.collapsedGroups.has(groupName));
    if (state.collapsedGroups.has(groupName)) {
      state.collapsedGroups.delete(groupName);
    } else {
      state.collapsedGroups.add(groupName);
    }
    console.log('new collapsed groups:', Array.from(state.collapsedGroups));
    emit();
  }, []);

  const toggleDay = useCallback((dayKey: string) => {
    console.log('toggleDay called with:', dayKey, 'current state:', state.collapsedDays.has(dayKey));
    if (state.collapsedDays.has(dayKey)) {
      state.collapsedDays.delete(dayKey);
    } else {
      state.collapsedDays.add(dayKey);
    }
    console.log('new collapsed days:', Array.from(state.collapsedDays));
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


