import { useEffect, useState } from 'react';
import { api } from '../api';
import { useMatchesUiState } from '../hooks/useMatchesUiState';
import type { Match, Prediction, User } from '../types';
import { getMatchStatus, canBetOnMatch, isMatchActive } from '../utils/matchStatus';

interface AdminMatchesViewProps {
  userId: string;
  onBack: () => void;
}

interface UserPredictionData {
  user: User;
  predictions: (Prediction & { match: Match })[];
  matches: Match[];
}

export function AdminMatchesView({ userId, onBack }: AdminMatchesViewProps) {
  const [data, setData] = useState<UserPredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { collapsedGroups, collapsedDays, initializedDays, setCollapsedGroups, setCollapsedDays, setInitializedDays, toggleGroup, toggleDay } = useMatchesUiState();

  useEffect(() => {
    loadUserPredictions();
  }, [userId]);

  const loadUserPredictions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getUserPredictions(userId);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки прогнозов');
    } finally {
      setLoading(false);
    }
  };

  const translateStage = (stage: string) => {
    const stageTranslations: Record<string, string> = {
      'LEAGUE_STAGE': 'Основной раунд',
      'GROUP_STAGE': 'Основной раунд',
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
    if (!data?.matches || data.matches.length === 0 || initializedDays) return;
    
    const groups: { [key: string]: Set<string> } = {};
    const liveGroups = new Set<string>();
    const upcomingGroups = new Set<string>();
    
    // Вспомогательная функция для определения активных (live) матчей
    const isLiveMatch = (match: Match) => {
      return isMatchActive(match);
    };
    
    // Вспомогательная функция для определения доступности матча для ставок
    const isAvailableForBetting = (match: Match) => {
      return canBetOnMatch(match);
    };
    
    // Находим группы с лайв матчами и группы с матчами для ставок
    data.matches.forEach(match => {
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
        const groupMatches = data.matches.filter(match => {
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
          const dayMatches = data.matches.filter(match => {
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
  }, [data?.matches, initializedDays, setCollapsedGroups, setCollapsedDays, setInitializedDays]);

  if (loading) {
    return (
      <div>
        <div className="header">
          <button onClick={onBack} className="back-button">← Назад</button>
          Загрузка прогнозов...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="header">
          <button onClick={onBack} className="back-button">← Назад</button>
          Ошибка
        </div>
        <div className="error">
          {error}
          <button onClick={loadUserPredictions} style={{ marginLeft: '8px' }}>
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="header">
          <button onClick={onBack} className="back-button">← Назад</button>
          Пользователь не найден
        </div>
      </div>
    );
  }

  // Группировка матчей по турам и дням
  const groupMatches = () => {
    const groups: { [key: string]: { [key: string]: Match[] } } = {};
    
    data.matches.forEach(match => {
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

  const getPredictionForMatch = (matchId: string) => {
    return data?.predictions.find(p => p.matchId === matchId);
  };

  return (
    <div>
      <div className="header">
        <button onClick={onBack} className="back-button">← Назад</button>
        📝 Прогнозы: {data.user.name}
      </div>
      
      {Object.entries(groupedMatches).map(([groupName, dayGroups]) => {
        const isGroupCollapsed = collapsedGroups.has(groupName);
        
        return (
          <div key={groupName} className="match-group">
            <div 
              className="match-group-header"
              onClick={() => toggleGroup(groupName)}
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
                      onClick={() => toggleDay(dayKey)}
                    >
                      <span>{date}</span>
                      <span className={`collapse-icon ${isDayCollapsed ? 'collapsed' : ''}`}>
                        ▼
                      </span>
                    </div>
                    
                    <div 
                      className={`match-day-content ${isDayCollapsed ? 'collapsed' : ''}`}
                    >
                      {dayMatches.map((match) => {
                        const prediction = getPredictionForMatch(match.id);
                        const matchWithPrediction = {
                          ...match,
                          userPrediction: prediction ? {
                            predHome: prediction.predHome,
                            predAway: prediction.predAway
                          } : null
                        };
                        
                        return (
                          <AdminMatchCard
                            key={match.id}
                            match={matchWithPrediction}
                            userId={userId}
                            onUpdate={loadUserPredictions}
                          />
                        );
                      })}
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

// Компонент для редактирования прогнозов в админке
import { memo, useRef } from 'react';

interface AdminMatchCardProps {
  match: Match & { userPrediction: { predHome: number; predAway: number } | null };
  userId: string;
  onUpdate: () => void;
}

function AdminMatchCardInner({ match, userId, onUpdate }: AdminMatchCardProps) {
  const initialHasPrediction = match.userPrediction !== null && match.userPrediction !== undefined;
  const [hasLocalPrediction, setHasLocalPrediction] = useState(initialHasPrediction);
  const hasExistingPrediction = hasLocalPrediction || initialHasPrediction;
  
  const [predHome, setPredHome] = useState(initialHasPrediction ? match.userPrediction!.predHome : 0);
  const [predAway, setPredAway] = useState(initialHasPrediction ? match.userPrediction!.predAway : 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [homeFocused, setHomeFocused] = useState(false);
  const [awayFocused, setAwayFocused] = useState(false);
  const [isEditing, setIsEditing] = useState(false);


  const kickoffTime = new Date(match.kickoffAt);
  const hasScore = match.scoreHome !== null && match.scoreAway !== null;

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

  // Обновляем значения прогноза при изменении данных матча
  useEffect(() => {
    if (initialHasPrediction && !isEditing && !hasLocalPrediction) {
      setPredHome(match.userPrediction!.predHome);
      setPredAway(match.userPrediction!.predAway);
    }
  }, [match.userPrediction, initialHasPrediction, isEditing, hasLocalPrediction]);
  
  const status = getMatchStatus(match);

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
      'LEAGUE_STAGE': 'Основной раунд',
      'GROUP_STAGE': 'Основной раунд',
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

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    
    try {
      await api.updateUserPrediction(userId, match.id, predHome, predAway);
      setHasLocalPrediction(true);
      setSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSuccess(false), 1500);
      onUpdate(); // Обновляем данные
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки прогноза');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Удалить прогноз для этого матча?')) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      await api.deleteUserPrediction(userId, match.id);
      setHasLocalPrediction(false);
      setPredHome(0);
      setPredAway(0);
      setIsEditing(false);
      onUpdate(); // Обновляем данные
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления прогноза');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    // Восстанавливаем оригинальные значения
    if (hasExistingPrediction) {
      setPredHome(match.userPrediction!.predHome);
      setPredAway(match.userPrediction!.predAway);
    } else {
      setPredHome(0);
      setPredAway(0);
    }
    setIsEditing(false);
    setError(null);
  };

  const handleHomeFocus = () => {
    setHomeFocused(true);
  };

  const handleHomeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setHomeFocused(false);
    if (e.target.value === '') {
      setPredHome(0);
    }
  };

  const handleAwayFocus = () => {
    setAwayFocused(true);
  };

  const handleAwayBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setAwayFocused(false);
    if (e.target.value === '') {
      setPredAway(0);
    }
  };

  const handleHomeIncrement = () => {
    if (hasExistingPrediction ? isEditing : true) {
      setPredHome(Math.min(9, predHome + 1));
    }
  };

  const handleHomeDecrement = () => {
    if (hasExistingPrediction ? isEditing : true) {
      setPredHome(Math.max(0, predHome - 1));
    }
  };

  const handleAwayIncrement = () => {
    if (hasExistingPrediction ? isEditing : true) {
      setPredAway(Math.min(9, predAway + 1));
    }
  };

  const handleAwayDecrement = () => {
    if (hasExistingPrediction ? isEditing : true) {
      setPredAway(Math.max(0, predAway - 1));
    }
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
        <div className={`score ${scoreChanged ? `score-changed-${scoreChanged}` : ''}`}>
          {hasScore ? `${match.scoreHome}:${match.scoreAway}` : 'vs'}
        </div>
        <div className="team">{match.awayTeam}</div>
      </div>


      <div className="prediction-section">
        <div className="prediction-form">
          <div className="score-input-container">
            <div className="score-buttons-column">
              <button 
                className="score-button score-button-plus"
                onClick={handleHomeIncrement}
                disabled={submitting || (hasExistingPrediction && !isEditing) || predHome >= 9}
                type="button"
              >
                +
              </button>
              <button 
                className="score-button score-button-minus"
                onClick={handleHomeDecrement}
                disabled={submitting || (hasExistingPrediction && !isEditing) || predHome <= 0}
                type="button"
              >
                −
              </button>
            </div>
            <input
              type="number"
              min="0"
              max="9"
              value={homeFocused && predHome === 0 ? '' : predHome}
              onChange={(e) => setPredHome(e.target.value === '' ? 0 : Number(e.target.value))}
              onFocus={handleHomeFocus}
              onBlur={handleHomeBlur}
              className="score-input-large"
              disabled={submitting || (hasExistingPrediction && !isEditing)}
              placeholder="0"
            />
          </div>
          <span className="score-separator">:</span>
          <div className="score-input-container">
            <input
              type="number"
              min="0"
              max="9"
              value={awayFocused && predAway === 0 ? '' : predAway}
              onChange={(e) => setPredAway(e.target.value === '' ? 0 : Number(e.target.value))}
              onFocus={handleAwayFocus}
              onBlur={handleAwayBlur}
              className="score-input-large"
              disabled={submitting || (hasExistingPrediction && !isEditing)}
              placeholder="0"
            />
            <div className="score-buttons-column">
              <button 
                className="score-button score-button-plus"
                onClick={handleAwayIncrement}
                disabled={submitting || (hasExistingPrediction && !isEditing) || predAway >= 9}
                type="button"
              >
                +
              </button>
              <button 
                className="score-button score-button-minus"
                onClick={handleAwayDecrement}
                disabled={submitting || (hasExistingPrediction && !isEditing) || predAway <= 0}
                type="button"
              >
                −
              </button>
            </div>
          </div>
        </div>
        <div className="prediction-actions">
          {hasExistingPrediction && !isEditing && !success ? (
            <>
              <button
                onClick={handleEdit}
                className="edit-prediction-button"
                disabled={submitting}
              >
                Изменить
              </button>
              <button
                onClick={handleDelete}
                className="delete-prediction-button"
                disabled={submitting}
              >
                Удалить
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSubmit}
                disabled={submitting || success}
                className={`save-prediction-button ${success ? 'success' : ''}`}
              >
                {submitting ? '...' : success ? '✓' : hasExistingPrediction ? 'Сохранить' : 'Прогноз'}
              </button>
              {hasExistingPrediction && isEditing && !success && (
                <button
                  onClick={handleCancel}
                  disabled={submitting}
                  className="cancel-prediction-button"
                >
                  Отмена
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
}

// Memoize to avoid rerender unless relevant match fields change
export const AdminMatchCard = memo(AdminMatchCardInner, (prevProps, nextProps) => {
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
    p.matchday === n.matchday &&
    JSON.stringify(p.userPrediction) === JSON.stringify(n.userPrediction)
  );
});
