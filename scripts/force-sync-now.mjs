#!/usr/bin/env node

/**
 * Принудительная синхронизация матчей из Football Data API в production БД
 */

const WORKER_URL = 'https://cozy-soccer-champ.cozzy-soccer.workers.dev';

// Telegram initData нужно взять из браузера (из любого запроса в Network tab)
const initData = process.argv[2];

if (!initData) {
  console.error('❌ Не указан initData');
  console.log('\nИспользование:');
  console.log('  node scripts/force-sync-now.mjs "YOUR_INIT_DATA_FROM_BROWSER"\n');
  console.log('Где взять initData:');
  console.log('  1. Откройте приложение в браузере');
  console.log('  2. Откройте DevTools → Network');
  console.log('  3. Обновите страницу');
  console.log('  4. Найдите любой запрос к /api/');
  console.log('  5. Скопируйте значение параметра initData из URL\n');
  process.exit(1);
}

console.log('🔄 Запускаем принудительную синхронизацию...\n');

async function forceSync() {
  try {
    const url = `${WORKER_URL}/api/admin/sync?initData=${encodeURIComponent(initData)}`;
    
    console.log(`📡 POST ${WORKER_URL}/api/admin/sync`);
    console.log(`📦 Body: { season: 2025, force: true }\n`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        season: 2025,
        force: true
      })
    });
    
    console.log(`📥 Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log('📥 Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log(`\n✅ Синхронизация успешна! Обновлено матчей: ${data.count || 0}`);
    } else {
      console.log(`\n❌ Ошибка синхронизации: ${data.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
  }
}

forceSync();








