// Тест логики синхронизации
import { PrismaClient } from '@prisma/client';

const BASE_URL = 'https://api.football-data.org/v4';
const FOOTBALL_API_TOKEN = process.env.FOOTBALL_API_TOKEN || process.env.FOOTBALL_DATA_API_TOKEN || '96637ff475924456a64fa80adc981cbb';

const prisma = new PrismaClient();

async function testSyncLogic() {
  console.log('🧪 Тестирование логики синхронизации\n');
  
  const season = 2025;
  const url = `${BASE_URL}/competitions/CL/matches?season=${season}`;
  
  console.log('📡 Запрос к API...');
  const res = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN } });
  
  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }
  
  const data = await res.json();
  console.log(`✅ Получено матчей: ${data.matches?.length || 0}\n`);
  
  // Проверяем несколько матчей
  const testMatches = data.matches.slice(0, 3);
  
  console.log('📝 Тестируем upsert для 3 матчей:\n');
  
  for (const m of testMatches) {
    const extId = String(m.id);
    const homeTeam = m.homeTeam?.name ?? 'Home';
    const awayTeam = m.awayTeam?.name ?? 'Away';
    const kickoffAt = new Date(m.utcDate);
    const stage = m.stage ?? 'UNKNOWN';
    const group = m.group ?? null;
    const matchday = m.matchday ?? null;
    let status = m.status ?? 'SCHEDULED';
    
    let scoreHome = m.score?.fullTime?.home ?? null;
    let scoreAway = m.score?.fullTime?.away ?? null;
    
    if ((scoreHome === null || scoreAway === null) && 
        (status === 'LIVE' || status === 'IN_PLAY' || status === 'PAUSED' || status === 'TIMED')) {
      scoreHome = m.score?.halfTime?.home ?? scoreHome;
      scoreAway = m.score?.halfTime?.away ?? scoreAway;
    }
    
    const now = new Date();
    const hoursFromKickoff = Math.max(0, (now.getTime() - kickoffAt.getTime()) / (1000 * 60 * 60));
    
    if (hoursFromKickoff >= 4 && (scoreHome !== null || scoreAway !== null)) {
      status = 'FINISHED';
    }
    
    if (hoursFromKickoff >= 6) {
      status = 'FINISHED';
    }
    
    console.log(`${homeTeam} vs ${awayTeam}`);
    console.log(`  Status: ${status}, Score: ${scoreHome ?? '?'}:${scoreAway ?? '?'}`);
    
    try {
      const result = await prisma.match.upsert({
        where: { extId },
        create: {
          extId,
          stage,
          group,
          matchday,
          homeTeam,
          awayTeam,
          kickoffAt,
          status,
          scoreHome: scoreHome ?? undefined,
          scoreAway: scoreAway ?? undefined,
        },
        update: {
          stage,
          group,
          matchday,
          homeTeam,
          awayTeam,
          kickoffAt,
          status,
          scoreHome: scoreHome ?? undefined,
          scoreAway: scoreAway ?? undefined,
        },
      });
      console.log(`  ✅ Upserted: ${result.id}\n`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }
  
  await prisma.$disconnect();
}

testSyncLogic().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
