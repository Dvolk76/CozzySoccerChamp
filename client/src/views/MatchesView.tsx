import { useEffect, useState } from 'react';
import { MatchCard } from '../components/MatchCard';
import { TopScorerItem } from '../components/TopScorerItem';
import { useMatches, useTopScorers } from '../hooks/useData';
import { LastSync } from '../components/LastSync';
import type { Match } from '../types';
import { useMatchesUiState } from '../hooks/useMatchesUiState';
import { haptic } from '../utils/haptic';

export function MatchesView() {
  const { matches, loading, error, refresh, isPolling, lastUpdate } = useMatches(true);
  const { scorers, loading: loadingScorers, error: errorScorers } = useTopScorers(false);
  const { collapsedGroups, collapsedDays, initializedDays, setCollapsedGroups, setCollapsedDays, setInitializedDays, toggleGroup, toggleDay } = useMatchesUiState();
  const [viewMode, setViewMode] = useState<'scorers' | 'matches'>('matches');

  const translateStage = (stage: string) => {
    const stageTranslations: Record<string, string> = {
      'LEAGUE_STAGE': 'Этап лиги',
      'GROUP_STAGE': 'Этап лиги',
      'ROUND_OF_16': '1/8 финала',
      'QUARTER_FINALS': 'Четвертьфинал',
      'SEMI_FINALS': 'Полуфинал',
      'FINAL': 'Финал',
      'PLAYOFFS': 'Плей-офф',
      'QUALIFYING': 'Квалификация',
      'LAST_16': '1/8 финала',
      'LAST_8': 'Четвертьфинал',
      'LAST_4': 'Полуфинал',
      'THIRD_PLACE': 'Матч за 3-е место',
      'PRELIMINARY_ROUND': 'Предварительный раунд',
      'FIRST_QUALIFYING_ROUND': '1-й квалификационный раунд',
      'SECOND_QUALIFYING_ROUND': '2-й квалификационный раунд',
      'THIRD_QUALIFYING_ROUND': '3-й квалификационный раунд',
      'PLAY_OFF_ROUND': 'Раунд плей-офф'
    };

    return stageTranslations[stage] || stage;
  };

  // Автоматическое сворачивание групп при запуске приложения
  // Открываем только группы с лайв матчами и ближайшими матчами для прогнозов
  useEffect(() => {
    if (matches.length === 0 || initializedDays) return;
    
    const now = new Date();
    const groups: { [key: string]: Set<string> } = {};
    const liveGroups = new Set<string>();
    const upcomingGroups = new Set<string>();
    
    // Вспомогательная функция для определения активных (live) матчей
    const isLiveMatch = (match: Match) => {
      return match.status === 'LIVE' || match.status === 'IN_PLAY' || match.status === 'PAUSED';
    };
    
    // Вспомогательная функция для определения доступности матча для ставок
    const isAvailableForBetting = (match: Match) => {
      const matchTime = new Date(match.kickoffAt);
      return matchTime > now && !['FINISHED', 'CANCELLED', 'POSTPONED', 'SUSPENDED'].includes(match.status);
    };
    
    // Находим группы с лайв матчами и группы с матчами для ставок
    matches.forEach(match => {
      const matchday = match.matchday || 0;
      const stage = translateStage(match.stage) || 'Неизвестный тур';
      const date = new Date(match.kickoffAt).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long'
      });
      const groupKey = `${stage}${matchday ? ` - Тур ${matchday}` : ''}`;
      
      if (!groups[groupKey]) groups[groupKey] = new Set();
      groups[groupKey].add(date);
      
      // Проверяем на лайв матчи
      if (isLiveMatch(match)) {
        liveGroups.add(groupKey);
      }
      
      // Проверяем доступность для ставок
      if (isAvailableForBetting(match)) {
        upcomingGroups.add(groupKey);
      }
    });
    
    // Определяем приоритет групп для открытия:
    // 1. Сначала группы с лайв матчами
    // 2. Если лайв матчей нет, то первая группа с ближайшими матчами для ставок
    let groupsToKeepOpen = new Set<string>();
    
    if (liveGroups.size > 0) {
      // Есть лайв матчи - открываем все группы с лайв матчами
      groupsToKeepOpen = liveGroups;
    } else if (upcomingGroups.size > 0) {
      // Нет лайв матчей - находим группу с самыми ближайшими матчами для ставок
      let nearestGroupTime = Infinity;
      let nearestGroup = '';
      
      for (const groupKey of upcomingGroups) {
        const groupMatches = matches.filter(match => {
          const matchday = match.matchday || 0;
          const stage = translateStage(match.stage) || 'Неизвестный тур';
          const matchGroupKey = `${stage}${matchday ? ` - Тур ${matchday}` : ''}`;
          return matchGroupKey === groupKey && isAvailableForBetting(match);
        });
        
        const earliestMatchTime = Math.min(...groupMatches.map(match => new Date(match.kickoffAt).getTime()));
        
        if (earliestMatchTime < nearestGroupTime) {
          nearestGroupTime = earliestMatchTime;
          nearestGroup = groupKey;
        }
      }
      
      if (nearestGroup) {
        groupsToKeepOpen.add(nearestGroup);
      }
    }
    
    // Сворачиваем все группы, кроме выбранных
    const collapsedGroupsSet = new Set<string>();
    const collapsedDaysSet = new Set<string>();
    
    Object.entries(groups).forEach(([groupName, datesSet]) => {
      if (!groupsToKeepOpen.has(groupName)) {
        // Сворачиваем всю группу
        collapsedGroupsSet.add(groupName);
      } else {
        // В открытых группах управляем днями
        const dates = Array.from(datesSet).sort((a, b) => {
          // Сортируем даты по времени
          const dateA = new Date(a + ', 2024');
          const dateB = new Date(b + ', 2024');
          return dateA.getTime() - dateB.getTime();
        });
        
        dates.forEach((date, index) => {
          const dayKey = `${groupName}-${date}`;
          const dayMatches = matches.filter(match => {
            const matchDate = new Date(match.kickoffAt).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long'
            });
            const matchGroup = `${translateStage(match.stage) || 'Неизвестный тур'}${match.matchday ? ` - Тур ${match.matchday}` : ''}`;
            return matchGroup === groupName && matchDate === date;
          });
          
          // Проверяем, есть ли в этом дне лайв матчи или доступные для ставок матчи
          const hasLiveMatches = dayMatches.some(match => isLiveMatch(match));
          const hasAvailableMatches = dayMatches.some(match => isAvailableForBetting(match));
          
          // В группах с лайв матчами оставляем открытыми дни с лайв матчами
          // В группах без лайв матчей оставляем открытыми дни с доступными для ставок матчами
          const shouldKeepDayOpen = liveGroups.has(groupName) 
            ? hasLiveMatches || (index === 0 && hasAvailableMatches)
            : hasAvailableMatches;
          
          if (!shouldKeepDayOpen) {
            collapsedDaysSet.add(dayKey);
          }
        });
      }
    });
    
    setCollapsedGroups(collapsedGroupsSet);
    setCollapsedDays(collapsedDaysSet);
    setInitializedDays(true);
  }, [matches, initializedDays, setCollapsedGroups, setCollapsedDays, setInitializedDays]);

  if (loading) {
    return <div className="loading">Загрузка матчей...</div>;
  }

  if (error) {
    return (
      <div className="error">
        {error}
        <button onClick={refresh} style={{ marginLeft: '8px' }}>
          Повторить
        </button>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="loading">
        Нет матчей. Синхронизируйте календарь в разделе Админ.
      </div>
    );
  }

  // Группировка матчей по турам и дням
  const groupMatches = () => {
    const groups: { [key: string]: { [key: string]: Match[] } } = {};
    
    matches.forEach(match => {
      const matchday = match.matchday || 0;
      const stage = translateStage(match.stage) || 'Неизвестный тур';
      const date = new Date(match.kickoffAt).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long'
      });
      
      const groupKey = `${stage}${matchday ? ` - Тур ${matchday}` : ''}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {};
      }
      
      if (!groups[groupKey][date]) {
        groups[groupKey][date] = [];
      }
      
      groups[groupKey][date].push(match);
    });
    
    // Сортировка групп и дат
    Object.keys(groups).forEach(groupKey => {
      Object.keys(groups[groupKey]).forEach(date => {
        groups[groupKey][date].sort((a, b) => 
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()
        );
      });
    });
    
    return groups;
  };

  const groupedMatches = groupMatches();

  // toggle handlers moved to UI store

  return (
    <div>
      <LastSync lastUpdate={lastUpdate} isLoading={isPolling} />
      
      {/* View mode switcher */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        borderBottom: '1px solid var(--tg-theme-hint-color, #999)',
        paddingBottom: '8px'
      }}>
        <button
          onClick={() => {
            haptic.selection();
            setViewMode('matches');
          }}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: viewMode === 'matches' 
              ? 'var(--tg-theme-button-color, #3390ec)' 
              : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
            color: viewMode === 'matches' 
              ? 'var(--tg-theme-button-text-color, #fff)' 
              : 'var(--tg-theme-text-color, #000)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          📅 Матчи
        </button>
        <button
          onClick={() => {
            haptic.selection();
            setViewMode('scorers');
          }}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: viewMode === 'scorers' 
              ? 'var(--tg-theme-button-color, #3390ec)' 
              : 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
            color: viewMode === 'scorers' 
              ? 'var(--tg-theme-button-text-color, #fff)' 
              : 'var(--tg-theme-text-color, #000)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ⚽ Бомбардиры
        </button>
      </div>

      {/* Matches View */}
      {viewMode === 'matches' && (
        <div>
          {Object.entries(groupedMatches).map(([groupName, dayGroups]) => {
        const isGroupCollapsed = collapsedGroups.has(groupName);
        
        return (
          <div key={groupName} className="match-group">
            <div 
              className="match-group-header"
              onClick={() => {
                haptic.selection();
                toggleGroup(groupName);
              }}
            >
              <span>{groupName}</span>
              <span className={`collapse-icon ${isGroupCollapsed ? 'collapsed' : ''}`}>
                ▼
              </span>
            </div>
            
            <div 
              className={`match-group-content ${isGroupCollapsed ? 'collapsed' : ''}`}
            >
              {Object.entries(dayGroups).map(([date, dayMatches]) => {
                const dayKey = `${groupName}-${date}`;
                const isDayCollapsed = collapsedDays.has(dayKey);
                
                return (
                  <div key={date}>
                    <div 
                      className="match-day-header"
                      onClick={() => {
                        haptic.selection();
                        toggleDay(dayKey);
                      }}
                    >
                      <span>{date}</span>
                      <span className={`collapse-icon ${isDayCollapsed ? 'collapsed' : ''}`}>
                        ▼
                      </span>
                    </div>
                    
                    <div 
                      className={`match-day-content ${isDayCollapsed ? 'collapsed' : ''}`}
                    >
                      {dayMatches.map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
        </div>
      )}

      {/* Top Scorers View */}
      {viewMode === 'scorers' && (
        <div>
          {loadingScorers ? (
            <div className="loading">Загрузка бомбардиров...</div>
          ) : errorScorers ? (
            <div className="error">
              {errorScorers}
              <button onClick={refresh} style={{ marginLeft: '8px' }}>
                Повторить
              </button>
            </div>
          ) : scorers.length === 0 ? (
            <div className="loading">
              Нет данных о бомбардирах. Синхронизируйте данные в разделе Админ.
            </div>
          ) : (
            <div>
              <div style={{
                marginBottom: '12px',
                padding: '12px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color, #f0f0f0)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--tg-theme-hint-color, #999)'
              }}>
                Топ-10 бомбардиров Лиги Чемпионов
              </div>
              {scorers.map((scorer) => (
                <TopScorerItem key={scorer.rank} scorer={scorer} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
