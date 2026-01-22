#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

async function checkRound7() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Проверка матчей 7-го тура...\n');
    
    // Получаем все матчи 7-го тура
    const round7Matches = await prisma.match.findMany({
      where: {
        matchday: 7
      },
      include: {
        predictions: {
          include: {
            user: {
              select: { name: true, tg_user_id: true }
            }
          }
        }
      },
      orderBy: { kickoffAt: 'asc' }
    });
    
    console.log(`📊 Всего матчей 7-го тура: ${round7Matches.length}\n`);
    
    if (round7Matches.length === 0) {
      console.log('❌ В базе данных нет матчей 7-го тура!');
      return;
    }
    
    // Группируем по статусам
    const byStatus = {
      FINISHED: [],
      SCHEDULED: [],
      LIVE: [],
      IN_PLAY: [],
      PAUSED: [],
      TIMED: [],
      POSTPONED: [],
      CANCELLED: [],
      OTHER: []
    };
    
    round7Matches.forEach(match => {
      const status = match.status || 'OTHER';
      if (byStatus[status]) {
        byStatus[status].push(match);
      } else {
        byStatus.OTHER.push(match);
      }
    });
    
    console.log('📈 Статистика по статусам:');
    Object.entries(byStatus).forEach(([status, matches]) => {
      if (matches.length > 0) {
        console.log(`  - ${status}: ${matches.length} матчей`);
      }
    });
    
    // Проверяем завершенные матчи
    const finishedMatches = round7Matches.filter(m => m.status === 'FINISHED');
    console.log(`\n✅ Завершенных матчей: ${finishedMatches.length}`);
    
    // Проверяем матчи с результатами
    const matchesWithScores = round7Matches.filter(m => 
      m.scoreHome !== null && m.scoreAway !== null
    );
    console.log(`📊 Матчей с результатами: ${matchesWithScores.length}`);
    
    // Проверяем матчи, которые должны быть завершены (статус FINISHED + результаты)
    const completeMatches = round7Matches.filter(m => 
      m.status === 'FINISHED' && 
      m.scoreHome !== null && 
      m.scoreAway !== null
    );
    console.log(`🎯 Полностью завершенных матчей (FINISHED + результаты): ${completeMatches.length}\n`);
    
    // Показываем детали каждого матча
    console.log('📋 Детали матчей 7-го тура:\n');
    round7Matches.forEach((match, index) => {
      const kickoffTime = new Date(match.kickoffAt);
      const now = new Date();
      const hoursAgo = Math.floor((now.getTime() - kickoffTime.getTime()) / (1000 * 60 * 60));
      
      console.log(`${index + 1}. ${match.homeTeam} vs ${match.awayTeam}`);
      console.log(`   📅 ${kickoffTime.toLocaleString('ru-RU')} (${hoursAgo}ч назад)`);
      console.log(`   🏟️  Статус: ${match.status}`);
      console.log(`   🥅 Счет: ${match.scoreHome ?? '?'}:${match.scoreAway ?? '?'}`);
      console.log(`   📝 Прогнозов: ${match.predictions.length}`);
      
      // Проверяем, будет ли матч включен в лидерборд тура
      const willBeIncluded = match.status === 'FINISHED' && 
                             match.scoreHome !== null && 
                             match.scoreAway !== null;
      console.log(`   ${willBeIncluded ? '✅' : '❌'} Будет включен в лидерборд тура: ${willBeIncluded ? 'ДА' : 'НЕТ'}`);
      console.log('');
    });
    
    // Проверяем, сколько матчей будет включено в лидерборд
    const matchesForLeaderboard = round7Matches.filter(m => 
      m.status === 'FINISHED' && 
      m.scoreHome !== null && 
      m.scoreAway !== null
    );
    
    console.log(`\n📊 Итоговая статистика для лидерборда:`);
    console.log(`   Всего матчей: ${round7Matches.length}`);
    console.log(`   Будет включено в лидерборд: ${matchesForLeaderboard.length}`);
    console.log(`   Не будет включено: ${round7Matches.length - matchesForLeaderboard.length}`);
    
    if (matchesForLeaderboard.length === 0) {
      console.log('\n⚠️  ВНИМАНИЕ: Ни один матч 7-го тура не будет включен в лидерборд!');
      console.log('   Причина: матчи не имеют статус FINISHED или не имеют результатов.');
    } else if (matchesForLeaderboard.length < round7Matches.length) {
      console.log('\n⚠️  ВНИМАНИЕ: Не все матчи 7-го тура будут включены в лидерборд!');
      console.log('   Некоторые матчи еще не завершены или не имеют результатов.');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке матчей:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkRound7();
