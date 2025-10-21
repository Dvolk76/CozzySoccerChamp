/**
 * Сервис для автоматического бекапа базы данных D1
 */

interface Env {
  DB: D1Database;
  BACKUP_BUCKET?: R2Bucket; // Опционально: для хранения в R2
  BACKUP_WEBHOOK_URL?: string; // Опционально: для отправки в другое место
}

/**
 * Создает бекап базы данных D1
 */
export async function createBackup(env: Env): Promise<{
  success: boolean;
  timestamp: string;
  tables: string[];
  size?: number;
  location?: string;
}> {
  const timestamp = new Date().toISOString();
  const backupData: any = {
    timestamp,
    version: '1.0',
    tables: {} as Record<string, any[]>,
  };

  try {
    // Список всех таблиц
    const tables = ['User', 'Match', 'Prediction', 'PredictionHistory', 'Score'];
    
    // Экспортируем данные из каждой таблицы
    for (const table of tables) {
      const result = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      backupData.tables[table] = result.results || [];
    }

    // Экспортируем схему базы данных
    const schemaResult = await env.DB.prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    ).all();
    backupData.schema = schemaResult.results || [];

    const backupJson = JSON.stringify(backupData, null, 2);
    const backupSize = new TextEncoder().encode(backupJson).length;

    // Вариант 1: Сохранить в R2 (если настроено)
    if (env.BACKUP_BUCKET) {
      const filename = `backup-${timestamp.replace(/[:.]/g, '-')}.json`;
      await env.BACKUP_BUCKET.put(filename, backupJson, {
        httpMetadata: {
          contentType: 'application/json',
        },
        customMetadata: {
          timestamp,
          tables: tables.join(','),
          size: backupSize.toString(),
        },
      });

      console.log(`✅ Backup saved to R2: ${filename}`);
      
      return {
        success: true,
        timestamp,
        tables,
        size: backupSize,
        location: `r2://${filename}`,
      };
    }

    // Вариант 2: Отправить на webhook (например, в Telegram или на внешний сервер)
    if (env.BACKUP_WEBHOOK_URL) {
      const response = await fetch(env.BACKUP_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: backupJson,
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }

      console.log(`✅ Backup sent to webhook: ${env.BACKUP_WEBHOOK_URL}`);
      
      return {
        success: true,
        timestamp,
        tables,
        size: backupSize,
        location: 'webhook',
      };
    }

    // Вариант 3: Вернуть данные (можно логировать или отправлять)
    console.log(`✅ Backup created: ${backupSize} bytes`);
    
    return {
      success: true,
      timestamp,
      tables,
      size: backupSize,
    };

  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

/**
 * Восстанавливает базу данных из бекапа
 */
export async function restoreBackup(
  env: Env,
  backupData: any
): Promise<{ success: boolean; tablesRestored: string[] }> {
  const tablesRestored: string[] = [];

  try {
    // Восстанавливаем данные в каждую таблицу
    for (const [tableName, rows] of Object.entries(backupData.tables)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      
      // Вставляем данные партиями
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        for (const row of batch) {
          const values = columns.map((col) => (row as any)[col]);
          await env.DB.prepare(
            `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
          ).bind(...values).run();
        }
      }

      tablesRestored.push(tableName);
      console.log(`✅ Restored ${rows.length} rows to ${tableName}`);
    }

    return {
      success: true,
      tablesRestored,
    };

  } catch (error) {
    console.error('❌ Restore failed:', error);
    throw error;
  }
}

/**
 * Удаляет старые бекапы (оставляет последние N)
 */
export async function cleanupOldBackups(
  bucket: R2Bucket,
  keepLast: number = 30
): Promise<number> {
  const list = await bucket.list({ prefix: 'backup-' });
  
  if (!list.objects || list.objects.length <= keepLast) {
    return 0;
  }

  // Сортируем по дате (новые первые)
  const sorted = list.objects.sort((a, b) => 
    (b.uploaded?.getTime() || 0) - (a.uploaded?.getTime() || 0)
  );

  // Удаляем старые
  const toDelete = sorted.slice(keepLast);
  let deleted = 0;

  for (const obj of toDelete) {
    await bucket.delete(obj.key);
    deleted++;
  }

  console.log(`🗑️ Deleted ${deleted} old backups`);
  return deleted;
}

