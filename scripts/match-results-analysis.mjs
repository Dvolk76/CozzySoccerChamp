#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function matchResultsAnalysis() {
  try {
    console.log('🔍 Анализ результатов матчей и ставок...\n');

    // Получаем завершенные матчи с результатами
    const finishedMatches = await prisma.match.findMany({
      where: { status: 'FINISHED' },
      include: {
        predictions: {
          include: {
            user: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { kickoffAt: 'asc' }
    });

    console.log(`⚽ Завершенных матчей: ${finishedMatches.length}\n`);

    for (const match of finishedMatches) {
      console.log(`🏆 ${match.homeTeam} vs ${match.awayTeam}`);
      console.log(`   📅 ${new Date(match.kickoffAt).toLocaleString('ru-RU')}`);
      console.log(`   🥅 Результат: ${match.scoreHome}:${match.scoreAway}`);
      console.log(`   🏟️ ${match.stage}${match.group ? ` (${match.group})` : ''}${match.matchday ? ` - Тур ${match.matchday}` : ''}`);
      
      if (match.predictions.length > 0) {
        console.log(`   👥 Ставки (${match.predictions.length}):`);
        
        match.predictions.forEach(pred => {
          const user = pred.user;
          const predResult = `${pred.predHome}:${pred.predAway}`;
          const actualResult = `${match.scoreHome}:${match.scoreAway}`;
          
          // Простая проверка точности
          let accuracy = '';
          if (pred.predHome === match.scoreHome && pred.predAway === match.scoreAway) {
            accuracy = '🎯 ТОЧНО! (5 очков)';
          } else if (pred.predHome === pred.predAway && match.scoreHome === match.scoreAway) {
            accuracy = '📊 Ничья угадана (2 очка)';
          } else if ((pred.predHome > pred.predAway && match.scoreHome > match.scoreAway) || 
                     (pred.predHome < pred.predAway && match.scoreHome < match.scoreAway) ||
                     (pred.predHome === pred.predAway && match.scoreHome === match.scoreAway)) {
            accuracy = '🎲 Исход угадан (2 очка)';
          } else {
            accuracy = '❌ Не угадано';
          }
          
          console.log(`      ${user.name}: ${predResult} → ${actualResult} ${accuracy}`);
        });
      } else {
        console.log(`   👥 Ставок: 0`);
      }
      
      console.log('');
    }

    // Анализ по игрокам - проверяем их ставки против результатов
    console.log('📊 Анализ точности ставок по игрокам:\n');
    
    const users = await prisma.user.findMany({
      include: {
        predictions: {
          include: {
            match: {
              select: {
                homeTeam: true,
                awayTeam: true,
                scoreHome: true,
                scoreAway: true,
                status: true
              }
            }
          }
        }
      }
    });

    for (const user of users) {
      console.log(`🎯 ${user.name}:`);
      
      const finishedPredictions = user.predictions.filter(p => p.match.status === 'FINISHED');
      
      if (finishedPredictions.length === 0) {
        console.log('   Нет ставок на завершенные матчи');
        continue;
      }

      let exactHits = 0;
      let outcomeHits = 0;
      let totalPoints = 0;

      finishedPredictions.forEach(pred => {
        const match = pred.match;
        const predHome = pred.predHome;
        const predAway = pred.predAway;
        const actualHome = match.scoreHome;
        const actualAway = match.scoreAway;

        let points = 0;
        let result = '';

        // Точный счет (5 очков)
        if (predHome === actualHome && predAway === actualAway) {
          points = 5;
          exactHits++;
          result = '🎯 ТОЧНО';
        }
        // Правильный исход (2 очка)
        else if ((predHome > predAway && actualHome > actualAway) ||
                 (predHome < predAway && actualHome < actualAway) ||
                 (predHome === predAway && actualHome === actualAway)) {
          points = 2;
          outcomeHits++;
          result = '🎲 Исход';
        } else {
          result = '❌ Мимо';
        }

        totalPoints += points;

        console.log(`   ${match.homeTeam} vs ${match.awayTeam}: ${predHome}:${predAway} → ${actualHome}:${actualAway} (${result}, +${points})`);
      });

      console.log(`   📊 Итого: ${exactHits} точных, ${outcomeHits} исходов, ${totalPoints} очков\n`);
    }

  } catch (error) {
    console.error('❌ Ошибка при анализе:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем анализ
matchResultsAnalysis();
