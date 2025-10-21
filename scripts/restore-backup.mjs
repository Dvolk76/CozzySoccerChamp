#!/usr/bin/env node

/**
 * Скрипт для восстановления базы данных D1 из бекапа
 * 
 * Использование:
 *   node scripts/restore-backup.mjs --input backup.json
 *   node scripts/restore-backup.mjs --input backup.json --confirm
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { createInterface } from 'readline';

const DB_NAME = 'cozy-soccer-champ-db';

// Парсим аргументы
const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
const confirmFlag = args.includes('--confirm');

if (inputIndex === -1 || !args[inputIndex + 1]) {
  console.error('❌ Error: --input <file> is required');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/restore-backup.mjs --input backup.json');
  console.log('  node scripts/restore-backup.mjs --input backup.json --confirm');
  process.exit(1);
}

const inputFile = args[inputIndex + 1];

async function executeQuery(query) {
  return new Promise((resolve, reject) => {
    const cmd = spawn('npx', ['wrangler', 'd1', 'execute', DB_NAME, '--command', query], {
      stdio: 'inherit'
    });

    cmd.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`wrangler command failed with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function confirmRestore() {
  if (confirmFlag) {
    return true;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n⚠️  This will REPLACE all data in the database. Continue? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  try {
    console.log('🔄 Loading backup file...');
    console.log(`📁 Input: ${inputFile}`);
    
    const json = await readFile(inputFile, 'utf-8');
    const backupData = JSON.parse(json);

    console.log('📦 Backup info:');
    console.log(`   Timestamp: ${backupData.timestamp}`);
    console.log(`   Version: ${backupData.version}`);
    console.log(`   Tables: ${Object.keys(backupData.tables).join(', ')}`);
    
    // Подсчитываем общее количество строк
    let totalRows = 0;
    for (const [tableName, rows] of Object.entries(backupData.tables)) {
      totalRows += rows.length;
    }
    console.log(`   Total rows: ${totalRows}`);

    // Запрашиваем подтверждение
    const confirmed = await confirmRestore();
    
    if (!confirmed) {
      console.log('');
      console.log('❌ Restore cancelled by user');
      process.exit(0);
    }

    console.log('');
    console.log('🔄 Starting restore...');

    // Восстанавливаем данные в каждую таблицу
    for (const [tableName, rows] of Object.entries(backupData.tables)) {
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`⏭️  Skipping ${tableName} (no data)`);
        continue;
      }

      console.log(`📊 Restoring ${tableName} (${rows.length} rows)...`);

      // Очищаем таблицу
      console.log(`   🗑️  Clearing table...`);
      await executeQuery(`DELETE FROM ${tableName}`);

      // Вставляем данные партиями
      const batchSize = 50; // Уменьшаем размер партии для избежания превышения лимитов
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        for (const row of batch) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
              // Экранируем одинарные кавычки
              return `'${value.replace(/'/g, "''")}'`;
            }
            return `'${String(value).replace(/'/g, "''")}'`;
          });

          const query = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
          
          try {
            await executeQuery(query);
          } catch (error) {
            console.error(`   ⚠️  Failed to insert row:`, error.message);
          }
        }
        
        const progress = Math.min(i + batchSize, rows.length);
        console.log(`   📝 Progress: ${progress}/${rows.length}`);
      }

      console.log(`   ✓ ${tableName} restored`);
    }

    console.log('');
    console.log('✅ Restore completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    for (const [tableName, rows] of Object.entries(backupData.tables)) {
      console.log(`   ${tableName}: ${rows.length} rows`);
    }

  } catch (error) {
    console.error('');
    console.error('❌ Restore failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

