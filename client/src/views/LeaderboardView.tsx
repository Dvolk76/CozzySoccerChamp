import { useMemo } from 'react';
import { LeaderboardItem } from '../components/LeaderboardItem';
import { useLeaderboard } from '../hooks/useData';
import type { LeaderboardItem as LeaderboardItemType } from '../types';

export function LeaderboardView() {
  try {
    const { leaderboard, loading, error, refresh, isPolling, lastUpdate } = useLeaderboard(true);
    
    const leaderboardWithRank = useMemo(() => {
      return leaderboard.map((item, index) => ({
        ...item,
        rank: index + 1,
      }));
    }, [leaderboard]);

  if (loading) {
    return <div className="loading">Загрузка лидерборда...</div>;
  }

  if (error) {
    return (
      <div className="error">
        {error}
        <button onClick={refresh} style={{ marginLeft: '8px' }}>
          Повторить
        </button>
      </div>
    );
  }

  if (leaderboardWithRank.length === 0) {
    return (
      <div className="loading">
        Нет данных о лидерах. Сделайте прогнозы и дождитесь результатов матчей.
      </div>
    );
  }

    return (
      <div>
        {leaderboardWithRank.map((item) => (
          <LeaderboardItem key={item.id} item={item} />
        ))}
      </div>
    );
  } catch (error) {
    console.error('LeaderboardView crashed:', error);
    return (
      <div>
        <div className="error">
          Произошла ошибка при загрузке лидерборда. 
          <button onClick={() => window.location.reload()} style={{ marginLeft: '8px' }}>
            Перезагрузить страницу
          </button>
        </div>
      </div>
    );
  }
}
