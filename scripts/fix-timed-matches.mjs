#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

async function fixTimedMatches() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Поиск матчей со статусом TIMED...');
    
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    // Находим матчи со статусом TIMED, которые были более 2 часов назад
    const timedMatches = await prisma.match.findMany({
      where: {
        status: 'TIMED',
        kickoffAt: {
          lt: twoHoursAgo
        }
      },
      select: {
        id: true,
        homeTeam: true,
        awayTeam: true,
        kickoffAt: true,
        status: true,
        scoreHome: true,
        scoreAway: true
      }
    });
    
    console.log(`📊 Найдено ${timedMatches.length} матчей со статусом TIMED старше 2 часов`);
    
    if (timedMatches.length === 0) {
      console.log('✅ Все матчи со статусом TIMED актуальны');
      return;
    }
    
    // Показываем информацию о найденных матчах
    timedMatches.forEach(match => {
      const kickoffTime = new Date(match.kickoffAt);
      const hoursAgo = Math.floor((now.getTime() - kickoffTime.getTime()) / (1000 * 60 * 60));
      console.log(`  - ${match.homeTeam} vs ${match.awayTeam} (${kickoffTime.toLocaleDateString('ru-RU')} ${kickoffTime.toLocaleTimeString('ru-RU')}) - ${hoursAgo}ч назад, счет: ${match.scoreHome || '?'}:${match.scoreAway || '?'}`);
    });
    
    // Обновляем статусы на FINISHED
    console.log('🔄 Обновление статусов с TIMED на FINISHED...');
    
    const updateResult = await prisma.match.updateMany({
      where: {
        status: 'TIMED',
        kickoffAt: {
          lt: twoHoursAgo
        }
      },
      data: {
        status: 'FINISHED'
      }
    });
    
    console.log(`✅ Обновлено ${updateResult.count} матчей`);
    console.log('🎉 Исправление статусов TIMED завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении статусов TIMED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixTimedMatches();
