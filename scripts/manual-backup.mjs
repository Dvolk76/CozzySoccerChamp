#!/usr/bin/env node

/**
 * Скрипт для ручного бекапа базы данных D1
 * 
 * Использование:
 *   node scripts/manual-backup.mjs
 *   node scripts/manual-backup.mjs --output backup.json
 */

import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import path from 'path';

const DB_NAME = 'cozy-soccer-champ-db';
const DEFAULT_OUTPUT = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

// Парсим аргументы
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : DEFAULT_OUTPUT;

console.log('🔄 Creating database backup...');
console.log(`📦 Database: ${DB_NAME}`);
console.log(`📁 Output: ${outputFile}`);

// Таблицы для экспорта
const tables = ['User', 'Match', 'Prediction', 'PredictionHistory', 'Score'];

async function executeQuery(query) {
  return new Promise((resolve, reject) => {
    const cmd = spawn('npx', ['wrangler', 'd1', 'execute', DB_NAME, '--command', query, '--json'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let output = '';
    cmd.stdout.on('data', (data) => {
      output += data.toString();
    });

    cmd.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`wrangler command failed with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(output);
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Failed to parse wrangler output: ${error.message}`));
      }
    });
  });
}

async function main() {
  try {
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      tables: {},
      schema: []
    };

    // Экспортируем данные из каждой таблицы
    for (const table of tables) {
      console.log(`📊 Exporting ${table}...`);
      try {
        const result = await executeQuery(`SELECT * FROM ${table}`);
        // wrangler возвращает массив результатов, берем первый элемент
        const data = result && result.length > 0 ? result[0] : { results: [] };
        backupData.tables[table] = data.results || [];
        console.log(`   ✓ ${backupData.tables[table].length} rows`);
      } catch (error) {
        console.error(`   ✗ Failed to export ${table}:`, error.message);
        backupData.tables[table] = [];
      }
    }

    // Экспортируем схему базы данных
    console.log('📋 Exporting schema...');
    try {
      const schemaResult = await executeQuery(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
      );
      const schemaData = schemaResult && schemaResult.length > 0 ? schemaResult[0] : { results: [] };
      backupData.schema = schemaData.results || [];
      console.log(`   ✓ ${backupData.schema.length} tables in schema`);
    } catch (error) {
      console.error('   ✗ Failed to export schema:', error.message);
    }

    // Сохраняем в файл
    const json = JSON.stringify(backupData, null, 2);
    await writeFile(outputFile, json, 'utf-8');
    
    const size = Buffer.byteLength(json, 'utf-8');
    console.log('');
    console.log('✅ Backup completed successfully!');
    console.log(`📁 File: ${path.resolve(outputFile)}`);
    console.log(`💾 Size: ${(size / 1024).toFixed(2)} KB`);
    console.log('');
    console.log('To restore this backup:');
    console.log(`  node scripts/restore-backup.mjs --input ${outputFile}`);

  } catch (error) {
    console.error('');
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

main();

