import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSync() {
  try {
    // Проверяем несколько последних матчей
    const matches = await prisma.match.findMany({
      where: {
        status: 'FINISHED'
      },
      orderBy: { kickoffAt: 'desc' },
      take: 5
    });
    
    console.log('=== Последние 5 завершенных матчей в БД ===\n');
    matches.forEach(m => {
      console.log(`ID: ${m.extId || m.id}`);
      console.log(`${m.homeTeam} vs ${m.awayTeam}`);
      console.log(`Статус: ${m.status}`);
      console.log(`Счет: ${m.scoreHome ?? '?'} - ${m.scoreAway ?? '?'}`);
      console.log(`Время: ${m.kickoffAt}`);
      console.log(`Обновлен: ${m.updatedAt}`);
      console.log('---\n');
    });
    
    // Проверяем конкретные матчи из API
    const extIds = ['551968', '551972', '551978', '552002', '552026'];
    console.log('\n=== Проверка конкретных матчей из API ===\n');
    
    for (const extId of extIds) {
      const match = await prisma.match.findUnique({ where: { extId } });
      if (match) {
        console.log(`extId: ${extId}`);
        console.log(`${match.homeTeam} vs ${match.awayTeam}`);
        console.log(`Статус: ${match.status}, Счет: ${match.scoreHome ?? '?'}:${match.scoreAway ?? '?'}`);
        console.log(`Обновлен: ${match.updatedAt}\n`);
      } else {
        console.log(`⚠️  Матч ${extId} не найден в БД!\n`);
      }
    }
    
    // Статистика по статусам
    const statuses = await prisma.match.groupBy({
      by: ['status'],
      _count: true
    });
    
    console.log('\n=== Статистика по статусам ===\n');
    statuses.forEach(s => {
      console.log(`${s.status}: ${s._count} матчей`);
    });
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSync();
