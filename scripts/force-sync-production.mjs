// Прямой тест синхронизации с football-data.org
const FOOTBALL_API_TOKEN = '96637ff475924456a64fa80adc981cbb';
const BASE_URL = 'https://api.football-data.org/v4';

async function testSync() {
  console.log('🔍 Проверка API football-data.org...\n');
  
  const season = 2025;
  const url = `${BASE_URL}/competitions/CL/matches?season=${season}`;
  
  console.log(`📡 Запрос: ${url}\n`);
  
  try {
    const res = await fetch(url, { 
      headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN } 
    });
    
    console.log(`Status: ${res.status}`);
    console.log(`Headers:`, Object.fromEntries(res.headers.entries()));
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ Ошибка API: ${text}`);
      return;
    }
    
    const data = await res.json();
    
    console.log(`\n✅ Получено матчей: ${data.matches?.length || 0}`);
    
    // Проверяем последние завершенные матчи
    const finishedMatches = data.matches.filter(m => m.status === 'FINISHED');
    console.log(`\n📊 Завершенных матчей: ${finishedMatches.length}`);
    
    if (finishedMatches.length > 0) {
      console.log('\n🏆 Последние 5 завершенных матчей:');
      finishedMatches.slice(-5).forEach(m => {
        console.log(`  ${m.homeTeam.name} ${m.score.fullTime.home}:${m.score.fullTime.away} ${m.awayTeam.name}`);
        console.log(`    ID: ${m.id}, Status: ${m.status}, Date: ${m.utcDate}`);
      });
    }
    
    // Rate limiting info
    const remaining = res.headers.get('X-Requests-Available-Minute');
    const limit = res.headers.get('X-RequestCounter-Reset');
    console.log(`\n⏱️  Rate Limiting:`);
    console.log(`   Remaining requests: ${remaining || 'N/A'}`);
    console.log(`   Reset: ${limit || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testSync();
