#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function detailedAnalysis() {
  try {
    console.log('🔍 Детальный анализ ставок игроков...\n');

    // Получаем всех пользователей с их ставками и счетами
    const users = await prisma.user.findMany({
      include: {
        predictions: {
          include: {
            match: {
              select: {
                homeTeam: true,
                awayTeam: true,
                kickoffAt: true,
                status: true,
                scoreHome: true,
                scoreAway: true,
                stage: true,
                group: true,
                matchday: true
              }
            }
          }
        },
        scores: true,
        predictionHistories: {
          include: {
            match: {
              select: {
                homeTeam: true,
                awayTeam: true,
                kickoffAt: true,
                status: true,
                scoreHome: true,
                scoreAway: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`👥 Найдено ${users.length} игроков\n`);

    for (const user of users) {
      console.log(`🎯 ${user.name} (ID: ${user.id})`);
      console.log(`   📅 Регистрация: ${new Date(user.createdAt).toLocaleString('ru-RU')}`);
      
      if (user.scores.length > 0) {
        const score = user.scores[0];
        console.log(`   🏆 Очки: ${score.pointsTotal}`);
        console.log(`   🎯 Точные: ${score.exactCount} (5 очков)`);
        console.log(`   📊 Разница: ${score.diffCount} (3 очка)`);
        console.log(`   🎲 Исход: ${score.outcomeCount} (2 очка)`);
        console.log(`   ⏰ Первая ставка: ${score.firstPredAt ? new Date(score.firstPredAt).toLocaleString('ru-RU') : 'Не указано'}`);
      } else {
        console.log(`   🏆 Очки: 0 (нет счета)`);
      }

      console.log(`   📝 Активные ставки (${user.predictions.length}):`);
      
      if (user.predictions.length === 0) {
        console.log('      Нет активных ставок');
      } else {
        user.predictions.forEach(pred => {
          const match = pred.match;
          const result = match.scoreHome !== null && match.scoreAway !== null 
            ? ` → результат: ${match.scoreHome}:${match.scoreAway}`
            : '';
          
          console.log(`      ${match.homeTeam} vs ${match.awayTeam}: ${pred.predHome}:${pred.predAway}${result}`);
          console.log(`         📅 ${new Date(match.kickoffAt).toLocaleString('ru-RU')} | ${match.status}`);
        });
      }

      console.log(`   📚 История ставок (${user.predictionHistories.length}):`);
      
      if (user.predictionHistories.length === 0) {
        console.log('      Нет истории изменений');
      } else {
        user.predictionHistories.forEach(hist => {
          const match = hist.match;
          const result = match.scoreHome !== null && match.scoreAway !== null 
            ? ` → результат: ${match.scoreHome}:${match.scoreAway}`
            : '';
          
          console.log(`      ${match.homeTeam} vs ${match.awayTeam}: ${hist.predHome}:${hist.predAway}${result}`);
          console.log(`         📅 Изменено: ${new Date(hist.createdAt).toLocaleString('ru-RU')}`);
        });
      }

      console.log('');
    }

    // Общая статистика
    console.log('📊 Общая статистика:');
    
    const totalPredictions = await prisma.prediction.count();
    const totalHistory = await prisma.predictionHistory.count();
    const finishedMatches = await prisma.match.count({
      where: { status: 'FINISHED' }
    });
    const upcomingMatches = await prisma.match.count({
      where: { status: 'TIMED' }
    });

    console.log(`   📝 Всего активных ставок: ${totalPredictions}`);
    console.log(`   📚 Всего изменений ставок: ${totalHistory}`);
    console.log(`   ⚽ Завершенных матчей: ${finishedMatches}`);
    console.log(`   ⏰ Предстоящих матчей: ${upcomingMatches}`);

    // Топ игроков по очкам
    const topPlayers = await prisma.score.findMany({
      include: {
        user: {
          select: { name: true }
        }
      },
      orderBy: { pointsTotal: 'desc' },
      take: 5
    });

    if (topPlayers.length > 0) {
      console.log('\n🏆 Топ игроков по очкам:');
      topPlayers.forEach((score, index) => {
        console.log(`   ${index + 1}. ${score.user.name}: ${score.pointsTotal} очков`);
      });
    }

  } catch (error) {
    console.error('❌ Ошибка при анализе данных:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем анализ
detailedAnalysis();
