#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Функция подсчета очков (копия из scoring.ts)
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

// Функция пересчета очков для матча
async function recalcForMatch(matchId) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.scoreHome == null || match.scoreAway == null) return { updated: 0 };
  const actual = { home: match.scoreHome, away: match.scoreAway };

  const preds = await prisma.prediction.findMany({ where: { matchId } });
  const aggregates = {};

  for (const p of preds) {
    const pts = scoring({ home: p.predHome, away: p.predAway }, actual);
    if (!aggregates[p.userId]) aggregates[p.userId] = { total: 0, exact: 0, diff: 0, outcome: 0 };
    aggregates[p.userId].total += pts;
    if (pts === 5) aggregates[p.userId].exact += 1;
    else if (pts === 3) aggregates[p.userId].diff += 1;
    else if (pts === 2) aggregates[p.userId].outcome += 1;
  }

  const ops = Object.entries(aggregates).map(([userId, a]) =>
    prisma.score.upsert({
      where: { userId },
      create: {
        userId,
        pointsTotal: a.total,
        exactCount: a.exact,
        diffCount: a.diff,
        outcomeCount: a.outcome,
        lastUpdated: new Date(),
      },
      update: {
        pointsTotal: a.total,
        exactCount: a.exact,
        diffCount: a.diff,
        outcomeCount: a.outcome,
        lastUpdated: new Date(),
      },
    })
  );
  await prisma.$transaction(ops);
  return { updated: ops.length };
}

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

    // Обновляем результат матча
    await prisma.match.update({
      where: { id: matchId },
      data: {
        scoreHome: parseInt(homeScore),
        scoreAway: parseInt(awayScore),
        status: 'FINISHED'
      }
    });

    console.log('✅ Результат матча обновлен');

    // Пересчитываем очки для этого матча
    console.log('🔄 Пересчет очков...');
    const result = await recalcForMatch(prisma, matchId);
    console.log(`✅ Обновлено очков для ${result.updated} игроков`);

    // Показываем новые очки игроков
    const updatedScores = await prisma.score.findMany({
      where: {
        user: {
          predictions: {
            some: {
              matchId: matchId
            }
          }
        }
      },
      include: {
        user: {
          select: { name: true }
        }
      }
    });

    console.log('\n🏆 Обновленные очки игроков:');
    updatedScores.forEach(score => {
      console.log(`   ${score.user.name}: ${score.pointsTotal} очков (${score.exactCount} точных, ${score.diffCount} разниц, ${score.outcomeCount} исходов)`);
    });

  } catch (error) {
    console.error('❌ Ошибка при обновлении матча:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем аргументы командной строки
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.log('❌ Использование: node scripts/update-match-score.mjs <matchId> <homeScore> <awayScore>');
  console.log('Пример: node scripts/update-match-score.mjs cmfphmro701mzg56qo4u9is9w 2 1');
  process.exit(1);
}

const [matchId, homeScore, awayScore] = args;

// Валидация
if (isNaN(parseInt(homeScore)) || isNaN(parseInt(awayScore))) {
  console.log('❌ Счета должны быть числами');
  process.exit(1);
}

updateMatchScore(matchId, homeScore, awayScore);
