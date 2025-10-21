import type { Express, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { scoring } from '../services/scoring.js';

type Logger = { info: Function; warn: Function; error: Function };

export function registerLeaderboardRoutes(app: Express, prisma: PrismaClient, logger: Logger) {
  // Global leaderboard (cached)
  app.get('/api/leaderboard', async (req: Request, res: Response) => {
    try {
      const cachedDataService = (req as any).cachedDataService;
      if (!cachedDataService) {
        // Fallback to direct DB query if cache service not available
        const items = await prisma.score.findMany({ include: { user: true } });

        // Include bonusPoints in total and sort in-memory to mirror cached behavior
        const leaderboard = items
          .map((s) => ({
            ...s,
            pointsTotal: (s.pointsTotal || 0) + (s as any).bonusPoints || 0,
          }))
          .sort((a, b) => {
            if (a.pointsTotal !== b.pointsTotal) return b.pointsTotal - a.pointsTotal;
            if (a.exactCount !== b.exactCount) return b.exactCount - a.exactCount;
            if (a.diffCount !== b.diffCount) return b.diffCount - a.diffCount;
            if (a.outcomeCount !== b.outcomeCount) return b.outcomeCount - a.outcomeCount;
            if (a.firstPredAt && b.firstPredAt) return new Date(a.firstPredAt).getTime() - new Date(b.firstPredAt).getTime();
            return 0;
          })
          .slice(0, 100);

        return res.json({ leaderboard });
      }
      
      const leaderboard = await cachedDataService.getLeaderboard();
      res.json({ leaderboard });
    } catch (error) {
      logger.error({ error }, 'Failed to get leaderboard');
      res.status(500).json({ error: 'Failed to get leaderboard' });
    }
  });

  // Historical leaderboard by rounds
  app.get('/api/leaderboard/by-rounds', async (req: Request, res: Response) => {
    try {
      logger.info('Fetching historical leaderboard by rounds');

      // Получаем все завершенные матчи с прогнозами
      const matches = await prisma.match.findMany({
        where: {
          matchday: { not: null },
          status: 'FINISHED',
          scoreHome: { not: null },
          scoreAway: { not: null }
        },
        include: {
          predictions: {
            include: {
              user: true
            }
          }
        },
        orderBy: { matchday: 'asc' }
      });

      // Группируем матчи по турам
      const matchesByRound = new Map<number, typeof matches>();
      matches.forEach(match => {
        if (match.matchday !== null) {
          if (!matchesByRound.has(match.matchday)) {
            matchesByRound.set(match.matchday, []);
          }
          matchesByRound.get(match.matchday)!.push(match);
        }
      });

      // Вычисляем очки для каждого тура
      const roundsData: Array<{
        round: number;
        leaderboard: Array<{
          userId: string;
          userName: string;
          userAvatar?: string;
          points: number;
          exactCount: number;
          diffCount: number;
          outcomeCount: number;
          cumulativePoints: number;
        }>;
      }> = [];

      const cumulativeScores = new Map<string, number>();

      const sortedRounds = Array.from(matchesByRound.keys()).sort((a, b) => a - b);

      for (const round of sortedRounds) {
        const roundMatches = matchesByRound.get(round)!;
        
        // Подсчет очков за текущий тур
        const userScores = new Map<string, {
          userId: string;
          userName: string;
          userAvatar?: string;
          points: number;
          exactCount: number;
          diffCount: number;
          outcomeCount: number;
        }>();

        roundMatches.forEach(match => {
          if (match.scoreHome !== null && match.scoreAway !== null) {
            const actual = { home: match.scoreHome, away: match.scoreAway };

            match.predictions.forEach(pred => {
              if (!userScores.has(pred.userId)) {
                userScores.set(pred.userId, {
                  userId: pred.userId,
                  userName: pred.user.name,
                  userAvatar: pred.user.avatar || undefined,
                  points: 0,
                  exactCount: 0,
                  diffCount: 0,
                  outcomeCount: 0
                });
              }

              const score = userScores.get(pred.userId)!;
              const points = scoring(
                { home: pred.predHome, away: pred.predAway },
                actual
              );

              score.points += points;
              if (points === 5) score.exactCount++;
              else if (points === 3) score.diffCount++;
              else if (points === 2) score.outcomeCount++;
            });
          }
        });

        // Обновляем кумулятивные очки
        userScores.forEach(score => {
          const current = cumulativeScores.get(score.userId) || 0;
          cumulativeScores.set(score.userId, current + score.points);
        });

        // Формируем лидерборд для тура
        const roundLeaderboard = Array.from(userScores.values()).map(score => ({
          ...score,
          cumulativePoints: cumulativeScores.get(score.userId) || 0
        })).sort((a, b) => {
          // Сортируем по очкам за тур
          if (b.points !== a.points) return b.points - a.points;
          if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
          if (b.diffCount !== a.diffCount) return b.diffCount - a.diffCount;
          return b.outcomeCount - a.outcomeCount;
        });

        roundsData.push({
          round,
          leaderboard: roundLeaderboard
        });
      }

      res.json({ rounds: roundsData });
    } catch (error) {
      logger.error({ error }, 'Failed to get historical leaderboard');
      res.status(500).json({ error: 'Failed to get historical leaderboard' });
    }
  });
}


