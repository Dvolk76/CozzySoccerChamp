const FOOTBALL_API_TOKEN = '96637ff475924456a64fa80adc981cbb';
const BASE_URL = 'https://api.football-data.org/v4';

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

async function quickSync() {
  console.log('🔄 Быстрая синхронизация результатов...\n');
  
  const res = await fetch(`${BASE_URL}/competitions/CL/matches?season=2025&status=FINISHED`, { 
    headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN } 
  });
  
  const data = await res.json();
  console.log(`✅ Завершенных матчей: ${data.matches?.length || 0}\n`);
  
  let updated = 0;
  
  for (const m of data.matches || []) {
    const extId = String(m.id);
    const status = 'FINISHED';
    const scoreHome = m.score?.fullTime?.home ?? null;
    const scoreAway = m.score?.fullTime?.away ?? null;
    
    if (scoreHome === null || scoreAway === null) continue;
    
    // Простой SQL без проблемных полей
    const sql = `UPDATE Match SET status='${status}', scoreHome=${scoreHome}, scoreAway=${scoreAway}, updatedAt=CURRENT_TIMESTAMP WHERE extId='${extId}'`;
    
    try {
      await execAsync(`npx wrangler d1 execute cozy-soccer-champ-db --remote --command "${sql}"`);
      console.log(`✅ ${m.homeTeam.name} ${scoreHome}:${scoreAway} ${m.awayTeam.name}`);
      updated++;
    } catch (error) {
      console.error(`❌ ${extId}: ${error.message.split('\n')[0]}`);
    }
  }
  
  console.log(`\n✅ Обновлено: ${updated} матчей`);
}

quickSync().catch(console.error);
