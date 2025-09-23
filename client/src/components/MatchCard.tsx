import { memo, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Match } from '../types';

interface MatchCardProps {
  match: Match;
}

function MatchCardInner({ match }: MatchCardProps) {
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

  // Bets toggle state
  const [showBets, setShowBets] = useState(false);
  const [betsLoading, setBetsLoading] = useState(false);
  const [betsError, setBetsError] = useState<string | null>(null);
  const [bets, setBets] = useState<Array<{ userId: string; name: string; tg_user_id?: string; predHome: number; predAway: number; points: number; createdAt: string }>>([]);

  const kickoffTime = new Date(match.kickoffAt);
  const isLocked = new Date() >= kickoffTime;
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
  const isLive = status.class === 'live' || status.class === 'paused';

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
    if (isLocked) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      await api.createPrediction(match.id, predHome, predAway);
      setHasLocalPrediction(true);
      setSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSuccess(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки прогноза');
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

  const toggleBets = async () => {
    // Only available after kickoff
    if (!isLocked) return;
    const next = !showBets;
    setShowBets(next);
    if (next && !betsLoading) {
      setBetsError(null);
      setBetsLoading(true);
      try {
        const data = await api.getMatchPredictions(match.id);
        setBets(data.predictions || []);
      } catch (err) {
        setBetsError(err instanceof Error ? err.message : 'Не удалось загрузить ставки');
      } finally {
        setBetsLoading(false);
      }
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

      {!isLocked ? (
        <div className="prediction-section">
          <div className="prediction-form">
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
            <span className="score-separator">:</span>
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
          </div>
          <div className="prediction-actions">
            {hasExistingPrediction && !isEditing && !success ? (
              <button
                onClick={handleEdit}
                className="edit-prediction-button"
                disabled={submitting}
              >
                Изменить
              </button>
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
      ) : (
        <div className="prediction-section">
          {hasExistingPrediction ? (
            <div className="prediction-locked">
              <div className="prediction-form">
                <input
                  type="number"
                  value={match.userPrediction!.predHome}
                  className="score-input-large"
                  disabled
                />
                <span className="score-separator">:</span>
                <input
                  type="number"
                  value={match.userPrediction!.predAway}
                  className="score-input-large"
                  disabled
                />
              </div>
              <div className="prediction-actions">
                <button
                  className={`locked-prediction-button ${showBets ? 'active' : ''}`}
                  onClick={toggleBets}
                >
                  {betsLoading ? 'Загрузка…' : showBets ? 'Скрыть ставки ▴' : (
                    <>
                      Ставки игроков ▾
                      {isLive && <span className="live-indicator"></span>}
                    </>
                  )}
                </button>
              </div>
              {showBets && (
                <div className="bets-section">
                  <div className="bets-hint">Ставки видны только после старта матча.</div>
                  {betsError && (
                    <div className="error-message small">
                      {betsError}
                    </div>
                  )}
                  {!betsError && (
                    <div className="bets-table-wrapper">
                      <table className="bets-table">
                        <thead>
                          <tr>
                            <th>Ник</th>
                            <th>Прогноз</th>
                            <th>Очки {isLive ? '(лайв)' : ''}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bets.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="empty-cell">Пока нет ставок</td>
                            </tr>
                          ) : (
                            bets.map((b) => (
                              <tr key={b.userId} className={`bet-row ${b.userId === (window as any)?.currentUserId ? 'me' : ''}`}>
                                <td className="nick">{b.name}</td>
                                <td className="pred">{b.predHome}:{b.predAway}</td>
                                <td className="points">{b.points}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="prediction-form-locked">
              <div className="prediction-form">
                <input
                  type="number"
                  className="score-input-large"
                  disabled
                  placeholder="—"
                />
                <span className="score-separator">:</span>
                <input
                  type="number"
                  className="score-input-large"
                  disabled
                  placeholder="—"
                />
              </div>
              <div className="prediction-actions">
                <button
                  className={`locked-prediction-button ${showBets ? 'active' : ''}`}
                  onClick={toggleBets}
                >
                  {betsLoading ? 'Загрузка…' : showBets ? 'Скрыть ставки ▴' : (
                    <>
                      Ставки игроков ▾
                      {isLive && <span className="live-indicator"></span>}
                    </>
                  )}
                </button>
              </div>
              {showBets && (
                <div className="bets-section">
                  <div className="bets-hint">Ставки видны только после старта матча.</div>
                  {betsError && (
                    <div className="error-message small">
                      {betsError}
                    </div>
                  )}
                  {!betsError && (
                    <div className="bets-table-wrapper">
                      <table className="bets-table">
                        <thead>
                          <tr>
                            <th>Ник</th>
                            <th>Прогноз</th>
                            <th>Очки {isLive ? '(лайв)' : ''}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bets.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="empty-cell">Пока нет ставок</td>
                            </tr>
                          ) : (
                            bets.map((b) => (
                              <tr key={b.userId} className={`bet-row ${b.userId === (window as any)?.currentUserId ? 'me' : ''}`}>
                                <td className="nick">{b.name}</td>
                                <td className="pred">{b.predHome}:{b.predAway}</td>
                                <td className="points">{b.points}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
}

// Memoize to avoid rerender unless relevant match fields change
export const MatchCard = memo(MatchCardInner, (prevProps, nextProps) => {
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
