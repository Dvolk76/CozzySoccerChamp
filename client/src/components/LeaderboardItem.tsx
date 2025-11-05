import type { LeaderboardItem } from '../types';
import { getInitials } from '../utils/avatar';

interface LeaderboardItemProps {
  item: LeaderboardItem;
}

export function LeaderboardItem({ item }: LeaderboardItemProps) {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}.`;
  };

  return (
    <div className="leaderboard-item">
      <div className="rank">{getRankIcon(item.rank)}</div>
      <div className="leaderboard-avatar-wrapper">
        {item.user.avatar ? (
          <img
            src={item.user.avatar}
            alt={item.user.name}
            className="leaderboard-avatar"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="leaderboard-avatar-fallback">{getInitials(item.user.name)}</span>
        )}
      </div>
      <div className="player-info">
        <div className="player-name">{item.user.name}</div>
        <div className="player-stats">
          Точные: {item.exactCount} | Разность: {item.diffCount} | Исходы: {item.outcomeCount}
        </div>
      </div>
      <div className="points">{item.pointsTotal}</div>
    </div>
  );
}
