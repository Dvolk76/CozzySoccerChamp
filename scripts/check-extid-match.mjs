#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const FOOTBALL_API_TOKEN = process.env.FOOTBALL_API_TOKEN || process.env.FOOTBALL_DATA_API_TOKEN || '96637ff475924456a64fa80adc981cbb';
const BASE_URL = 'https://api.football-data.org/v4';

async function checkExtIdMatch() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Проверка соответствия extId матчей 7-го тура...\n');
    
    // Получаем матчи из базы
    const dbMatches = await prisma.match.findMany({
      where: { matchday: 7 },
      select: {
        id: true,
        extId: true,
        homeTeam: true,
        awayTeam: true,
        status: true,
        scoreHome: true,
        scoreAway: true
      }
    });
    
    console.log(`📊 Матчей 7-го тура в базе: ${dbMatches.length}\n`);
    
    // Получаем матчи от API
    const res = await fetch(`${BASE_URL}/competitions/CL/matches?season=2025`, {
      headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
    });
    const data = await res.json();
    const apiMatches = (data.matches || []).filter(m => m.matchday === 7);
    
    console.log(`📊 Матчей 7-го тура от API: ${apiMatches.length}\n`);
    
    // Проверяем соответствие
    console.log('🔍 Проверка соответствия extId:\n');
    
    let matched = 0;
    let notMatched = 0;
    let missingInDb = 0;
    
    for (const apiMatch of apiMatches) {
      const apiExtId = String(apiMatch.id);
      const dbMatch = dbMatches.find(m => m.extId === apiExtId);
      
      if (dbMatch) {
        matched++;
        const statusMatch = dbMatch.status === 'FINISHED';
        const scoreMatch = dbMatch.scoreHome !== null && dbMatch.scoreAway !== null;
        
        if (!statusMatch || !scoreMatch) {
          console.log(`⚠️  ${apiMatch.homeTeam.name} vs ${apiMatch.awayTeam.name}`);
          console.log(`   extId: ${apiExtId} ✅`);
          console.log(`   Статус в БД: ${dbMatch.status}, от API: FINISHED ${statusMatch ? '✅' : '❌'}`);
          console.log(`   Счет в БД: ${dbMatch.scoreHome ?? '?'}:${dbMatch.scoreAway ?? '?'}, от API: ${apiMatch.score?.fullTime?.home ?? '?'}:${apiMatch.score?.fullTime?.away ?? '?'} ${scoreMatch ? '✅' : '❌'}`);
          console.log('');
        }
      } else {
        notMatched++;
        console.log(`❌ Матч не найден в БД: ${apiMatch.homeTeam.name} vs ${apiMatch.awayTeam.name} (extId: ${apiExtId})`);
      }
    }
    
    // Проверяем матчи в БД, которых нет в API
    for (const dbMatch of dbMatches) {
      const apiMatch = apiMatches.find(m => String(m.id) === dbMatch.extId);
      if (!apiMatch) {
        missingInDb++;
        console.log(`⚠️  Матч в БД, но не в API: ${dbMatch.homeTeam} vs ${dbMatch.awayTeam} (extId: ${dbMatch.extId || 'NULL'})`);
      }
    }
    
    console.log(`\n📊 Итоговая статистика:`);
    console.log(`   Совпадающих extId: ${matched}`);
    console.log(`   Не найденных в БД: ${notMatched}`);
    console.log(`   Лишних в БД: ${missingInDb}`);
    
    if (matched === apiMatches.length && notMatched === 0) {
      console.log(`\n✅ Все extId совпадают! Проблема не в extId.`);
    } else {
      console.log(`\n⚠️  Есть проблемы с соответствием extId!`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkExtIdMatch();
