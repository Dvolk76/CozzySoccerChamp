/**
 * Cloudflare Cron Job для автоматического бекапа
 * 
 * Это будет выполняться по расписанию, настроенному в wrangler.toml
 */

import { createBackup, cleanupOldBackups } from '../services/backup';

interface Env {
  DB: D1Database;
  BACKUP_BUCKET?: R2Bucket;
  BACKUP_WEBHOOK_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
}

/**
 * Обработчик Cron события
 */
export async function handleScheduledBackup(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log('🕐 Starting scheduled backup at:', new Date().toISOString());

  try {
    // Создаем бекап
    const result = await createBackup(env);

    // Очищаем старые бекапы (оставляем последние 30)
    if (env.BACKUP_BUCKET) {
      await cleanupOldBackups(env.BACKUP_BUCKET, 30);
    }

    // Отправляем уведомление в Telegram (если настроено)
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID) {
      await sendTelegramNotification(env, {
        status: 'success',
        timestamp: result.timestamp,
        tables: result.tables,
        size: result.size,
        location: result.location,
      });
    }

    console.log('✅ Scheduled backup completed successfully');

  } catch (error: any) {
    console.error('❌ Scheduled backup failed:', error);

    // Отправляем уведомление об ошибке
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID) {
      await sendTelegramNotification(env, {
        status: 'error',
        error: error.message,
      });
    }

    throw error;
  }
}

/**
 * Отправляет уведомление в Telegram
 */
async function sendTelegramNotification(
  env: Env,
  data: {
    status: 'success' | 'error';
    timestamp?: string;
    tables?: string[];
    size?: number;
    location?: string;
    error?: string;
  }
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) {
    return;
  }

  let message = '';

  if (data.status === 'success') {
    message = `✅ *Database Backup Successful*\n\n`;
    message += `📅 Time: ${data.timestamp}\n`;
    message += `📊 Tables: ${data.tables?.join(', ')}\n`;
    message += `💾 Size: ${(data.size! / 1024).toFixed(2)} KB\n`;
    if (data.location) {
      message += `📍 Location: ${data.location}\n`;
    }
  } else {
    message = `❌ *Database Backup Failed*\n\n`;
    message += `⚠️ Error: ${data.error}\n`;
    message += `📅 Time: ${new Date().toISOString()}\n`;
  }

  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}

