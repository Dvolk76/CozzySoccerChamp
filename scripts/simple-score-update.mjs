#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateMatchScore(matchId, homeScore, awayScore) {
  try {
    console.log(`🔧 Обновление результата матча ${matchId} на ${homeScore}:${awayScore}...\n`);

    // Проверяем, существует ли матч
    const match = await prisma.match.findUnique({
      where: { id: matchId },
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

    if (!match) {
      console.log('❌ Матч не найден');
      return;
    }

    console.log(`⚽ ${match.homeTeam} vs ${match.awayTeam}`);
    console.log(`   📅 ${new Date(match.kickoffAt).toLocaleString('ru-RU')}`);
    console.log(`   🥅 Старый результат: ${match.scoreHome ?? 'null'}:${match.scoreAway ?? 'null'}`);
    console.log(`   🥅 Новый результат: ${homeScore}:${awayScore}`);
    console.log(`   👥 Ставок: ${match.predictions.length}\n`);

    // Показываем ставки игроков
    console.log('📝 Ставки игроков:');
    match.predictions.forEach(pred => {
      console.log(`   ${pred.user.name}: ${pred.predHome}:${pred.predAway}`);
    });

    // Обновляем результат матча
    await prisma.match.update({
      where: { id: matchId },
      data: {
        scoreHome: parseInt(homeScore),
        scoreAway: parseInt(awayScore),
        status: 'FINISHED'
      }
    });

    console.log('\n✅ Результат матча обновлен');
    console.log('💡 Для пересчета очков запустите: node scripts/recalc-scores.mjs');

  } catch (error) {
    console.error('❌ Ошибка при обновлении матча:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем аргументы командной строки
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.log('❌ Использование: node scripts/simple-score-update.mjs <matchId> <homeScore> <awayScore>');
  console.log('Пример: node scripts/simple-score-update.mjs cmfphmro701mzg56qo4u9is9w 2 1');
  process.exit(1);
}

const [matchId, homeScore, awayScore] = args;

// Валидация
if (isNaN(parseInt(homeScore)) || isNaN(parseInt(awayScore))) {
  console.log('❌ Счета должны быть числами');
  process.exit(1);
}

updateMatchScore(matchId, homeScore, awayScore);
