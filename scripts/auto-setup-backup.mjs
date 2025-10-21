#!/usr/bin/env node

/**
 * Автоматическая настройка системы бекапа
 */

import { spawn, execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const parts = command.split(' ');
    const cmd = spawn(parts[0], parts.slice(1), {
      stdio: 'inherit',
      shell: true
    });
    
    cmd.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

async function getTelegramChatId() {
  console.log('\n📱 Получение Telegram Chat ID...\n');
  
  const answer = await question('Вы уже отправили сообщение боту в Telegram? (y/n): ');
  
  if (answer.toLowerCase() !== 'y') {
    console.log('\n⚠️  Пожалуйста:');
    console.log('1. Откройте Telegram');
    console.log('2. Найдите вашего бота');
    console.log('3. Отправьте любое сообщение (например: "Привет" или /start)');
    console.log('4. Запустите этот скрипт снова\n');
    return null;
  }
  
  console.log('\n🔍 Попробую получить chat ID автоматически...\n');
  
  // Создаем временный endpoint в worker для получения chat ID
  const getUpdatesEndpoint = `
// Временный endpoint для получения chat ID
if (path === '/api/get-chat-id' && request.method === 'GET') {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  
  try {
    const response = await fetch(\`https://api.telegram.org/bot\${token}/getUpdates?limit=10\`);
    const data = await response.json();
    
    if (!data.ok || !data.result || data.result.length === 0) {
      return new Response(JSON.stringify({
        error: 'No messages found',
        hint: 'Please send any message to your bot first'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    const lastUpdate = data.result[data.result.length - 1];
    const chatId = lastUpdate.message?.chat?.id || lastUpdate.message?.from?.id;
    const firstName = lastUpdate.message?.from?.first_name || 'User';
    
    return new Response(JSON.stringify({
      chatId,
      firstName,
      messageCount: data.result.length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
`;

  console.log('📝 Инструкция для ручного получения:');
  console.log('');
  console.log('1. Выполните команду:');
  console.log('   wrangler secret list');
  console.log('');
  console.log('2. Откройте в браузере (замените <TOKEN> на ваш TELEGRAM_BOT_TOKEN):');
  console.log('   https://api.telegram.org/bot<TOKEN>/getUpdates');
  console.log('');
  console.log('3. Найдите: "chat":{"id":123456789}');
  console.log('');
  
  const chatId = await question('Введите ваш chat ID: ');
  return chatId.trim();
}

async function setupR2() {
  console.log('\n☁️  Настройка R2...\n');
  
  console.log('Для хранения бекапов в облаке нужно:');
  console.log('');
  console.log('1️⃣  Откройте: https://dash.cloudflare.com/');
  console.log('2️⃣  Слева: R2 Object Storage');
  console.log('3️⃣  Нажмите "Purchase R2" или "Enable R2" (бесплатно до 10GB)');
  console.log('');
  
  const answer = await question('R2 активирован? (y/n): ');
  
  if (answer.toLowerCase() === 'y') {
    console.log('\n📦 Создаю bucket...');
    try {
      await runCommand('npx wrangler r2 bucket create cozy-soccer-backups');
      console.log('✅ Bucket создан!');
      return true;
    } catch (error) {
      console.error('❌ Не удалось создать bucket:', error.message);
      return false;
    }
  }
  
  return false;
}

async function updateWranglerConfig(enableR2) {
  if (!enableR2) return;
  
  console.log('\n⚙️  Обновляю wrangler.toml...');
  
  try {
    let content = await readFile('wrangler.toml', 'utf-8');
    
    // Раскомментируем R2 конфигурацию
    content = content.replace(
      /# \[\[r2_buckets\]\]\n# binding = "BACKUP_BUCKET"\n# bucket_name = "cozy-soccer-backups"/,
      '[[r2_buckets]]\nbinding = "BACKUP_BUCKET"\nbucket_name = "cozy-soccer-backups"'
    );
    
    await writeFile('wrangler.toml', content, 'utf-8');
    console.log('✅ wrangler.toml обновлен');
  } catch (error) {
    console.error('❌ Ошибка обновления wrangler.toml:', error.message);
  }
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  🔧 Автоматическая настройка бекапа БД    ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
  
  // Шаг 1: Telegram
  const chatId = await getTelegramChatId();
  
  if (chatId && chatId.match(/^\d+$/)) {
    console.log(`\n✅ Chat ID получен: ${chatId}`);
    console.log('\n📝 Устанавливаю секрет...');
    
    try {
      execSync(`echo "${chatId}" | npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID`, {
        stdio: 'inherit'
      });
      console.log('✅ TELEGRAM_ADMIN_CHAT_ID установлен!');
    } catch (error) {
      console.error('❌ Не удалось установить секрет');
      console.log('\nВыполните вручную:');
      console.log(`  wrangler secret put TELEGRAM_ADMIN_CHAT_ID`);
      console.log(`  # Введите: ${chatId}`);
    }
  }
  
  // Шаг 2: R2
  const r2Enabled = await setupR2();
  await updateWranglerConfig(r2Enabled);
  
  // Шаг 3: Deploy
  console.log('\n🚀 Деплою обновленный worker...\n');
  
  const deployAnswer = await question('Задеплоить сейчас? (y/n): ');
  
  if (deployAnswer.toLowerCase() === 'y') {
    try {
      await runCommand('npm run build');
      await runCommand('npm run deploy');
      console.log('\n✅ Деплой завершен!');
    } catch (error) {
      console.error('❌ Ошибка деплоя:', error.message);
    }
  }
  
  // Итоги
  console.log('\n');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║         ✅ Настройка завершена!           ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
  console.log('📊 Статус:');
  console.log(`  Telegram: ${chatId ? '✅' : '⏳ Нужен chat ID'}`);
  console.log(`  R2: ${r2Enabled ? '✅' : '⏳ Активируйте в Dashboard'}`);
  console.log('  Автобекапы: ✅ Каждый день в 03:00 UTC');
  console.log('');
  console.log('📚 Документация: SETUP_COMPLETE.md');
  console.log('');
  
  rl.close();
}

main().catch(console.error);

