import { useEffect, useState } from 'react';
import { api } from '../api';
import { useMatchesUiState } from '../hooks/useMatchesUiState';
import type { Match } from '../types';
import { haptic } from '../utils/haptic';

interface AdminMatchesManagementViewProps {
  onBack: () => void;
}

export function AdminMatchesManagementView({ onBack }: AdminMatchesManagementViewProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { collapsedGroups, collapsedDays, initializedDays, setCollapsedGroups, setCollapsedDays, setInitializedDays, toggleGroup, toggleDay } = useMatchesUiState();

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getMatches();
      setMatches(response.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки матчей');
    } finally {
      setLoading(false);
    }
  };

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
  useEffect(() => {
    if (!matches || matches.length === 0 || initializedDays) return;
    
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
    return (
      <div>
        <div className="header">
          <button onClick={() => {
            haptic.light();
            onBack();
          }} className="back-button">← Назад</button>
          Загрузка матчей...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="header">
          <button onClick={() => {
            haptic.light();
            onBack();
          }} className="back-button">← Назад</button>
          Ошибка
        </div>
        <div className="error">
          {error}
          <button onClick={() => {
            haptic.light();
            loadMatches();
          }} style={{ marginLeft: '8px' }}>
            Повторить
          </button>
        </div>
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

  return (
    <div>
      <div className="header">
        <button onClick={() => {
          haptic.light();
          onBack();
        }} className="back-button">← Назад</button>
        ⚽ Управление матчами
      </div>
      
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
                        <AdminMatchScoreCard
                          key={match.id}
                          match={match}
                          onUpdate={loadMatches}
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
  );
}

// Компонент для редактирования счета матча
import { memo, useEffect, useRef, useState } from 'react';

interface AdminMatchScoreCardProps {
  match: Match;
  onUpdate: () => void;
}

function AdminMatchScoreCardInner({ match, onUpdate }: AdminMatchScoreCardProps) {
  // Score editing state
  const [isEditingScore, setIsEditingScore] = useState(false);
  const [scoreHome, setScoreHome] = useState(match.scoreHome || 0);
  const [scoreAway, setScoreAway] = useState(match.scoreAway || 0);
  const [scoreSubmitting, setScoreSubmitting] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreSuccess, setScoreSuccess] = useState(false);
  const [scoreHomeFocused, setScoreHomeFocused] = useState(false);
  const [scoreAwayFocused, setScoreAwayFocused] = useState(false);

  const kickoffTime = new Date(match.kickoffAt);
  const hasScore = match.scoreHome != null && match.scoreAway != null;

  // Track previous score to highlight changes
  const prevScoreRef = useRef<{ h?: number; a?: number } | null>(null);
  const [scoreChanged, setScoreChanged] = useState<null | 'home' | 'away' | 'both'>(null);
  useEffect(() => {
    const prev = prevScoreRef.current;
    const currH = match.scoreHome;
    const currA = match.scoreAway;
    if (prev) {
      const homeChanged = prev.h !== currH && currH !== undefined;
      const awayChanged = prev.a !== currA && currA !== undefined;
      if (homeChanged && awayChanged) setScoreChanged('both');
      else if (homeChanged) setScoreChanged('home');
      else if (awayChanged) setScoreChanged('away');
      if (homeChanged || awayChanged) {
        const t = setTimeout(() => setScoreChanged(null), 1200);
        return () => clearTimeout(t);
      }
    }
    prevScoreRef.current = { h: currH, a: currA };
  }, [match.scoreHome, match.scoreAway]);

  const getMatchStatus = () => {
    const now = new Date();
    const matchTime = new Date(match.kickoffAt);
    const minutesFromKickoff = Math.max(0, Math.floor((now.getTime() - matchTime.getTime()) / 60000));
    // Conservative thresholds to account for halftime (≈15m), added time, and potential extra time (2x15 + short break)
    const FINISH_MINUTES_HARD = 155;      // ~2h35m from kickoff (covers ET + stoppage)
    const FINISH_MINUTES_WITH_SCORE = 135; // ~2h15m if we already have a score registered
    
    // Обрабатываем все возможные статусы Football Data API v4
    // Полный список статусов: https://www.football-data.org/documentation/api
    switch (match.status) {
      case 'SCHEDULED':
        return { text: 'Запланирован', class: 'scheduled' };
      
      case 'LIVE':
      case 'IN_PLAY':
        return { text: 'В игре', class: 'live' };
      
      case 'PAUSED': {
        // Some feeds leave PAUSED long after FT. We consider halftime, added time and extra time.
        if (minutesFromKickoff >= FINISH_MINUTES_HARD || (hasScore && minutesFromKickoff >= FINISH_MINUTES_WITH_SCORE)) {
          return { text: 'Завершен', class: 'finished' };
        }
        return { text: 'Пауза', class: 'paused' };
      }
      
      case 'FINISHED':
        return { text: 'Завершен', class: 'finished' };
      
      case 'POSTPONED':
        return { text: 'Отложен', class: 'postponed' };
      
      case 'SUSPENDED':
        return { text: 'Приостановлен', class: 'suspended' };
      
      case 'CANCELLED':
        return { text: 'Отменен', class: 'cancelled' };
      
      default:
        // Если статус неизвестен, определяем по времени и наличию счета
        if (hasScore) {
          return { text: 'Завершен', class: 'finished' };
        }
        
        if (now >= matchTime) {
          return { text: 'В игре', class: 'live' };
        }
        
        return { text: 'Запланирован', class: 'scheduled' };
    }
  };
  
  const status = getMatchStatus();

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

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

  // Score editing functions
  const handleScoreSubmit = async () => {
    haptic.warning();
    if (!confirm('Изменить счет матча? Это повлияет на очки всех игроков.')) {
      return;
    }

    haptic.heavy();
    setScoreSubmitting(true);
    setScoreError(null);
    
    try {
      await api.updateMatchScore(match.id, scoreHome, scoreAway, 'FINISHED');
      
      // Пересчитываем очки для этого матча
      try {
        await api.recalcMatch(match.id);
      } catch (recalcErr) {
        console.warn('Failed to recalc scores:', recalcErr);
      }
      
      haptic.success();
      setScoreSuccess(true);
      setIsEditingScore(false);
      setTimeout(() => setScoreSuccess(false), 1500);
      onUpdate(); // Обновляем данные
    } catch (err) {
      haptic.error();
      setScoreError(err instanceof Error ? err.message : 'Ошибка обновления счета');
    } finally {
      setScoreSubmitting(false);
    }
  };

  const handleScoreEdit = () => {
    haptic.light();
    setIsEditingScore(true);
    setScoreHome(match.scoreHome || 0);
    setScoreAway(match.scoreAway || 0);
  };

  const handleScoreCancel = () => {
    haptic.light();
    setScoreHome(match.scoreHome || 0);
    setScoreAway(match.scoreAway || 0);
    setIsEditingScore(false);
    setScoreError(null);
  };

  const handleScoreHomeFocus = () => {
    setScoreHomeFocused(true);
  };

  const handleScoreHomeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setScoreHomeFocused(false);
    if (e.target.value === '') {
      setScoreHome(0);
    }
  };

  const handleScoreAwayFocus = () => {
    setScoreAwayFocused(true);
  };

  const handleScoreAwayBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setScoreAwayFocused(false);
    if (e.target.value === '') {
      setScoreAway(0);
    }
  };

  const handleScoreHomeIncrement = () => {
    haptic.soft();
    setScoreHome(Math.min(9, scoreHome + 1));
  };

  const handleScoreHomeDecrement = () => {
    haptic.soft();
    setScoreHome(Math.max(0, scoreHome - 1));
  };

  const handleScoreAwayIncrement = () => {
    haptic.soft();
    setScoreAway(Math.min(9, scoreAway + 1));
  };

  const handleScoreAwayDecrement = () => {
    haptic.soft();
    setScoreAway(Math.max(0, scoreAway - 1));
  };

  return (
    <div className="match-card">
      <div className="match-header">
        <span className="match-stage">{translateStage(match.stage)}</span>
        <span className={`match-status ${status.class}`}>{status.text}</span>
        <span className="match-date">{formatDate(kickoffTime)}</span>
      </div>
      
      <div className="match-teams">
        <div className="team">{match.homeTeam}</div>
        <div className="score-wrapper">
          <div className={`score ${scoreChanged ? `score-changed-${scoreChanged}` : ''} ${isLive ? 'score-live' : ''}`}>
            {hasScore ? `${match.scoreHome}:${match.scoreAway}` : isLive ? '0:0' : 'vs'}
          </div>
          {isLive && (
            <span className="live-score-badge">LIVE</span>
          )}
        </div>
        <div className="team">{match.awayTeam}</div>
      </div>

      {/* Score editing section */}
      <div className="score-editing-section">
        <div className="score-editing-header">
          <span>Редактирование счета</span>
          {!isEditingScore && (
            <button
              onClick={handleScoreEdit}
              className="edit-score-button"
              disabled={scoreSubmitting}
            >
              {hasScore ? 'Изменить счет' : 'Установить счет'}
            </button>
          )}
        </div>
        
        {isEditingScore && (
          <div className="score-editing-form">
            <div className="score-input-container">
              <div className="score-buttons-column">
                <button 
                  className="score-button score-button-plus"
                  onClick={handleScoreHomeIncrement}
                  disabled={scoreSubmitting || scoreHome >= 9}
                  type="button"
                >
                  +
                </button>
                <button 
                  className="score-button score-button-minus"
                  onClick={handleScoreHomeDecrement}
                  disabled={scoreSubmitting || scoreHome <= 0}
                  type="button"
                >
                  −
                </button>
              </div>
              <input
                type="number"
                min="0"
                max="9"
                value={scoreHomeFocused && scoreHome === 0 ? '' : scoreHome}
                onChange={(e) => setScoreHome(e.target.value === '' ? 0 : Number(e.target.value))}
                onFocus={handleScoreHomeFocus}
                onBlur={handleScoreHomeBlur}
                className="score-input-large"
                disabled={scoreSubmitting}
                placeholder="0"
              />
            </div>
            <span className="score-separator">:</span>
            <div className="score-input-container">
              <input
                type="number"
                min="0"
                max="9"
                value={scoreAwayFocused && scoreAway === 0 ? '' : scoreAway}
                onChange={(e) => setScoreAway(e.target.value === '' ? 0 : Number(e.target.value))}
                onFocus={handleScoreAwayFocus}
                onBlur={handleScoreAwayBlur}
                className="score-input-large"
                disabled={scoreSubmitting}
                placeholder="0"
              />
              <div className="score-buttons-column">
                <button 
                  className="score-button score-button-plus"
                  onClick={handleScoreAwayIncrement}
                  disabled={scoreSubmitting || scoreAway >= 9}
                  type="button"
                >
                  +
                </button>
                <button 
                  className="score-button score-button-minus"
                  onClick={handleScoreAwayDecrement}
                  disabled={scoreSubmitting || scoreAway <= 0}
                  type="button"
                >
                  −
                </button>
              </div>
            </div>
          </div>
        )}
        
        {isEditingScore && (
          <div className="score-editing-actions">
            <button
              onClick={handleScoreSubmit}
              disabled={scoreSubmitting || scoreSuccess}
              className={`save-score-button ${scoreSuccess ? 'success' : ''}`}
            >
              {scoreSubmitting ? 'Сохранение...' : scoreSuccess ? '✓ Сохранено' : 'Сохранить счет'}
            </button>
            <button
              onClick={handleScoreCancel}
              disabled={scoreSubmitting}
              className="cancel-score-button"
            >
              Отмена
            </button>
          </div>
        )}

        {scoreError && (
          <div className="error-message">
            {scoreError}
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize to avoid rerender unless relevant match fields change
export const AdminMatchScoreCard = memo(AdminMatchScoreCardInner, (prevProps, nextProps) => {
  const p = prevProps.match; const n = nextProps.match;
  return (
    p.id === n.id &&
    p.scoreHome === n.scoreHome &&
    p.scoreAway === n.scoreAway &&
    p.status === n.status &&
    p.kickoffAt === n.kickoffAt &&
    p.homeTeam === n.homeTeam &&
    p.awayTeam === n.awayTeam &&
    p.stage === n.stage &&
    p.matchday === n.matchday
  );
});
