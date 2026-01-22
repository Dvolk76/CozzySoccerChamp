#!/usr/bin/env node

const FOOTBALL_API_TOKEN = process.env.FOOTBALL_API_TOKEN || process.env.FOOTBALL_DATA_API_TOKEN || '96637ff475924456a64fa80adc981cbb';
const BASE_URL = 'https://api.football-data.org/v4';

async function checkApiRound7() {
  try {
    console.log('🔍 Проверка данных от Football API для 7-го тура...\n');
    
    // Получаем матчи сезона 2025 (или текущего года)
    const currentYear = 2025;
    const url = `${BASE_URL}/competitions/CL/matches?season=${currentYear}`;
    
    console.log(`📡 Запрос к API: ${url}\n`);
    
    const res = await fetch(url, { 
      headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN } 
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Ошибка API:', res.status, errorText);
      return;
    }
    
    const data = await res.json();
    console.log(`✅ Получено матчей от API: ${data.matches?.length || 0}\n`);
    
    // Фильтруем матчи 7-го тура
    const round7Matches = (data.matches || []).filter(m => m.matchday === 7);
    console.log(`📊 Матчей 7-го тура от API: ${round7Matches.length}\n`);
    
    if (round7Matches.length === 0) {
      console.log('❌ API не вернул матчи 7-го тура!');
      return;
    }
    
    // Группируем по статусам
    const byStatus = {};
    round7Matches.forEach(m => {
      const status = m.status || 'UNKNOWN';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(m);
    });
    
    console.log('📈 Статистика по статусам от API:');
    Object.entries(byStatus).forEach(([status, matches]) => {
      console.log(`  - ${status}: ${matches.length} матчей`);
    });
    
    console.log('\n📋 Детали матчей 7-го тура от API:\n');
    round7Matches.forEach((match, index) => {
      const kickoffTime = new Date(match.utcDate);
      const now = new Date();
      const hoursAgo = Math.floor((now.getTime() - kickoffTime.getTime()) / (1000 * 60 * 60));
      
      // Определяем счет как в syncChampionsLeague
      let scoreHome = null;
      let scoreAway = null;
      
      const isLiveLike = ['LIVE', 'IN_PLAY', 'PAUSED', 'TIMED'].includes(match.status);
      if (match.status === 'FINISHED') {
        scoreHome = match.score?.fullTime?.home ?? null;
        scoreAway = match.score?.fullTime?.away ?? null;
      } else if (isLiveLike) {
        scoreHome = match.score?.fullTime?.home ?? 
                   match.score?.regularTime?.home ?? 
                   match.score?.halfTime?.home ?? null;
        scoreAway = match.score?.fullTime?.away ?? 
                   match.score?.regularTime?.away ?? 
                   match.score?.halfTime?.away ?? null;
      }
      
      // Проверяем логику обновления статуса
      const hoursFromKickoff = Math.max(0, (now.getTime() - kickoffTime.getTime()) / (1000 * 60 * 60));
      let expectedStatus = match.status;
      
      if ((match.status === 'TIMED' || match.status === 'SCHEDULED') && now >= kickoffTime) {
        expectedStatus = 'IN_PLAY';
      }
      if (hoursFromKickoff >= 4 && (scoreHome != null || scoreAway != null)) {
        expectedStatus = 'FINISHED';
      }
      if (hoursFromKickoff >= 6) {
        expectedStatus = 'FINISHED';
      }
      
      console.log(`${index + 1}. ${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`);
      console.log(`   📅 ${kickoffTime.toLocaleString('ru-RU')} (${hoursAgo}ч назад)`);
      console.log(`   🏟️  Статус от API: ${match.status}`);
      console.log(`   🥅 Счет от API: ${scoreHome ?? '?'}:${scoreAway ?? '?'}`);
      console.log(`   ⏰ Часов с начала: ${hoursFromKickoff.toFixed(1)}`);
      console.log(`   🔄 Ожидаемый статус после обработки: ${expectedStatus}`);
      console.log(`   ${match.status !== expectedStatus ? '⚠️' : '✅'} Статус ${match.status !== expectedStatus ? 'ДОЛЖЕН ИЗМЕНИТЬСЯ' : 'корректный'}`);
      
      // Показываем структуру score
      if (match.score) {
        console.log(`   📊 Структура score:`, JSON.stringify(match.score, null, 2));
      }
      console.log('');
    });
    
    // Проверяем, сколько матчей должны быть FINISHED
    const shouldBeFinished = round7Matches.filter(m => {
      const kickoffTime = new Date(m.utcDate);
      const now = new Date();
      const hoursFromKickoff = Math.max(0, (now.getTime() - kickoffTime.getTime()) / (1000 * 60 * 60));
      return hoursFromKickoff >= 6;
    });
    
    console.log(`\n📊 Итоговая статистика:`);
    console.log(`   Всего матчей 7-го тура: ${round7Matches.length}`);
    console.log(`   Должны быть FINISHED (>6ч): ${shouldBeFinished.length}`);
    console.log(`   Уже FINISHED от API: ${round7Matches.filter(m => m.status === 'FINISHED').length}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

checkApiRound7();
