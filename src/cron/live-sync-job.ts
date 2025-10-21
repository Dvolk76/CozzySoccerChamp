/**
 * Cron job для синхронизации live счета матчей
 * Запускается каждые 3 минуты во время игровых дней
 */

import type { Env } from '../worker.js';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { syncChampionsLeague } from '../services/footballData.js';
import pino from 'pino';

const createLogger = (env: Env) => {
  return pino({ 
    level: env.LOG_LEVEL || 'info',
    browser: {
      write: {
        info: console.log,
        error: console.error,
        warn: console.warn,
        debug: console.debug,
      }
    }
  });
};

export async function handleLiveSyncJob(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const logger = createLogger(env);
  const startTime = Date.now();
  
  logger.info({ cron: event.cron, scheduledTime: event.scheduledTime }, '[LiveSync] Starting live score sync job');

  try {
    // Создаем Prisma client с D1 адаптером
    const adapter = new PrismaD1(env.DB);
    const prisma = new PrismaClient({ adapter } as any);

    // Синхронизируем матчи текущего сезона
    const currentYear = new Date().getFullYear();
    const result = await syncChampionsLeague(prisma, currentYear, env);
    
    const duration = Date.now() - startTime;
    
    logger.info({ 
      count: result.count,
      duration,
      season: currentYear 
    }, '[LiveSync] Live score sync completed successfully');

    // Опционально: уведомляем в Telegram только если есть live матчи
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID) {
      try {
        // Получаем статистику по live матчам
        const liveMatches = await prisma.match.count({
          where: {
            status: {
              in: ['IN_PLAY', 'LIVE', 'PAUSED']
            }
          }
        });

        if (liveMatches > 0) {
          // Получаем live матчи с результатами
          const matches = await prisma.match.findMany({
            where: {
              status: {
                in: ['IN_PLAY', 'LIVE', 'PAUSED']
              }
            },
            select: {
              homeTeam: true,
              awayTeam: true,
              scoreHome: true,
              scoreAway: true,
              status: true
            },
            take: 10
          });

          const matchList = matches.map(m => 
            `⚽ ${m.homeTeam} ${m.scoreHome ?? '?'}:${m.scoreAway ?? '?'} ${m.awayTeam} (${m.status})`
          ).join('\n');

          const message = `🔄 *Live Sync Job*\n\n` +
            `✅ Синхронизировано: ${result.count} матчей\n` +
            `⚽ Live матчей: ${liveMatches}\n` +
            `⏱ Время: ${duration}ms\n\n` +
            `${matchList}`;

          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
              text: message,
              parse_mode: 'Markdown'
            })
          });
        }
      } catch (notifyError) {
        logger.warn({ error: notifyError }, '[LiveSync] Failed to send Telegram notification');
      }
    }

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error({ 
      error: error.message,
      stack: error.stack,
      duration 
    }, '[LiveSync] Live score sync job failed');

    // Уведомляем об ошибке в Telegram
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID) {
      try {
        const message = `❌ *Live Sync Job Failed*\n\n` +
          `Error: ${error.message}\n` +
          `Duration: ${duration}ms\n` +
          `Time: ${new Date().toISOString()}`;

        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
          })
        });
      } catch (notifyError) {
        logger.warn({ error: notifyError }, '[LiveSync] Failed to send error notification');
      }
    }

    throw error;
  }
}

