#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function manualScoreUpdate() {
  try {
    console.log('🔧 Ручное обновление результатов матчей...\n');

    // Получаем матчи, на которые есть ставки, но нет результатов
    const matchesWithPredictions = await prisma.match.findMany({
      where: {
        predictions: {
          some: {}
        },
        OR: [
          { scoreHome: null },
          { scoreAway: null }
        ]
      },
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

    console.log(`📊 Найдено ${matchesWithPredictions.length} матчей с ставками без результатов\n`);

    if (matchesWithPredictions.length === 0) {
      console.log('✅ Все матчи с ставками уже имеют результаты');
      return;
    }

    // Показываем матчи, которые нужно обновить
    for (const match of matchesWithPredictions) {
      console.log(`⚽ ${match.homeTeam} vs ${match.awayTeam}`);
      console.log(`   📅 ${new Date(match.kickoffAt).toLocaleString('ru-RU')}`);
      console.log(`   📊 Статус: ${match.status}`);
      console.log(`   🥅 Текущий результат: ${match.scoreHome ?? 'null'}:${match.scoreAway ?? 'null'}`);
      console.log(`   👥 Ставок: ${match.predictions.length}`);
      
      match.predictions.forEach(pred => {
        console.log(`      ${pred.user.name}: ${pred.predHome}:${pred.predAway}`);
      });
      console.log('');
    }

    console.log('💡 Для обновления результатов используйте команду:');
    console.log('   node scripts/update-match-score.mjs <matchId> <homeScore> <awayScore>');
    console.log('\n📋 Доступные ID матчей:');
    
    matchesWithPredictions.forEach(match => {
      console.log(`   ${match.id} - ${match.homeTeam} vs ${match.awayTeam}`);
    });

  } catch (error) {
    console.error('❌ Ошибка при анализе матчей:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем анализ
manualScoreUpdate();
