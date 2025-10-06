export interface User {
  id: string;
  tg_user_id: string;
  name: string;
  avatar?: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

// Football Data API v4 match status enum (официальная документация)
// https://www.football-data.org/documentation/api
export type MatchStatus = 
  | 'SCHEDULED'      // Match is scheduled but time might change  
  | 'LIVE'           // Match is currently in progress
  | 'IN_PLAY'        // Match is currently in progress (same as LIVE)
  | 'PAUSED'         // Match is temporarily halted
  | 'FINISHED'       // Match has ended
  | 'POSTPONED'      // Match has been postponed to a new date
  | 'SUSPENDED'      // Match has been suspended and may or may not resume
  | 'CANCELLED';     // Match has been cancelled and will not be played

export interface Match {
  id: string;
  extId?: string;
  stage: string;
  group?: string;
  matchday?: number;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  status: MatchStatus | string; // Allow string for backward compatibility
  scoreHome?: number;
  scoreAway?: number;
  createdAt: string;
  updatedAt: string;
  userPrediction?: {
    predHome: number;
    predAway: number;
  } | null;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  predHome: number;
  predAway: number;
  createdAt: string;
  lockedAt?: string;
}

export interface Score {
  id: string;
  userId: string;
  pointsTotal: number;
  exactCount: number;
  diffCount: number;
  outcomeCount: number;
  firstPredAt?: string;
  lastUpdated: string;
  user: User;
}

export interface LeaderboardItem extends Score {
  rank: number;
}

export interface RoundLeaderboardEntry {
  userId: string;
  userName: string;
  userAvatar?: string;
  points: number;
  exactCount: number;
  diffCount: number;
  outcomeCount: number;
  cumulativePoints: number;
}

export interface RoundLeaderboard {
  round: number;
  leaderboard: RoundLeaderboardEntry[];
}
