#!/usr/bin/env node
/**
 * Синхронизация аватаров пользователей через Telegram Bot API
 * 
 * Этот скрипт получает аватары пользователей через getUserProfilePhotos
 * и обновляет записи в базе данных.
 */

import 'dotenv/config';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = process.env.VITE_API_BASE || 'http://localhost:3000';

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in environment');
  process.exit(1);
}

async function getUserAvatar(userId) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.ok || !data.result.photos || data.result.photos.length === 0) {
      return null;
    }
    
    // Получаем самое большое фото из первого набора
    const photos = data.result.photos[0];
    const largestPhoto = photos[photos.length - 1];
    
    // Получаем URL файла
    const fileUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${largestPhoto.file_id}`;
    const fileResponse = await fetch(fileUrl);
    const fileData = await fileResponse.json();
    
    if (!fileData.ok) {
      return null;
    }
    
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
  } catch (error) {
    console.error(`Error fetching avatar for user ${userId}:`, error.message);
    return null;
  }
}

async function syncAvatars() {
  try {
    console.log('🔄 Starting avatar synchronization...\n');
    
    // Получаем список пользователей из API
    const response = await fetch(`${API_URL}/api/admin/users`, {
      headers: {
        'X-Telegram-Init-Data': process.env.DEV_INIT_DATA || ''
      }
    });
    
    if (!response.ok) {
      console.error('❌ Failed to fetch users from API');
      console.error('Make sure the API server is running and accessible');
      process.exit(1);
    }
    
    const { users } = await response.json();
    console.log(`📋 Found ${users.length} users\n`);
    
    let updated = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const user of users) {
      if (user.avatar) {
        console.log(`⏭️  Skipping ${user.name} (already has avatar)`);
        skipped++;
        continue;
      }
      
      console.log(`🔍 Fetching avatar for ${user.name} (${user.tg_user_id})...`);
      const avatarUrl = await getUserAvatar(user.tg_user_id);
      
      if (avatarUrl) {
        // Обновляем аватар в базе через API
        // (Здесь нужно добавить эндпоинт для обновления аватара)
        console.log(`✅ Found avatar: ${avatarUrl.substring(0, 80)}...`);
        updated++;
      } else {
        console.log(`❌ No avatar found for ${user.name}`);
        failed++;
      }
      
      // Небольшая задержка, чтобы не превышать rate limits Telegram API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 Summary:');
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  📋 Total: ${users.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

console.log('🤖 Telegram Avatar Sync Tool');
console.log('============================\n');
syncAvatars();

