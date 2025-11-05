import type { TopScorer } from '../types';

interface TopScorerItemProps {
  scorer: TopScorer;
}

export function TopScorerItem({ scorer }: TopScorerItemProps) {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}.`;
  };

  return (
    <div className="leaderboard-item">
      <div className="rank">{getRankIcon(scorer.rank)}</div>
      <div className="player-info">
        <div className="player-name">{scorer.playerName}</div>
        <div className="player-stats">
          {scorer.teamName} | Матчи: {scorer.playedMatches} | Ассисты: {scorer.assists}
        </div>
      </div>
      <div className="points">⚽ {scorer.goals}</div>
    </div>
  );
}


