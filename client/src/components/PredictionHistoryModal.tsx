import { useEffect, useState } from 'react';
import { api } from '../api';
import type { PredictionHistoryResponse } from '../types';
import { haptic } from '../utils/haptic';

interface PredictionHistoryModalProps {
  userId: string;
  matchId: string;
  onClose: () => void;
}

export function PredictionHistoryModal({ userId, matchId, onClose }: PredictionHistoryModalProps) {
  const [data, setData] = useState<PredictionHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getPredictionHistory(userId, matchId);
        setData(response);
      } catch (err) {
        console.error('Failed to load prediction history:', err);
        setError('Не удалось загрузить историю');
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [userId, matchId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="modal-overlay" onClick={() => {
      haptic.light();
      onClose();
    }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">📜 История прогноза</h2>
          <button onClick={() => {
            haptic.light();
            onClose();
          }} className="modal-close">×</button>
        </div>

        <div className="modal-content">
          {loading && (
            <div className="modal-loading">
              <div className="spinner"></div>
              <p className="modal-hint">Загрузка истории...</p>
            </div>
          )}

          {error && (
            <div className="modal-error">
              <p>❌ {error}</p>
            </div>
          )}

          {data && !loading && !error && (
            <>
              <div className="modal-user">
                {data.user.avatar && (
                  <img src={data.user.avatar} alt={data.user.name} className="modal-avatar" />
                )}
                <div className="modal-user-meta">
                  <p className="modal-user-name">{data.user.name}</p>
                  <p className="modal-match">{data.match.homeTeam} vs {data.match.awayTeam}</p>
                </div>
              </div>

              <div className="modal-stats">
                <div className="stat-card stat-purple">
                  <p className="stat-value">{data.totalChanges}</p>
                  <p className="stat-label">
                    {data.totalChanges === 0
                      ? 'Изменений'
                      : data.totalChanges === 1
                      ? 'Изменение'
                      : 'Изменения'}
                  </p>
                </div>
                <div className="stat-card stat-blue">
                  <p className="stat-value">{data.history.length + (data.current ? 1 : 0)}</p>
                  <p className="stat-label">Всего версий</p>
                </div>
              </div>

              <div className="timeline">
                <h3 className="timeline-title">⏱️ Временная шкала</h3>

                {data.current && (
                  <div className="timeline-item current">
                    <div className="timeline-dot current">✓</div>
                    <div className="timeline-line current"></div>
                    <div className="timeline-box current">
                      <div className="timeline-header">
                        <span className="timeline-current-label">✅ Текущий прогноз</span>
                        <span className="timeline-time">{formatDate(data.current.createdAt)}</span>
                      </div>
                      <div className="timeline-score">
                        <span className="score-num current">{data.current.predHome}</span>
                        <span className="score-sep">:</span>
                        <span className="score-num current">{data.current.predAway}</span>
                      </div>
                    </div>
                  </div>
                )}

                {data.history.length > 0 ? (
                  data.history.map((entry, index) => (
                    <div key={index} className="timeline-item">
                      <div className="timeline-dot">{data.history.length - index}</div>
                      {index < data.history.length - 1 && (
                        <div className="timeline-line"></div>
                      )}
                      <div className="timeline-box">
                        <div className="timeline-header">
                          <span className="timeline-prev-label">📝 Предыдущий прогноз</span>
                          <span className="timeline-time">{formatDate(entry.createdAt)}</span>
                        </div>
                        <div className="timeline-score">
                          <span className="score-num">{entry.predHome}</span>
                          <span className="score-sep">:</span>
                          <span className="score-num">{entry.predAway}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="modal-empty">
                    <p>🎯 Прогноз не изменялся</p>
                    <p className="modal-hint small">Уверенный выбор!</p>
                  </div>
                )}
              </div>

              {data.totalChanges > 0 && (
                <div className="modal-footer-note">
                  <p className="modal-footer-text">
                    {data.totalChanges === 1
                      ? '🤔 Передумал раз...'
                      : data.totalChanges === 2
                      ? '😅 Передумал пару раз'
                      : data.totalChanges >= 3
                      ? '😱 Передумывал много раз!'
                      : ''}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

