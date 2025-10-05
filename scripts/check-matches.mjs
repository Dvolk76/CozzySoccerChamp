#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

async function checkMatches() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Проверка матчей в базе данных...');
    
    const totalMatches = await prisma.match.count();
    console.log(`📊 Всего матчей в базе: ${totalMatches}`);
    
    if (totalMatches === 0) {
      console.log('❌ В базе данных нет матчей!');
      return;
    }
    
    // Проверяем матчи по статусам
    const statusCounts = await prisma.match.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });
    
    console.log('\n📈 Статистика по статусам:');
    statusCounts.forEach(group => {
      console.log(`  - ${group.status}: ${group._count.status} матчей`);
    });
    
    // Проверяем матчи на 30 сентября
    const september30Matches = await prisma.match.findMany({
      where: {
        kickoffAt: {
          gte: new Date('2024-09-30T00:00:00Z'),
          lt: new Date('2024-10-01T00:00:00Z')
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
    
    console.log(`\n📅 Матчи на 30 сентября: ${september30Matches.length}`);
    
    if (september30Matches.length > 0) {
      september30Matches.forEach(match => {
        const kickoffTime = new Date(match.kickoffAt);
        const now = new Date();
        const hoursAgo = Math.floor((now.getTime() - kickoffTime.getTime()) / (1000 * 60 * 60));
        console.log(`  - ${match.homeTeam} vs ${match.awayTeam} (${kickoffTime.toLocaleString('ru-RU')}) - ${hoursAgo}ч назад, статус: ${match.status}, счет: ${match.scoreHome || '?'}:${match.scoreAway || '?'}`);
      });
    }
    
    // Проверяем матчи с проблемными статусами
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    
    const problematicMatches = await prisma.match.findMany({
      where: {
        kickoffAt: {
          lt: fourHoursAgo
        },
        status: {
          in: ['LIVE', 'IN_PLAY', 'PAUSED']
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
    
    console.log(`\n⚠️  Матчи с проблемными статусами: ${problematicMatches.length}`);
    
    if (problematicMatches.length > 0) {
      problematicMatches.forEach(match => {
        const kickoffTime = new Date(match.kickoffAt);
        const hoursAgo = Math.floor((now.getTime() - kickoffTime.getTime()) / (1000 * 60 * 60));
        console.log(`  - ${match.homeTeam} vs ${match.awayTeam} (${kickoffTime.toLocaleString('ru-RU')}) - ${hoursAgo}ч назад, статус: ${match.status}, счет: ${match.scoreHome || '?'}:${match.scoreAway || '?'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка при проверке матчей:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkMatches();
