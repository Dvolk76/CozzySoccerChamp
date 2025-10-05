#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Функция подсчета очков
function scoring(pred, actual) {
  if (pred.home === actual.home && pred.away === actual.away) return 5;

  const predDiff = pred.home - pred.away;
  const actualDiff = actual.home - actual.away;

  const predOutcome = Math.sign(predDiff);
  const actualOutcome = Math.sign(actualDiff);

  if (predOutcome === actualOutcome && Math.abs(predDiff) === Math.abs(actualDiff)) return 3;
  if (predOutcome === actualOutcome) return 2;
  return 0;
}

async function recalcAllScores() {
  try {
    console.log('🔄 Пересчет всех очков...\n');

    // Получаем все завершенные матчи с результатами
    const finishedMatches = await prisma.match.findMany({
      where: {
        status: 'FINISHED',
        scoreHome: { not: null },
        scoreAway: { not: null }
      },
      include: {
        predictions: {
          include: {
            user: {
              select: { name: true }
            }
          }
        }
      }
    });

    console.log(`📊 Найдено ${finishedMatches.length} завершенных матчей с результатами\n`);

    if (finishedMatches.length === 0) {
      console.log('❌ Нет завершенных матчей с результатами');
      return;
    }

    // Собираем все очки по пользователям
    const userScores = {};

    for (const match of finishedMatches) {
      const actual = { home: match.scoreHome, away: match.scoreAway };
      
      console.log(`⚽ ${match.homeTeam} vs ${match.awayTeam} (${match.scoreHome}:${match.scoreAway})`);
      
      for (const pred of match.predictions) {
        const points = scoring({ home: pred.predHome, away: pred.predAway }, actual);
        
        if (!userScores[pred.userId]) {
          userScores[pred.userId] = {
            name: pred.user.name,
            total: 0,
            exact: 0,
            diff: 0,
            outcome: 0
          };
        }

        userScores[pred.userId].total += points;
        if (points === 5) userScores[pred.userId].exact += 1;
        else if (points === 3) userScores[pred.userId].diff += 1;
        else if (points === 2) userScores[pred.userId].outcome += 1;

        console.log(`   ${pred.user.name}: ${pred.predHome}:${pred.predAway} → ${points} очков`);
      }
      console.log('');
    }

    // Обновляем очки в базе данных
    console.log('💾 Обновление очков в базе данных...\n');

    for (const [userId, scores] of Object.entries(userScores)) {
      await prisma.score.upsert({
        where: { userId },
        create: {
          userId,
          pointsTotal: scores.total,
          exactCount: scores.exact,
          diffCount: scores.diff,
          outcomeCount: scores.outcome,
          lastUpdated: new Date(),
        },
        update: {
          pointsTotal: scores.total,
          exactCount: scores.exact,
          diffCount: scores.diff,
          outcomeCount: scores.outcome,
          lastUpdated: new Date(),
        },
      });

      console.log(`✅ ${scores.name}: ${scores.total} очков (${scores.exact} точных, ${scores.diff} разниц, ${scores.outcome} исходов)`);
    }

    console.log('\n🏆 Итоговая таблица очков:');
    const finalScores = await prisma.score.findMany({
      include: {
        user: {
          select: { name: true }
        }
      },
      orderBy: { pointsTotal: 'desc' }
    });

    finalScores.forEach((score, index) => {
      console.log(`${index + 1}. ${score.user.name}: ${score.pointsTotal} очков`);
    });

  } catch (error) {
    console.error('❌ Ошибка при пересчете очков:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем пересчет
recalcAllScores();
