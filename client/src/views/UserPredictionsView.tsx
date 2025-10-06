import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { api } from '../api';
import { useUser } from '../hooks/useUser';
import type { User, Match, Prediction } from '../types';

interface UserPredictionData {
  user: User;
  predictions: (Prediction & { match: Match })[];
  matches: Match[];
}

interface UserPredictionsViewProps {
  userId: string;
  onBack: () => void;
}

export function UserPredictionsView({ userId, onBack }: UserPredictionsViewProps) {
  const { user: currentUser } = useUser();
  const [data, setData] = useState<UserPredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null); // matchId being saved

  useEffect(() => {
    // Don't check userId immediately on mount, give React time to update props
    if (!currentUser) {
      return; // Wait for user to load
    }

    if (currentUser.role !== 'ADMIN') {
      onBack();
      return;
    }

    if (!userId) {
      // Only call onBack if we've had time for props to update
      const timeoutId = setTimeout(() => {
        if (!userId) {
          onBack();
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    loadUserPredictions();
  }, [userId, currentUser, onBack]);

  const loadUserPredictions = async () => {
    if (!userId) return;
    
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

  const handleUpdatePrediction = async (matchId: string, predHome: number, predAway: number) => {
    if (!userId || !data) return;

    setSaving(matchId);
    setError(null);
    try {
      await api.updateUserPrediction(userId, matchId, predHome, predAway);
      await loadUserPredictions(); // Reload to get updated data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения прогноза');
    } finally {
      setSaving(null);
    }
  };

  const handleDeletePrediction = async (matchId: string) => {
    if (!userId || !data) return;
    
    if (!confirm('Удалить прогноз для этого матча?')) return;

    setSaving(matchId);
    setError(null);
    try {
      await api.deleteUserPrediction(userId, matchId);
      await loadUserPredictions(); // Reload to get updated data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления прогноза');
    } finally {
      setSaving(null);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPredictionForMatch = (matchId: string) => {
    return data?.predictions.find(p => p.matchId === matchId);
  };

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

  return (
    <div>
      <div className="header">
        <button onClick={onBack} className="back-button">← Назад</button>
        📝 Прогнозы игрока: {data.user.name}
      </div>

      <div className="container">
        <div className="match-card">
          <h3>Информация об игроке</h3>
          <p><strong>Имя:</strong> {data.user.name}</p>
          <p><strong>ID:</strong> {data.user.id}</p>
          <p><strong>Telegram ID:</strong> {data.user.tg_user_id}</p>
          <p><strong>Всего прогнозов:</strong> {data.predictions.length}</p>
        </div>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <div className="matches-list">
          {data.matches.map(match => {
            const prediction = getPredictionForMatch(match.id);
            const isSaving = saving === match.id;
            
            return (
              <MatchPredictionCard
                key={match.id}
                match={match}
                prediction={prediction}
                onUpdate={(predHome, predAway) => handleUpdatePrediction(match.id, predHome, predAway)}
                onDelete={() => handleDeletePrediction(match.id)}
                saving={isSaving}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface MatchPredictionCardProps {
  match: Match;
  prediction?: Prediction;
  onUpdate: (predHome: number, predAway: number) => void;
  onDelete: () => void;
  saving: boolean;
}

function MatchPredictionCard({ match, prediction, onUpdate, onDelete, saving }: MatchPredictionCardProps) {
  const [predHome, setPredHome] = useState(prediction?.predHome ?? 0);
  const [predAway, setPredAway] = useState(prediction?.predAway ?? 0);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setPredHome(prediction?.predHome ?? 0);
    setPredAway(prediction?.predAway ?? 0);
  }, [prediction]);

  const handleSave = () => {
    onUpdate(predHome, predAway);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setPredHome(prediction?.predHome ?? 0);
    setPredAway(prediction?.predAway ?? 0);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
    // Временно скрываем навигацию Telegram для лучшего UX
    if (WebApp.isExpanded) {
      WebApp.expand();
    }
  };

  const handleInputFocus = () => {
    // Скрываем навигацию при фокусе
    const nav = document.querySelector('.navigation');
    if (nav) nav.classList.add('keyboard-active');
  };

  const handleInputBlur = () => {
    // Показываем навигацию при потере фокуса
    const nav = document.querySelector('.navigation');
    if (nav) nav.classList.remove('keyboard-active');
  };

  const handleHomeIncrement = () => {
    if (isEditing) {
      setPredHome(Math.min(9, predHome + 1));
    }
  };

  const handleHomeDecrement = () => {
    if (isEditing) {
      setPredHome(Math.max(0, predHome - 1));
    }
  };

  const handleAwayIncrement = () => {
    if (isEditing) {
      setPredAway(Math.min(9, predAway + 1));
    }
  };

  const handleAwayDecrement = () => {
    if (isEditing) {
      setPredAway(Math.max(0, predAway - 1));
    }
  };

  useEffect(() => {
    if (isEditing) {
      // Предотвращаем автозакрытие WebApp при фокусе на input
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && isEditing) {
          WebApp.expand();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isEditing]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      SCHEDULED: { text: 'Запланирован', color: '#6b7280' },
      LIVE: { text: 'В ИГРЕ', color: '#dc2626' },
      IN_PLAY: { text: 'В ИГРЕ', color: '#dc2626' },
      PAUSED: { text: 'Пауза', color: '#f59e0b' },
      FINISHED: { text: 'Завершён', color: '#059669' },
      POSTPONED: { text: 'Отложен', color: '#d97706' },
      SUSPENDED: { text: 'Приостановлен', color: '#8b5cf6' },
      CANCELLED: { text: 'Отменён', color: '#6b7280' }
    };
    
    const statusInfo = statusMap[status] || { text: status, color: '#6b7280' };
    
    return (
      <span 
        className="status-badge" 
        style={{ backgroundColor: statusInfo.color }}
      >
        {statusInfo.text}
      </span>
    );
  };

  const hasResult = match.scoreHome != null && match.scoreAway != null;

  return (
    <div className="match-card">
      <div className="match-header">
        <div className="teams">
          <span className="team">{match.homeTeam}</span>
          <span className="vs">vs</span>
          <span className="team">{match.awayTeam}</span>
        </div>
        <div className="match-info">
          <span className="time">{formatDateTime(match.kickoffAt)}</span>
          {getStatusBadge(match.status)}
        </div>
      </div>

      {hasResult && (
        <div className="match-result">
          <span className="result-label">Результат:</span>
          <span className="score">{match.scoreHome} : {match.scoreAway}</span>
        </div>
      )}

      <div className="prediction-section">
        <div className="prediction-display">
          {prediction ? (
            <div className="prediction-current">
              <span className="prediction-label">Прогноз:</span>
              <span className={`prediction-score ${isEditing ? 'editing' : ''}`}>
                {isEditing ? (
                  <div className="score-edit-inputs">
                    <div className="score-input-container">
                      <div className="score-buttons-column">
                        <button 
                          className="score-button score-button-plus"
                          onClick={handleHomeIncrement}
                          disabled={saving || predHome >= 9}
                          type="button"
                        >
                          +
                        </button>
                        <button 
                          className="score-button score-button-minus"
                          onClick={handleHomeDecrement}
                          disabled={saving || predHome <= 0}
                          type="button"
                        >
                          −
                        </button>
                      </div>
                      <input
                        type="number"
                        value={predHome}
                        onChange={(e) => setPredHome(Number(e.target.value))}
                        min="0"
                        max="9"
                        className="score-input-edit"
                        disabled={saving}
                        autoFocus
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                      />
                    </div>
                    <span className="score-separator">:</span>
                    <div className="score-input-container">
                      <input
                        type="number"
                        value={predAway}
                        onChange={(e) => setPredAway(Number(e.target.value))}
                        min="0"
                        max="9"
                        className="score-input-edit"
                        disabled={saving}
                      />
                      <div className="score-buttons-column">
                        <button 
                          className="score-button score-button-plus"
                          onClick={handleAwayIncrement}
                          disabled={saving || predAway >= 9}
                          type="button"
                        >
                          +
                        </button>
                        <button 
                          className="score-button score-button-minus"
                          onClick={handleAwayDecrement}
                          disabled={saving || predAway <= 0}
                          type="button"
                        >
                          −
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  `${predHome} : ${predAway}`
                )}
              </span>
            </div>
          ) : (
            <div className="prediction-current">
              <span className="no-prediction">
                {isEditing ? (
                  <div className="score-edit-inputs">
                    <div className="score-input-container">
                      <div className="score-buttons-column">
                        <button 
                          className="score-button score-button-plus"
                          onClick={handleHomeIncrement}
                          disabled={saving || predHome >= 9}
                          type="button"
                        >
                          +
                        </button>
                        <button 
                          className="score-button score-button-minus"
                          onClick={handleHomeDecrement}
                          disabled={saving || predHome <= 0}
                          type="button"
                        >
                          −
                        </button>
                      </div>
                      <input
                        type="number"
                        value={predHome}
                        onChange={(e) => setPredHome(Number(e.target.value))}
                        min="0"
                        max="9"
                        className="score-input-edit"
                        disabled={saving}
                        autoFocus
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                      />
                    </div>
                    <span className="score-separator">:</span>
                    <div className="score-input-container">
                      <input
                        type="number"
                        value={predAway}
                        onChange={(e) => setPredAway(Number(e.target.value))}
                        min="0"
                        max="9"
                        className="score-input-edit"
                        disabled={saving}
                      />
                      <div className="score-buttons-column">
                        <button 
                          className="score-button score-button-plus"
                          onClick={handleAwayIncrement}
                          disabled={saving || predAway >= 9}
                          type="button"
                        >
                          +
                        </button>
                        <button 
                          className="score-button score-button-minus"
                          onClick={handleAwayDecrement}
                          disabled={saving || predAway <= 0}
                          type="button"
                        >
                          −
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  'Прогноз не сделан'
                )}
              </span>
            </div>
          )}
        </div>

        <div className="prediction-actions">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="save-button"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="cancel-button"
              >
                Отмена
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEdit}
                disabled={saving}
                className="edit-button"
              >
                {prediction ? 'Изменить' : 'Создать прогноз'}
              </button>
              {prediction && (
                <button
                  onClick={onDelete}
                  disabled={saving}
                  className="delete-button"
                >
                  {saving ? 'Удаление...' : 'Удалить'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
