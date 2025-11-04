#!/usr/bin/env node

/**
 * Проверяет live данные для конкретного матча из Football Data API
 * Usage: node scripts/check-live-match.mjs "Real Madrid" "Juventus"
 */

import 'dotenv/config';

const FOOTBALL_API_TOKEN = process.env.FOOTBALL_API_TOKEN || process.env.FOOTBALL_DATA_API_TOKEN;
const BASE_URL = 'https://api.football-data.org/v4';

if (!FOOTBALL_API_TOKEN) {
  console.error('❌ FOOTBALL_API_TOKEN не найден в .env');
  process.exit(1);
}

const homeTeamSearch = process.argv[2] || 'Real Madrid';
const awayTeamSearch = process.argv[3] || 'Juventus';

console.log(`🔍 Ищем матч: ${homeTeamSearch} vs ${awayTeamSearch}\n`);

async function checkLiveMatch() {
  try {
    // Запрашиваем все матчи Champions League текущего сезона
    const season = new Date().getFullYear();
    const url = `${BASE_URL}/competitions/CL/matches?season=${season}`;
    
    console.log(`📡 Запрос: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Ошибка API (${response.status}):`, errorText);
      return;
    }
    
    const data = await response.json();
    console.log(`✅ Получено матчей: ${data.matches?.length || 0}\n`);
    
    // Ищем нужный матч
    const match = data.matches?.find(m => 
      (m.homeTeam?.name?.includes(homeTeamSearch) || m.homeTeam?.shortName?.includes(homeTeamSearch)) &&
      (m.awayTeam?.name?.includes(awayTeamSearch) || m.awayTeam?.shortName?.includes(awayTeamSearch))
    );
    
    if (!match) {
      console.log(`❌ Матч "${homeTeamSearch} vs ${awayTeamSearch}" не найден\n`);
      
      // Показываем все live матчи
      const liveMatches = data.matches?.filter(m => 
        ['IN_PLAY', 'LIVE', 'PAUSED', 'TIMED'].includes(m.status)
      );
      
      if (liveMatches?.length > 0) {
        console.log('🔴 LIVE матчи сейчас:');
        liveMatches.forEach(m => {
          console.log(`  ${m.homeTeam.name} ${m.score?.fullTime?.home ?? '?'}:${m.score?.fullTime?.away ?? '?'} ${m.awayTeam.name}`);
          console.log(`  Status: ${m.status}, ID: ${m.id}`);
          console.log(`  Kickoff: ${m.utcDate}`);
          console.log(`  Score: fullTime=${JSON.stringify(m.score?.fullTime)}, halfTime=${JSON.stringify(m.score?.halfTime)}, regularTime=${JSON.stringify(m.score?.regularTime)}\n`);
        });
      } else {
        console.log('⚪ Нет live матчей в данный момент\n');
      }
      
      // Показываем будущие матчи с этими командами
      const upcomingMatches = data.matches?.filter(m =>
        ((m.homeTeam?.name?.includes(homeTeamSearch) || m.awayTeam?.name?.includes(homeTeamSearch)) ||
         (m.homeTeam?.name?.includes(awayTeamSearch) || m.awayTeam?.name?.includes(awayTeamSearch))) &&
        m.status === 'TIMED'
      ).slice(0, 3);
      
      if (upcomingMatches?.length > 0) {
        console.log('📅 Ближайшие матчи с этими командами:');
        upcomingMatches.forEach(m => {
          console.log(`  ${m.homeTeam.name} vs ${m.awayTeam.name}`);
          console.log(`  ${new Date(m.utcDate).toLocaleString('ru-RU')} (${m.status})\n`);
        });
      }
      
      return;
    }
    
    // Показываем полную информацию о найденном матче
    console.log('✅ НАЙДЕН МАТЧ:\n');
    console.log(`🏟  ${match.homeTeam.name} vs ${match.awayTeam.name}`);
    console.log(`📅 Kickoff: ${new Date(match.utcDate).toLocaleString('ru-RU')}`);
    console.log(`🔖 Status: ${match.status}`);
    console.log(`🆔 Match ID: ${match.id}`);
    console.log(`🏆 Stage: ${match.stage}, Matchday: ${match.matchday}\n`);
    
    console.log('📊 СЧЁТ:');
    if (match.score) {
      console.log(`  Full Time:    ${match.score.fullTime?.home ?? 'null'} : ${match.score.fullTime?.away ?? 'null'}`);
      console.log(`  Half Time:    ${match.score.halfTime?.home ?? 'null'} : ${match.score.halfTime?.away ?? 'null'}`);
      console.log(`  Regular Time: ${match.score.regularTime?.home ?? 'null'} : ${match.score.regularTime?.away ?? 'null'}`);
      console.log(`  Extra Time:   ${match.score.extraTime?.home ?? 'null'} : ${match.score.extraTime?.away ?? 'null'}`);
      console.log(`  Penalties:    ${match.score.penalties?.home ?? 'null'} : ${match.score.penalties?.away ?? 'null'}\n`);
    } else {
      console.log('  ❌ Счёт отсутствует (null)\n');
    }
    
    console.log('📦 RAW SCORE OBJECT:');
    console.log(JSON.stringify(match.score, null, 2));
    console.log('\n📦 FULL MATCH OBJECT:');
    console.log(JSON.stringify(match, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

checkLiveMatch();








