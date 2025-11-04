import { memo, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Match } from '../types';
import { getMatchStatus, isMatchActive } from '../utils/matchStatus';
import { PredictionHistoryModal } from './PredictionHistoryModal';

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

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const kickoffTime = new Date(match.kickoffAt);
  const isLocked = new Date() >= kickoffTime;
  const hasScore = match.scoreHome != null && match.scoreAway != null;
  
  // Debug: показываем данные для live матчей
  const status = getMatchStatus(match);
  const isLive = isMatchActive(match);
  
  if (isLive) {
    console.log('🔴 LIVE MATCH DATA:', {
      teams: `${match.homeTeam} vs ${match.awayTeam}`,
      status: match.status,
      scoreHome: match.scoreHome,
      scoreAway: match.scoreAway,
      hasScore,
      statusInfo: status
    });
  }

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

  const handleHomeIncrement = () => {
    if (!isLocked && (hasExistingPrediction ? isEditing : true)) {
      setPredHome(Math.min(9, predHome + 1));
    }
  };

  const handleHomeDecrement = () => {
    if (!isLocked && (hasExistingPrediction ? isEditing : true)) {
      setPredHome(Math.max(0, predHome - 1));
    }
  };

  const handleAwayIncrement = () => {
    if (!isLocked && (hasExistingPrediction ? isEditing : true)) {
      setPredAway(Math.min(9, predAway + 1));
    }
  };

  const handleAwayDecrement = () => {
    if (!isLocked && (hasExistingPrediction ? isEditing : true)) {
      setPredAway(Math.max(0, predAway - 1));
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

  const handlePredictionClick = (userId: string) => {
    setSelectedUserId(userId);
    setHistoryModalOpen(true);
  };

  const closeHistoryModal = () => {
    setHistoryModalOpen(false);
    setSelectedUserId(null);
  };

  return (
    <div className="match-card">
      <div className="match-header">
        <span className="match-stage">{translateStage(match.stage)}</span>
        {!isLive && (
          <span className={`match-status ${status.class}`}>{status.text}</span>
        )}
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

      {!isLocked ? (
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
                              <tr 
                                key={b.userId} 
                                className={`bet-row ${b.userId === (window as any)?.currentUserId ? 'me' : ''}`}
                                onClick={() => handlePredictionClick(b.userId)}
                                style={{ cursor: 'pointer' }}
                                title="Нажмите, чтобы увидеть историю изменений"
                              >
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
                              <tr 
                                key={b.userId} 
                                className={`bet-row ${b.userId === (window as any)?.currentUserId ? 'me' : ''}`}
                                onClick={() => handlePredictionClick(b.userId)}
                                style={{ cursor: 'pointer' }}
                                title="Нажмите, чтобы увидеть историю изменений"
                              >
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

      {/* History Modal */}
      {historyModalOpen && selectedUserId && (
        <PredictionHistoryModal
          userId={selectedUserId}
          matchId={match.id}
          onClose={closeHistoryModal}
        />
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
