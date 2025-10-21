import { useEffect, useState } from 'react';
import { api } from '../api';
import type { PredictionHistoryResponse } from '../types';

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
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1a2e] rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto border border-purple-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">📜 История прогноза</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-3xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Загрузка истории...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-400">❌ {error}</p>
            </div>
          )}

          {data && !loading && !error && (
            <>
              {/* User Info */}
              <div className="mb-6 flex items-center gap-3 bg-purple-900/20 p-4 rounded-xl">
                {data.user.avatar && (
                  <img
                    src={data.user.avatar}
                    alt={data.user.name}
                    className="w-12 h-12 rounded-full border-2 border-purple-500"
                  />
                )}
                <div>
                  <p className="text-white font-semibold">{data.user.name}</p>
                  <p className="text-gray-400 text-sm">
                    {data.match.homeTeam} vs {data.match.awayTeam}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 p-4 rounded-xl text-center">
                  <p className="text-3xl font-bold text-white">{data.totalChanges}</p>
                  <p className="text-gray-300 text-sm mt-1">
                    {data.totalChanges === 0
                      ? 'Изменений'
                      : data.totalChanges === 1
                      ? 'Изменение'
                      : 'Изменения'}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 p-4 rounded-xl text-center">
                  <p className="text-3xl font-bold text-white">
                    {data.history.length + (data.current ? 1 : 0)}
                  </p>
                  <p className="text-gray-300 text-sm mt-1">Всего версий</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">⏱️ Временная шкала</h3>

                {/* Current Prediction */}
                {data.current && (
                  <div className="relative pl-8 pb-4">
                    <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                    <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-green-500 to-transparent"></div>
                    <div className="bg-gradient-to-r from-green-900/40 to-green-800/20 border border-green-500/30 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-green-400 font-semibold text-sm">
                          ✅ Текущий прогноз
                        </span>
                        <span className="text-gray-400 text-xs">
                          {formatDate(data.current.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl font-bold text-white">{data.current.predHome}</span>
                        <span className="text-gray-400">:</span>
                        <span className="text-3xl font-bold text-white">{data.current.predAway}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* History */}
                {data.history.length > 0 ? (
                  data.history.map((entry, index) => (
                    <div key={index} className="relative pl-8 pb-4">
                      <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center border-2 border-gray-700">
                        <span className="text-white text-xs font-bold">{data.history.length - index}</span>
                      </div>
                      {index < data.history.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-gray-600 to-gray-700"></div>
                      )}
                      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-400 font-semibold text-sm">
                            📝 Предыдущий прогноз
                          </span>
                          <span className="text-gray-500 text-xs">
                            {formatDate(entry.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-2xl font-bold text-gray-300">{entry.predHome}</span>
                          <span className="text-gray-500">:</span>
                          <span className="text-2xl font-bold text-gray-300">{entry.predAway}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p>🎯 Прогноз не изменялся</p>
                    <p className="text-sm mt-1">Уверенный выбор!</p>
                  </div>
                )}
              </div>

              {/* Footer Message */}
              {data.totalChanges > 0 && (
                <div className="mt-6 p-4 bg-purple-900/20 border border-purple-500/30 rounded-xl text-center">
                  <p className="text-purple-300 text-sm">
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

