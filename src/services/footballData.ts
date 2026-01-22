import type { PrismaClient } from '@prisma/client';

const BASE_URL = 'https://api.football-data.org/v4';

export async function syncChampionsLeague(prisma: PrismaClient, season: number, env?: any) {
  const token = env?.FOOTBALL_API_TOKEN || env?.FOOTBALL_DATA_API_TOKEN || process.env.FOOTBALL_API_TOKEN || process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) {
    console.error('[syncChampionsLeague] No API token found in env:', {
      hasEnvToken: !!env?.FOOTBALL_API_TOKEN,
      hasEnvToken2: !!env?.FOOTBALL_DATA_API_TOKEN,
      hasProcessToken: !!process.env.FOOTBALL_API_TOKEN
    });
    throw new Error('FOOTBALL_API_TOKEN or FOOTBALL_DATA_API_TOKEN required');
  }

  // Competition code for UCL is usually CL
  const url = `${BASE_URL}/competitions/CL/matches?season=${season}`;
  console.log('[syncChampionsLeague] Fetching from:', url);
  
  const res = await fetch(url, { headers: { 'X-Auth-Token': token } });
  console.log('[syncChampionsLeague] API response:', res.status, res.statusText);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('[syncChampionsLeague] API error:', res.status, errorText);
    throw new Error(`football-data error ${res.status}: ${errorText}`);
  }
  
  const data = await res.json() as any;
  console.log('[syncChampionsLeague] Received matches:', data.matches?.length || 0);

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
    let status = m.status ?? 'SCHEDULED';

    // Определяем счет в зависимости от статуса
    // - Для завершенных матчей используем только fullTime
    // - Для лайв матчей берем best-available: fullTime -> regularTime -> halfTime
    let scoreHome: number | null = null;
    let scoreAway: number | null = null;

    const isLiveLike = status === 'LIVE' || status === 'IN_PLAY' || status === 'PAUSED' || status === 'TIMED';
    if (status === 'FINISHED') {
      scoreHome = m.score?.fullTime?.home ?? null;
      scoreAway = m.score?.fullTime?.away ?? null;
    } else if (isLiveLike) {
      scoreHome =
        (m.score?.fullTime?.home ??
         m.score?.regularTime?.home ??
         m.score?.halfTime?.home ?? null);
      scoreAway =
        (m.score?.fullTime?.away ??
         m.score?.regularTime?.away ??
         m.score?.halfTime?.away ?? null);
    } else {
      // До начала матча счет неизвестен
      scoreHome = null;
      scoreAway = null;
    }

    // Дополнительная логика для исправления статусов старых матчей
    const now = new Date();
    const matchTime = new Date(m.utcDate);
    const hoursFromKickoff = Math.max(0, (now.getTime() - matchTime.getTime()) / (1000 * 60 * 60));

    // Если время начала уже наступило, но API оставил статус TIMED/SCHEDULED — считаем матч начатым
    if ((status === 'TIMED' || status === 'SCHEDULED') && now >= matchTime) {
      status = 'IN_PLAY';
    }
    
    // Если матч был более 4 часов назад и есть счет, принудительно устанавливаем статус FINISHED
    if (hoursFromKickoff >= 4 && (scoreHome != null || scoreAway != null)) {
      status = 'FINISHED';
    }
    
    // Если матч был более 6 часов назад, принудительно устанавливаем статус FINISHED
    // ВАЖНО: Если статус уже FINISHED от API, но счет еще не установлен, пытаемся получить счет из других источников
    if (hoursFromKickoff >= 6) {
      status = 'FINISHED';
      // Если счет еще не установлен, но матч завершен, пытаемся получить счет из fullTime
      if ((scoreHome === null || scoreAway === null) && m.score?.fullTime) {
        scoreHome = m.score.fullTime.home ?? scoreHome;
        scoreAway = m.score.fullTime.away ?? scoreAway;
      }
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
          scoreHome: scoreHome,
          scoreAway: scoreAway,
        },
        update: {
          stage,
          group,
          matchday,
          homeTeam,
          awayTeam,
          kickoffAt,
          status,
          scoreHome: scoreHome,
          scoreAway: scoreAway,
        },
      })
    );
  }
  
  console.log('[syncChampionsLeague] Upserting', tasks.length, 'matches...');
  await Promise.all(tasks);
  console.log('[syncChampionsLeague] Successfully synced', tasks.length, 'matches');
  
  return { count: tasks.length };
}

export async function getTopScorers(season: number, env?: any) {
  const token = env?.FOOTBALL_API_TOKEN || env?.FOOTBALL_DATA_API_TOKEN || process.env.FOOTBALL_API_TOKEN || process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) {
    console.error('[getTopScorers] No API token found');
    throw new Error('FOOTBALL_API_TOKEN or FOOTBALL_DATA_API_TOKEN required');
  }

  const url = `${BASE_URL}/competitions/CL/scorers?season=${season}&limit=10`;
  console.log('[getTopScorers] Fetching from:', url);
  
  const res = await fetch(url, { headers: { 'X-Auth-Token': token } });
  console.log('[getTopScorers] API response:', res.status, res.statusText);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('[getTopScorers] API error:', res.status, errorText);
    throw new Error(`football-data error ${res.status}: ${errorText}`);
  }
  
  const data = await res.json() as any;
  console.log('[getTopScorers] Received scorers:', data.scorers?.length || 0);

  return {
    scorers: (data.scorers ?? []).map((scorer: any, index: number) => ({
      rank: index + 1,
      playerName: scorer.player?.name ?? 'Unknown',
      teamName: scorer.team?.name ?? 'Unknown',
      goals: scorer.goals ?? 0,
      assists: scorer.assists ?? 0,
      playedMatches: scorer.playedMatches ?? 0,
    }))
  };
}


