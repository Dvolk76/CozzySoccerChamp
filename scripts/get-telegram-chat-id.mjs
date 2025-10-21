#!/usr/bin/env node

/**
 * Скрипт для получения Telegram chat ID через Cloudflare Worker
 * Использует TELEGRAM_BOT_TOKEN из секретов
 */

import { spawn } from 'child_process';

console.log('🔍 Получаю ваш Telegram chat ID...');
console.log('');

// Создаем временный worker endpoint который получит updates
const workerCode = `
export default {
  async fetch(request, env) {
    const token = env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const response = await fetch(\`https://api.telegram.org/bot\${token}/getUpdates?limit=10\`);
      const data = await response.json();
      
      if (!data.ok || !data.result || data.result.length === 0) {
        return new Response(JSON.stringify({
          error: 'No messages found',
          hint: 'Please send any message to your bot first, then run this script again'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Находим chat ID из последнего сообщения
      const lastUpdate = data.result[data.result.length - 1];
      const chatId = lastUpdate.message?.chat?.id || lastUpdate.message?.from?.id;
      const firstName = lastUpdate.message?.from?.first_name || 'User';
      const username = lastUpdate.message?.from?.username || '';

      return new Response(JSON.stringify({
        chatId,
        firstName,
        username,
        hint: 'This is your Telegram chat ID. Use it to set TELEGRAM_ADMIN_CHAT_ID secret.'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
`;

console.log('📡 Запрашиваю последние сообщения от Telegram бота...');

// Используем curl к deployed worker с временным endpoint
const cmd = spawn('curl', [
  '-s',
  'https://cozy-soccer-champ.cozzy-soccer.workers.dev/api/telegram-check'
], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let output = '';
cmd.stdout.on('data', (data) => {
  output += data.toString();
});

cmd.on('close', async (code) => {
  // Если endpoint не существует, используем альтернативный способ
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📱 Чтобы получить ваш Telegram Chat ID:');
  console.log('');
  console.log('1️⃣  Отправьте любое сообщение вашему боту в Telegram');
  console.log('    (например: "Привет" или "/start")');
  console.log('');
  console.log('2️⃣  Откройте эту ссылку в браузере:');
  console.log('');
  console.log('    https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates');
  console.log('');
  console.log('    Замените <YOUR_BOT_TOKEN> на ваш токен');
  console.log('');
  console.log('3️⃣  Найдите в JSON ответе:');
  console.log('    "chat":{"id":123456789}');
  console.log('                    ^^^^^^^^^');
  console.log('    Это ваш chat ID!');
  console.log('');
  console.log('4️⃣  Установите секрет:');
  console.log('');
  console.log('    wrangler secret put TELEGRAM_ADMIN_CHAT_ID');
  console.log('    # Введите ваш chat ID');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('💡 Альтернативный способ (автоматический):');
  console.log('');
  console.log('Я создам временный API endpoint для получения chat ID.');
  console.log('Хотите продолжить? (y/n)');
});

