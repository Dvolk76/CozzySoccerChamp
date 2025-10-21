import { useState, useEffect } from 'react';
import { api } from '../api';
import { useUser } from '../hooks/useUser';
import { useCacheStats } from '../hooks/useData';
import { LastSync } from '../components/LastSync';
import type { User } from '../types';

interface AdminViewProps {
  onEditUserPredictions?: (userId: string) => void;
  onManageMatches?: () => void;
}

export function AdminView({ onEditUserPredictions, onManageMatches }: AdminViewProps = {}) {
  const { user, claimAdmin } = useUser();
  const isAdmin = user?.role === 'ADMIN';
  const { stats, loading: loadingStats, refreshCache, lastUpdate } = useCacheStats(isAdmin);
  
  const [syncing, setSyncing] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [awardState, setAwardState] = useState<{ champion?: string; topScorer?: string; championPoints?: number; topScorerPoints?: number }>({ championPoints: 5, topScorerPoints: 5 });
  const [teams, setTeams] = useState<string[]>([]);
  const [awarding, setAwarding] = useState(false);

  const handleClaimAdmin = async () => {
    // Сбор «секретных» нажатий: 10 раз за 10 секунд
    const now = Date.now();
    const recent = [...tapTimes, now].filter(t => now - t <= 10000);
    setTapTimes(recent);

    const isSecretUnlocked = recent.length >= 10;

    try {
      if (isSecretUnlocked) {
        await claimAdmin('Kukuruza');
      } else if (password) {
        await claimAdmin(password);
      } else {
        // Если пароль пуст и секрет не набран — просто копим нажатия
        return;
      }

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

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Удалить пользователя "${userName}"? Это действие необратимо.`)) return;
    setDeletingUserId(userId);
    setError(null);
    try {
      await api.deleteUser(userId);
      setMessage(`Пользователь "${userName}" успешно удален`);
      setTimeout(() => setMessage(null), 3000);
      // Обновляем список пользователей
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления пользователя');
    } finally {
      setDeletingUserId(null);
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadUsers();
      // preload teams for award UI
      api.getTeams().then(r => setTeams(r.teams)).catch(() => {});
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
        <LastSync lastUpdate={lastUpdate} isLoading={loadingStats} />
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
              <button onClick={handleClaimAdmin} className="predict-button">
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
              <h3>Бонусы за итог турнира</h3>
              <p>Начислить бонусные очки за угадавших чемпиона и лучшего бомбардира</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)' }}>Чемпион</div>
                  <select
                    value={awardState.champion ?? ''}
                    onChange={(e) => setAwardState(s => ({ ...s, champion: e.target.value || undefined }))}
                    className="score-input"
                  >
                    <option value="">— не учитывать —</option>
                    {teams.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)' }}>Очки за чемпиона</div>
                  <input
                    type="number"
                    value={awardState.championPoints ?? 5}
                    onChange={(e) => setAwardState(s => ({ ...s, championPoints: Number(e.target.value) }))}
                    className="score-input"
                    style={{ width: 80 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)' }}>Лучший бомбардир</div>
                  <input
                    type="text"
                    value={awardState.topScorer ?? ''}
                    onChange={(e) => setAwardState(s => ({ ...s, topScorer: e.target.value || undefined }))}
                    className="score-input"
                    placeholder="Имя игрока"
                    style={{ minWidth: 180 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--tg-theme-hint-color)' }}>Очки за бомбардира</div>
                  <input
                    type="number"
                    value={awardState.topScorerPoints ?? 5}
                    onChange={(e) => setAwardState(s => ({ ...s, topScorerPoints: Number(e.target.value) }))}
                    className="score-input"
                    style={{ width: 80 }}
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('Начислить бонусные очки по итогам турнира? Действие перезапишет предыдущие бонусы.')) return;
                    setAwarding(true);
                    setError(null);
                    try {
                      await api.awardBonuses(awardState.champion, awardState.topScorer, awardState.championPoints, awardState.topScorerPoints);
                      setMessage('Бонусы начислены');
                      setTimeout(() => setMessage(null), 3000);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Ошибка начисления бонусов');
                    } finally {
                      setAwarding(false);
                    }
                  }}
                  disabled={awarding}
                  className="predict-button"
                >
                  {awarding ? 'Начисление...' : 'Начислить бонусы'}
                </button>
              </div>
            </div>

            <div className="match-card">
              <h3>⚽ Управление матчами</h3>
              <p>Редактирование счетов матчей и результатов</p>
              {onManageMatches ? (
                <button
                  onClick={onManageMatches}
                  className="predict-button"
                  style={{ marginTop: '8px' }}
                >
                  Управление матчами
                </button>
              ) : (
                <p style={{ color: 'var(--tg-theme-hint-color)', fontStyle: 'italic' }}>
                  Функция недоступна
                </p>
              )}
            </div>

            <div className="match-card">
              <h3>Управление игроками</h3>
              <p>Редактирование прогнозов и удаление пользователей</p>
              {loadingUsers ? (
                <div>Загрузка пользователей...</div>
              ) : (
                <div className="users-list">
                  {users.length === 0 ? (
                    <p>Пользователей пока нет</p>
                  ) : (
                    users.map(u => (
                      <div key={u.id} className="user-item" style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '8px',
                        borderBottom: '1px solid var(--tg-theme-hint-color, #eee)'
                      }}>
                        <div className="user-info" style={{ flex: 1 }}>
                          {onEditUserPredictions ? (
                            <span 
                              className="user-name clickable"
                              onClick={() => onEditUserPredictions(u.id)}
                              style={{ cursor: 'pointer', color: 'var(--tg-theme-button-color)' }}
                            >
                              {u.name}
                            </span>
                          ) : (
                            <span className="user-name">{u.name}</span>
                          )}
                          <span className="user-role" style={{ 
                            marginLeft: '8px', 
                            fontSize: '0.85em', 
                            color: 'var(--tg-theme-hint-color)' 
                          }}>
                            {u.role}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          disabled={deletingUserId === u.id || u.id === user?.id}
                          className="predict-button"
                          style={{
                            background: 'var(--tg-theme-destructive-text-color, #dc3545)',
                            fontSize: '0.85em',
                            padding: '4px 8px',
                            minWidth: '60px'
                          }}
                          title={u.id === user?.id ? 'Нельзя удалить себя' : 'Удалить пользователя'}
                        >
                          {deletingUserId === u.id ? '...' : '🗑️'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
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
