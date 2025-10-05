import type { PrismaClient } from '@prisma/client';

const BASE_URL = 'https://api.football-data.org/v4';

export async function syncChampionsLeague(prisma: PrismaClient, season: number, env?: any) {
  const token = env?.FOOTBALL_API_TOKEN || env?.FOOTBALL_DATA_API_TOKEN || process.env.FOOTBALL_API_TOKEN || process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) throw new Error('FOOTBALL_API_TOKEN or FOOTBALL_DATA_API_TOKEN required');

  // Competition code for UCL is usually CL
  const url = `${BASE_URL}/competitions/CL/matches?season=${season}`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': token } });
  if (!res.ok) throw new Error(`football-data error ${res.status}`);
  const data = await res.json() as any;

  // Upsert matches
  const tasks: Promise<any>[] = [];
  for (const m of data.matches ?? []) {
    const extId = String(m.id);
    const homeTeam = m.homeTeam?.name ?? 'Home';
    const awayTeam = m.awayTeam?.name ?? 'Away';
    const kickoffAt = new Date(m.utcDate);
    const stage = m.stage ?? 'UNKNOWN';
    const group = m.group ?? null;
    const matchday = m.matchday ?? null;
    const status = m.status ?? 'SCHEDULED';

    // Для лайв матчей берем счет из fullTime, если его нет - из halfTime
    // Для завершенных матчей всегда fullTime
    let scoreHome = m.score?.fullTime?.home ?? null;
    let scoreAway = m.score?.fullTime?.away ?? null;
    
    // Если fullTime счета нет, но есть halfTime - используем его для лайв матчей
    if ((scoreHome === null || scoreAway === null) && 
        (status === 'LIVE' || status === 'IN_PLAY' || status === 'PAUSED' || status === 'TIMED')) {
      scoreHome = m.score?.halfTime?.home ?? scoreHome;
      scoreAway = m.score?.halfTime?.away ?? scoreAway;
    }

    // Дополнительная логика для исправления статусов старых матчей
    const now = new Date();
    const matchTime = new Date(m.utcDate);
    const hoursFromKickoff = Math.max(0, (now.getTime() - matchTime.getTime()) / (1000 * 60 * 60));
    
    // Если матч был более 4 часов назад и есть счет, принудительно устанавливаем статус FINISHED
    if (hoursFromKickoff >= 4 && (scoreHome !== null || scoreAway !== null)) {
      status = 'FINISHED';
    }
    
    // Если матч был более 6 часов назад, принудительно устанавливаем статус FINISHED
    if (hoursFromKickoff >= 6) {
      status = 'FINISHED';
    }

    tasks.push(
      prisma.match.upsert({
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
      })
    );
  }
  await Promise.all(tasks);
  return { count: tasks.length };
}


