#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { syncChampionsLeague } from '../dist/services/footballData.js';

async function testSyncRound7() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Тестирование синхронизации матчей 7-го тура...\n');
    
    // Проверяем состояние ДО синхронизации
    const beforeMatches = await prisma.match.findMany({
      where: { matchday: 7 },
      select: {
        extId: true,
        homeTeam: true,
        awayTeam: true,
        status: true,
        scoreHome: true,
        scoreAway: true
      }
    });
    
    console.log('📊 Состояние ДО синхронизации:');
    console.log(`   Всего матчей 7-го тура: ${beforeMatches.length}`);
    const finishedBefore = beforeMatches.filter(m => m.status === 'FINISHED' && m.scoreHome !== null && m.scoreAway !== null);
    console.log(`   Завершенных с результатами: ${finishedBefore.length}\n`);
    
    // Запускаем синхронизацию
    console.log('🔄 Запуск синхронизации...\n');
    const env = {
      FOOTBALL_API_TOKEN: process.env.FOOTBALL_API_TOKEN || process.env.FOOTBALL_DATA_API_TOKEN || '96637ff475924456a64fa80adc981cbb'
    };
    
    const result = await syncChampionsLeague(prisma, 2025, env);
    console.log(`✅ Синхронизация завершена. Обработано матчей: ${result.count}\n`);
    
    // Проверяем состояние ПОСЛЕ синхронизации
    const afterMatches = await prisma.match.findMany({
      where: { matchday: 7 },
      select: {
        extId: true,
        homeTeam: true,
        awayTeam: true,
        status: true,
        scoreHome: true,
        scoreAway: true
      }
    });
    
    console.log('📊 Состояние ПОСЛЕ синхронизации:');
    console.log(`   Всего матчей 7-го тура: ${afterMatches.length}`);
    const finishedAfter = afterMatches.filter(m => m.status === 'FINISHED' && m.scoreHome !== null && m.scoreAway !== null);
    console.log(`   Завершенных с результатами: ${finishedAfter.length}\n`);
    
    // Показываем изменения
    console.log('📋 Детали изменений:\n');
    afterMatches.forEach(match => {
      const before = beforeMatches.find(b => b.extId === match.extId);
      if (!before) {
        console.log(`   ⚠️  Новый матч: ${match.homeTeam} vs ${match.awayTeam}`);
        return;
      }
      
      const statusChanged = before.status !== match.status;
      const scoreChanged = before.scoreHome !== match.scoreHome || before.scoreAway !== match.scoreAway;
      
      if (statusChanged || scoreChanged) {
        console.log(`   ${match.homeTeam} vs ${match.awayTeam}`);
        if (statusChanged) {
          console.log(`      Статус: ${before.status} → ${match.status}`);
        }
        if (scoreChanged) {
          console.log(`      Счет: ${before.scoreHome ?? '?'}:${before.scoreAway ?? '?'} → ${match.scoreHome ?? '?'}:${match.scoreAway ?? '?'}`);
        }
      }
    });
    
    // Проверяем проблемные матчи
    const problematic = afterMatches.filter(m => 
      m.status !== 'FINISHED' || m.scoreHome === null || m.scoreAway === null
    );
    
    if (problematic.length > 0) {
      console.log(`\n⚠️  Проблемные матчи (не FINISHED или без результатов): ${problematic.length}`);
      problematic.forEach(m => {
        console.log(`   - ${m.homeTeam} vs ${m.awayTeam}: статус=${m.status}, счет=${m.scoreHome ?? '?'}:${m.scoreAway ?? '?'}`);
      });
    } else {
      console.log('\n✅ Все матчи 7-го тура успешно синхронизированы!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при синхронизации:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testSyncRound7();
