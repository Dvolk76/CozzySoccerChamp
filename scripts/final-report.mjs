#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateFinalReport() {
  try {
    console.log('📊 ИТОГОВЫЙ ОТЧЕТ ПО СТАВКАМ ИГРОКОВ\n');
    console.log('=' .repeat(60));

    // Общая статистика
    const totalUsers = await prisma.user.count();
    const totalPredictions = await prisma.prediction.count();
    const totalMatches = await prisma.match.count();
    const finishedMatches = await prisma.match.count({ where: { status: 'FINISHED' } });
    const matchesWithResults = await prisma.match.count({
      where: {
        status: 'FINISHED',
        scoreHome: { not: null },
        scoreAway: { not: null }
      }
    });

    console.log('📈 ОБЩАЯ СТАТИСТИКА:');
    console.log(`   👥 Всего игроков: ${totalUsers}`);
    console.log(`   📝 Всего ставок: ${totalPredictions}`);
    console.log(`   ⚽ Всего матчей: ${totalMatches}`);
    console.log(`   🏁 Завершенных матчей: ${finishedMatches}`);
    console.log(`   🥅 Матчей с результатами: ${matchesWithResults}\n`);

    // Детальная статистика по игрокам
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
                scoreAway: true
              }
            }
          }
        },
        scores: true
      },
      orderBy: { name: 'asc' }
    });

    console.log('👥 СТАТИСТИКА ПО ИГРОКАМ:');
    console.log('=' .repeat(60));

    for (const user of users) {
      console.log(`\n🎯 ${user.name}`);
      console.log(`   📅 Регистрация: ${new Date(user.createdAt).toLocaleString('ru-RU')}`);
      
      if (user.scores.length > 0) {
        const score = user.scores[0];
        console.log(`   🏆 Очки: ${score.pointsTotal}`);
        console.log(`   🎯 Точные: ${score.exactCount} (5 очков)`);
        console.log(`   📊 Разница: ${score.diffCount} (3 очка)`);
        console.log(`   🎲 Исход: ${score.outcomeCount} (2 очка)`);
      } else {
        console.log(`   🏆 Очки: 0`);
      }

      const finishedPredictions = user.predictions.filter(p => 
        p.match.status === 'FINISHED' && 
        p.match.scoreHome !== null && 
        p.match.scoreAway !== null
      );

      console.log(`   📝 Ставок на завершенные матчи: ${finishedPredictions.length}`);

      if (finishedPredictions.length > 0) {
        console.log(`   📊 Детали ставок:`);
        finishedPredictions.forEach(pred => {
          const match = pred.match;
          const result = `${match.scoreHome}:${match.scoreAway}`;
          const prediction = `${pred.predHome}:${pred.predAway}`;
          
          // Простая проверка точности
          let accuracy = '';
          if (pred.predHome === match.scoreHome && pred.predAway === match.scoreAway) {
            accuracy = '🎯 ТОЧНО (5 очков)';
          } else if ((pred.predHome > pred.predAway && match.scoreHome > match.scoreAway) ||
                     (pred.predHome < pred.predAway && match.scoreHome < match.scoreAway) ||
                     (pred.predHome === pred.predAway && match.scoreHome === match.scoreAway)) {
            accuracy = '🎲 Исход угадан (2 очка)';
          } else {
            accuracy = '❌ Не угадано';
          }
          
          console.log(`      ${match.homeTeam} vs ${match.awayTeam}: ${prediction} → ${result} ${accuracy}`);
        });
      }

      const upcomingPredictions = user.predictions.filter(p => p.match.status === 'TIMED');
      if (upcomingPredictions.length > 0) {
        console.log(`   ⏰ Предстоящие ставки: ${upcomingPredictions.length}`);
        upcomingPredictions.forEach(pred => {
          console.log(`      ${pred.match.homeTeam} vs ${pred.match.awayTeam}: ${pred.predHome}:${pred.predAway}`);
        });
      }
    }

    // Топ матчей по количеству ставок
    console.log('\n⚽ ТОП МАТЧЕЙ ПО КОЛИЧЕСТВУ СТАВОК:');
    console.log('=' .repeat(60));

    const matchesWithPredictionCount = await prisma.match.findMany({
      include: {
        predictions: {
          include: {
            user: {
              select: { name: true }
            }
          }
        },
        _count: {
          select: { predictions: true }
        }
      },
      where: {
        predictions: {
          some: {}
        }
      },
      orderBy: {
        predictions: {
          _count: 'desc'
        }
      }
    });

    matchesWithPredictionCount.forEach((match, index) => {
      console.log(`\n${index + 1}. ${match.homeTeam} vs ${match.awayTeam}`);
      console.log(`   📅 ${new Date(match.kickoffAt).toLocaleString('ru-RU')}`);
      console.log(`   📊 Статус: ${match.status}`);
      if (match.scoreHome !== null && match.scoreAway !== null) {
        console.log(`   🥅 Результат: ${match.scoreHome}:${match.scoreAway}`);
      }
      console.log(`   👥 Ставок: ${match.predictions.length}`);
      
      match.predictions.forEach(pred => {
        console.log(`      ${pred.user.name}: ${pred.predHome}:${pred.predAway}`);
      });
    });

    console.log('\n' + '=' .repeat(60));
    console.log('✅ Отчет сгенерирован успешно!');

  } catch (error) {
    console.error('❌ Ошибка при генерации отчета:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем генерацию отчета
generateFinalReport();
