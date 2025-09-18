import { useState, useEffect } from 'react';
import { api } from '../api';
import { useUser } from '../hooks/useUser';
import { useCacheStats } from '../hooks/useData';
import type { User } from '../types';

interface AdminViewProps {
  onEditUserPredictions?: (userId: string) => void;
}

export function AdminView({ onEditUserPredictions }: AdminViewProps = {}) {
  const { user, claimAdmin } = useUser();
  const isAdmin = user?.role === 'ADMIN';
  const { stats, loading: loadingStats, refreshCache } = useCacheStats(isAdmin);
  
  const [syncing, setSyncing] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [wiping, setWiping] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const handleClaimAdmin = async () => {
    try {
      await claimAdmin(password);
      setMessage('Вы стали администратором!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка получения прав админа');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await api.syncMatches();
      setMessage(`Синхронизировано ${response.count} матчей`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка синхронизации');
    } finally {
      setSyncing(false);
    }
  };

  const handleRecalc = async () => {
    setRecalcing(true);
    setError(null);
    try {
      const response = await api.recalcAll();
      setMessage(`Пересчитано очков по ${response.matches} матчам`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка пересчёта');
    } finally {
      setRecalcing(false);
    }
  };

  const handleWipeUsers = async () => {
    if (!password) {
      setError('Введите пароль для подтверждения');
      return;
    }
    if (!confirm('Удалить всех пользователей? Это действие необратимо.')) return;
    setWiping(true);
    setError(null);
    try {
      const response = await api.wipeUsers(password);
      setMessage(`Удалено пользователей: ${response.deletedUsers}`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления пользователей');
    } finally {
      setWiping(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await api.getUsers();
      setUsers(response.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки пользователей');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRefreshCache = async () => {
    try {
      await refreshCache();
      setMessage('Кэш успешно обновлен');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления кэша');
    }
  };

  const formatCacheAge = (age: number) => {
    const seconds = Math.floor(age / 1000);
    if (seconds < 60) return `${seconds}с`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}м ${seconds % 60}с`;
    const hours = Math.floor(minutes / 60);
    return `${hours}ч ${minutes % 60}м`;
  };

  return (
    <div>
      <div className="header">
        ⚙️ Администрирование
        {isAdmin && <span className="admin-badge">ADMIN</span>}
      </div>

      <div className="container">
        {!isAdmin && (
          <div className="match-card">
            <h3>Стать администратором</h3>
            <p>Введите пароль и нажмите кнопку ниже:</p>
            <div className="prediction-form" style={{ marginTop: '8px' }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                className="score-input"
                style={{ width: '120px' }}
              />
              <button onClick={handleClaimAdmin} className="predict-button" disabled={!password}>
                Стать админом
              </button>
            </div>
          </div>
        )}

        {isAdmin && (
          <>
            <div className="match-card">
              <h3>📊 Статистика кэша</h3>
              <p>Информация о кэшировании данных и API лимитах</p>
              {loadingStats ? (
                <div>Загрузка статистики...</div>
              ) : (
                <div style={{ marginBottom: '16px' }}>
                  {Object.entries(stats).map(([key, info]: [string, any]) => (
                    <div key={key} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: '4px 0',
                      borderBottom: '1px solid #eee'
                    }}>
                      <span>{key}:</span>
                      <span style={{ color: info.expired ? '#dc3545' : '#28a745' }}>
                        {formatCacheAge(info.age)} / {Math.floor(info.ttl / 1000)}с
                        {info.expired && ' (истек)'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleRefreshCache}
                className="predict-button"
                style={{ marginRight: '8px' }}
              >
                Обновить кэш
              </button>
            </div>

            <div className="match-card">
              <h3>Синхронизация матчей</h3>
              <p>Загрузить расписание матчей Лиги чемпионов из football-data.org (кэшируется на 1 минуту)</p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="predict-button"
              >
                {syncing ? 'Синхронизация...' : 'Синхронизировать календарь'}
              </button>
            </div>

            <div className="match-card">
              <h3>Пересчёт очков</h3>
              <p>Пересчитать очки всех пользователей по завершённым матчам</p>
              <button
                onClick={handleRecalc}
                disabled={recalcing}
                className="predict-button"
              >
                {recalcing ? 'Пересчёт...' : 'Пересчитать очки'}
              </button>
            </div>

            <div className="match-card">
              <h3>Управление игроками</h3>
              <p>Редактирование прогнозов пользователей</p>
              {loadingUsers ? (
                <div>Загрузка пользователей...</div>
              ) : (
                <div className="users-list">
                  {users.length === 0 ? (
                    <p>Пользователей пока нет</p>
                  ) : (
                    users.map(u => (
                      <div key={u.id} className="user-item">
                        <div className="user-info">
                          <span className="user-name">{u.name}</span>
                          <span className="user-role">{u.role}</span>
                        </div>
                        {onEditUserPredictions && (
                          <button
                            onClick={() => onEditUserPredictions(u.id)}
                            className="edit-predictions-button"
                          >
                            Редактировать прогнозы
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="match-card">
              <h3>Удалить всех пользователей</h3>
              <p>Только для разработки. Требуется пароль для подтверждения.</p>
              <div className="prediction-form" style={{ marginTop: '8px' }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль"
                  className="score-input"
                  style={{ width: '120px' }}
                />
                <button
                  onClick={handleWipeUsers}
                  disabled={wiping || !password}
                  className="predict-button"
                >
                  {wiping ? 'Удаление...' : 'Удалить пользователей'}
                </button>
              </div>
            </div>
          </>
        )}

        {message && (
          <div className="match-card" style={{ background: '#d4edda', border: '1px solid #c3e6cb' }}>
            {message}
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
