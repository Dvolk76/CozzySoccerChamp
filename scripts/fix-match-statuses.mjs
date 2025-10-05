#!/usr/bin/env node

/**
 * Скрипт для исправления статусов матчей
 * Принудительно устанавливает статус FINISHED для старых матчей
 */

import { PrismaClient } from '@prisma/client';

async function fixMatchStatuses() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Поиск матчей с некорректными статусами...');
    
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    
    // Находим матчи, которые были более 4 часов назад, но все еще имеют статус LIVE/IN_PLAY/PAUSED
    const problematicMatches = await prisma.match.findMany({
      where: {
        kickoffAt: {
          lt: fourHoursAgo
        },
        status: {
          in: ['LIVE', 'IN_PLAY', 'PAUSED']
        }
      }
    });
    
    console.log(`📊 Найдено ${problematicMatches.length} матчей с некорректными статусами`);
    
    if (problematicMatches.length === 0) {
      console.log('✅ Все матчи имеют корректные статусы');
      return;
    }
    
    // Показываем информацию о найденных матчах
    problematicMatches.forEach(match => {
      const kickoffTime = new Date(match.kickoffAt);
      const hoursAgo = Math.floor((now.getTime() - kickoffTime.getTime()) / (1000 * 60 * 60));
      console.log(`  - ${match.homeTeam} vs ${match.awayTeam} (${kickoffTime.toLocaleDateString('ru-RU')} ${kickoffTime.toLocaleTimeString('ru-RU')}) - ${hoursAgo}ч назад, статус: ${match.status}`);
    });
    
    // Обновляем статусы
    console.log('🔄 Обновление статусов...');
    
    const updateResult = await prisma.match.updateMany({
      where: {
        kickoffAt: {
          lt: fourHoursAgo
        },
        status: {
          in: ['LIVE', 'IN_PLAY', 'PAUSED']
        }
      },
      data: {
        status: 'FINISHED'
      }
    });
    
    console.log(`✅ Обновлено ${updateResult.count} матчей`);
    
    // Также обновляем матчи, которые были более 6 часов назад, независимо от статуса
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    
    const oldMatchesResult = await prisma.match.updateMany({
      where: {
        kickoffAt: {
          lt: sixHoursAgo
        },
        status: {
          not: 'FINISHED'
        }
      },
      data: {
        status: 'FINISHED'
      }
    });
    
    if (oldMatchesResult.count > 0) {
      console.log(`✅ Дополнительно обновлено ${oldMatchesResult.count} очень старых матчей`);
    }
    
    console.log('🎉 Исправление статусов завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении статусов:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
fixMatchStatuses();
