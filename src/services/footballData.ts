import type { PrismaClient } from '@prisma/client';

const BASE_URL = 'https://api.football-data.org/v4';

export async function syncChampionsLeague(prisma: PrismaClient, season: number) {
  const token = process.env.FOOTBALL_DATA_API_TOKEN;
  if (!token) throw new Error('FOOTBALL_DATA_API_TOKEN required');

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

    const scoreHome = m.score?.fullTime?.home ?? null;
    const scoreAway = m.score?.fullTime?.away ?? null;

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


