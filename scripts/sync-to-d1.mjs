// Скрипт для принудительной синхронизации с D1
const FOOTBALL_API_TOKEN = '96637ff475924456a64fa80adc981cbb';
const BASE_URL = 'https://api.football-data.org/v4';
const D1_DATABASE_ID = '065be909-9a91-4982-94e5-d5e44b3caf31';

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

async function syncToD1() {
  console.log('🔄 Начинаем синхронизацию с D1...\n');
  
  const season = 2025;
  const url = `${BASE_URL}/competitions/CL/matches?season=${season}`;
  
  console.log(`📡 Получаем данные из API...\n`);
  
  const res = await fetch(url, { 
    headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN } 
  });
  
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  
  const data = await res.json();
  console.log(`✅ Получено матчей: ${data.matches?.length || 0}\n`);
  
  let updated = 0;
  let errors = 0;
  
  for (const m of data.matches || []) {
    const extId = String(m.id);
    const homeTeam = m.homeTeam?.name ?? 'Home';
    const awayTeam = m.awayTeam?.name ?? 'Away';
    const kickoffAt = new Date(m.utcDate).toISOString();
    const stage = m.stage ?? 'UNKNOWN';
    const group = m.group ?? null;
    const matchday = m.matchday ?? null;
    let status = m.status ?? 'SCHEDULED';
    
    // ВАЖНО: Если есть fullTime score, матч считается завершенным
    const hasFullTimeScore = m.score?.fullTime?.home != null && m.score?.fullTime?.away != null;
    
    let scoreHome = m.score?.fullTime?.home ?? null;
    let scoreAway = m.score?.fullTime?.away ?? null;
    
    // Если есть fullTime score, используем его и помечаем матч как завершенный
    if (hasFullTimeScore) {
      status = 'FINISHED';
    } else {
      // Если fullTime счета нет, но есть halfTime - используем его для лайв матчей
      if ((scoreHome === null || scoreAway === null) && 
          (status === 'LIVE' || status === 'IN_PLAY' || status === 'PAUSED' || status === 'TIMED')) {
        scoreHome = m.score?.halfTime?.home ?? scoreHome;
        scoreAway = m.score?.halfTime?.away ?? scoreAway;
      }
    }
    
    // Дополнительная логика для исправления статусов старых матчей
    const now = new Date();
    const matchTime = new Date(m.utcDate);
    const hoursFromKickoff = Math.max(0, (now.getTime() - matchTime.getTime()) / (1000 * 60 * 60));
    
    // Если матч был более 4 часов назад и есть счет, принудительно устанавливаем статус FINISHED
    if (!hasFullTimeScore && hoursFromKickoff >= 4 && (scoreHome !== null || scoreAway !== null)) {
      status = 'FINISHED';
    }
    
    // Если матч был более 6 часов назад, принудительно устанавливаем статус FINISHED
    if (!hasFullTimeScore && hoursFromKickoff >= 6) {
      status = 'FINISHED';
    }
    
    // Формируем SQL UPDATE (для простоты используем только update существующих)
    const sql = `
      UPDATE Match 
      SET 
        status = '${status}',
        scoreHome = ${scoreHome === null ? 'NULL' : scoreHome},
        scoreAway = ${scoreAway === null ? 'NULL' : scoreAway},
        homeTeam = '${homeTeam.replace(/'/g, "''")}',
        awayTeam = '${awayTeam.replace(/'/g, "''")}',
        kickoffAt = '${kickoffAt}',
        stage = '${stage}',
        \`group\` = ${group ? `'${group}'` : 'NULL'},
        matchday = ${matchday ?? 'NULL'},
        updatedAt = CURRENT_TIMESTAMP
      WHERE extId = '${extId}'
    `.trim();
    
    try {
      const { stdout, stderr } = await execAsync(
        `npx wrangler d1 execute cozy-soccer-champ-db --remote --command "${sql.replace(/"/g, '\\"')}"`,
        { cwd: process.cwd() }
      );
      
      if (status === 'FINISHED' && updated < 5) {
        console.log(`✅ ${homeTeam} ${scoreHome}:${scoreAway} ${awayTeam}`);
      }
      updated++;
    } catch (error) {
      errors++;
      if (errors <= 3) {
        console.error(`❌ Ошибка для матча ${extId}: ${error.message}`);
      }
    }
  }
  
  console.log(`\n📊 Результат:`);
  console.log(`   Обновлено: ${updated}`);
  console.log(`   Ошибок: ${errors}`);
}

syncToD1().catch(console.error);
