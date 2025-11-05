import { useEffect, useState } from 'react';
import { api } from '../api';
import { haptic } from '../utils/haptic';

interface BetRow {
  userId: string;
  name: string;
  tg_user_id?: string;
  predHome: number;
  predAway: number;
  points: number;
  createdAt: string;
}

interface BetsModalProps {
  matchId: string;
  isOpen: boolean;
  onClose: () => void;
  onPredictionClick: (userId: string) => void;
  isLive?: boolean;
}

export function BetsModal({ matchId, isOpen, onClose, onPredictionClick, isLive = false }: BetsModalProps) {
  const [bets, setBets] = useState<BetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    async function loadBets() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getMatchPredictions(matchId);
        setBets(data.predictions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить ставки');
      } finally {
        setLoading(false);
      }
    }

    loadBets();

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, matchId]);

  return (
    <div className="modal-overlay" onClick={() => { haptic.light(); onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">👥 Ставки игроков</h2>
          <button onClick={() => { haptic.light(); onClose(); }} className="modal-close">×</button>
        </div>

        <div className="modal-content">
          {loading && (
            <div className="modal-loading">
              <div className="spinner"></div>
              <p className="modal-hint">Загрузка ставок...</p>
            </div>
          )}

          {error && (
            <div className="modal-error">
              <p>❌ {error}</p>
            </div>
          )}

          {!loading && !error && (
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
                        onClick={() => onPredictionClick(b.userId)}
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
      </div>
    </div>
  );
}


