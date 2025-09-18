import { useCallback, useMemo, useState, useEffect } from 'react';

// In-memory UI store for Matches screen state (lives until page reload)
type MatchesUiState = {
  collapsedGroups: Set<string>;
  collapsedDays: Set<string>;
  initializedDays: boolean;
};

const globalState: MatchesUiState = {
  collapsedGroups: new Set<string>(),
  collapsedDays: new Set<string>(),
  initializedDays: false,
};

export function useMatchesUiState() {
  const [state, setState] = useState<MatchesUiState>(() => ({
    collapsedGroups: new Set(globalState.collapsedGroups),
    collapsedDays: new Set(globalState.collapsedDays),
    initializedDays: globalState.initializedDays,
  }));

  // Синхронизируем локальное состояние с глобальным
  useEffect(() => {
    globalState.collapsedGroups = new Set(state.collapsedGroups);
    globalState.collapsedDays = new Set(state.collapsedDays);
    globalState.initializedDays = state.initializedDays;
  }, [state]);

  const toggleGroup = useCallback((groupName: string) => {
    setState(prevState => {
      const newCollapsedGroups = new Set(prevState.collapsedGroups);
      if (newCollapsedGroups.has(groupName)) {
        newCollapsedGroups.delete(groupName);
      } else {
        newCollapsedGroups.add(groupName);
      }
      return {
        ...prevState,
        collapsedGroups: newCollapsedGroups,
      };
    });
  }, []);

  const toggleDay = useCallback((dayKey: string) => {
    setState(prevState => {
      const newCollapsedDays = new Set(prevState.collapsedDays);
      if (newCollapsedDays.has(dayKey)) {
        newCollapsedDays.delete(dayKey);
      } else {
        newCollapsedDays.add(dayKey);
      }
      return {
        ...prevState,
        collapsedDays: newCollapsedDays,
      };
    });
  }, []);

  const setCollapsedGroups = useCallback((groups: Set<string>) => {
    setState(prevState => ({
      ...prevState,
      collapsedGroups: new Set(groups),
    }));
  }, []);

  const setCollapsedDays = useCallback((days: Set<string>) => {
    setState(prevState => ({
      ...prevState,
      collapsedDays: new Set(days),
    }));
  }, []);

  const setInitializedDays = useCallback((v: boolean) => {
    setState(prevState => ({
      ...prevState,
      initializedDays: v,
    }));
  }, []);

  return useMemo(() => ({
    collapsedGroups: state.collapsedGroups,
    collapsedDays: state.collapsedDays,
    initializedDays: state.initializedDays,
    toggleGroup,
    toggleDay,
    setCollapsedGroups,
    setCollapsedDays,
    setInitializedDays,
  }), [state, toggleGroup, toggleDay, setCollapsedGroups, setCollapsedDays, setInitializedDays]);
}


