#!/usr/bin/env node

/**
 * Мониторинг live матчей в production
 * Использование: node scripts/monitor-live-matches.mjs
 */

const WORKER_URL = 'https://cozy-soccer-champ.cozzy-soccer.workers.dev';

async function monitorLiveMatches() {
  console.log('🔍 Мониторинг live матчей...\n');
  
  try {
    const response = await fetch(`${WORKER_URL}/api/matches`);
    
    if (!response.ok) {
      console.error(`❌ Ошибка API: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    if (!data.matches) {
      console.error('❌ Нет данных о матчах');
      return;
    }
    
    console.log(`📊 Всего матчей в базе: ${data.matches.length}\n`);
    
    // Группируем по статусам
    const byStatus = {};
    data.matches.forEach(m => {
      const status = m.status || 'UNKNOWN';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(m);
    });
    
    console.log('📈 Статистика по статусам:');
    Object.entries(byStatus).forEach(([status, matches]) => {
      console.log(`  ${status}: ${matches.length} матчей`);
    });
    console.log('');
    
    // Показываем live матчи
    const liveStatuses = ['IN_PLAY', 'LIVE', 'PAUSED'];
    const liveMatches = data.matches.filter(m => liveStatuses.includes(m.status));
    
    if (liveMatches.length > 0) {
      console.log(`⚽ LIVE МАТЧИ (${liveMatches.length}):\n`);
      liveMatches.forEach(m => {
        const score = m.scoreHome !== null && m.scoreAway !== null 
          ? `${m.scoreHome}:${m.scoreAway}` 
          : '?:?';
        const time = new Date(m.kickoffAt).toLocaleString('ru-RU');
        console.log(`  ${m.homeTeam} ${score} ${m.awayTeam}`);
        console.log(`  └─ ${m.status} | ${time}`);
        console.log('');
      });
    } else {
      console.log('⚽ Нет live матчей\n');
    }
    
    // Показываем ближайшие запланированные матчи
    const now = new Date();
    const upcomingMatches = data.matches
      .filter(m => m.status === 'TIMED' && new Date(m.kickoffAt) > now)
      .sort((a, b) => new Date(a.kickoffAt) - new Date(b.kickoffAt))
      .slice(0, 5);
    
    if (upcomingMatches.length > 0) {
      console.log(`📅 БЛИЖАЙШИЕ МАТЧИ (${upcomingMatches.length}):\n`);
      upcomingMatches.forEach(m => {
        const kickoff = new Date(m.kickoffAt);
        const hoursUntil = Math.floor((kickoff - now) / (1000 * 60 * 60));
        const minutesUntil = Math.floor(((kickoff - now) % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`  ${m.homeTeam} vs ${m.awayTeam}`);
        console.log(`  └─ через ${hoursUntil}ч ${minutesUntil}м | ${kickoff.toLocaleString('ru-RU')}`);
        console.log('');
      });
    }
    
    // Показываем недавно завершенные матчи с результатами
    const finishedMatches = data.matches
      .filter(m => m.status === 'FINISHED' && m.scoreHome !== null)
      .sort((a, b) => new Date(b.kickoffAt) - new Date(a.kickoffAt))
      .slice(0, 5);
    
    if (finishedMatches.length > 0) {
      console.log(`✅ НЕДАВНО ЗАВЕРШЕННЫЕ (${finishedMatches.length}):\n`);
      finishedMatches.forEach(m => {
        const score = `${m.scoreHome}:${m.scoreAway}`;
        const time = new Date(m.kickoffAt).toLocaleString('ru-RU');
        console.log(`  ${m.homeTeam} ${score} ${m.awayTeam}`);
        console.log(`  └─ ${time}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

// Запуск мониторинга
monitorLiveMatches();

// Опционально: автоматическое обновление каждые 30 секунд
if (process.argv.includes('--watch')) {
  console.log('👀 Режим наблюдения включен (обновление каждые 30 секунд)');
  console.log('Нажмите Ctrl+C для выхода\n');
  
  setInterval(() => {
    console.clear();
    monitorLiveMatches();
  }, 30000);
}

