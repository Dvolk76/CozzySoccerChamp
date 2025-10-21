#!/bin/bash

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  🚀 Быстрая настройка Telegram + R2       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Шаг 1: Получение Chat ID
echo "📱 Шаг 1: Получение Telegram Chat ID..."
echo ""
echo "⚠️  Сначала отправьте любое сообщение вашему боту в Telegram"
echo "   (например: 'Привет' или /start)"
echo ""
read -p "Отправили сообщение? (y/n): " sent_message

if [ "$sent_message" != "y" ]; then
    echo ""
    echo "❌ Пожалуйста, отправьте сообщение боту и запустите скрипт снова"
    echo ""
    exit 1
fi

echo ""
echo "🔍 Получаю chat ID..."
echo ""

# Запрос к API endpoint
CHAT_DATA=$(curl -s "https://cozy-soccer-champ.cozzy-soccer.workers.dev/api/get-telegram-chat-id")
CHAT_ID=$(echo "$CHAT_DATA" | grep -o '"chatId":[0-9]*' | grep -o '[0-9]*')
FIRST_NAME=$(echo "$CHAT_DATA" | grep -o '"firstName":"[^"]*"' | cut -d'"' -f4)

if [ -z "$CHAT_ID" ]; then
    echo "❌ Не удалось получить chat ID автоматически"
    echo ""
    echo "📋 Ответ от API:"
    echo "$CHAT_DATA" | jq '.' 2>/dev/null || echo "$CHAT_DATA"
    echo ""
    echo "📝 Получите chat ID вручную:"
    echo "   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates"
    echo ""
    read -p "Введите ваш chat ID: " MANUAL_CHAT_ID
    CHAT_ID=$MANUAL_CHAT_ID
fi

if [ -n "$FIRST_NAME" ]; then
    echo "✅ Найден пользователь: $FIRST_NAME (ID: $CHAT_ID)"
else
    echo "✅ Chat ID получен: $CHAT_ID"
fi

# Установка секрета
echo ""
echo "📝 Устанавливаю TELEGRAM_ADMIN_CHAT_ID..."
echo ""

echo "$CHAT_ID" | npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Telegram настроен!"
else
    echo ""
    echo "❌ Не удалось установить секрет"
    echo "   Выполните вручную:"
    echo "   wrangler secret put TELEGRAM_ADMIN_CHAT_ID"
    echo "   # Введите: $CHAT_ID"
fi

# Шаг 2: R2
echo ""
echo "☁️  Шаг 2: Настройка R2..."
echo ""
echo "Для хранения бекапов в облаке:"
echo "1. Откройте: https://dash.cloudflare.com/"
echo "2. Слева: R2 Object Storage"
echo "3. Нажмите 'Enable R2' (бесплатно до 10GB)"
echo ""
read -p "R2 активирован? (y/n): " r2_enabled

if [ "$r2_enabled" = "y" ]; then
    echo ""
    echo "📦 Создаю bucket..."
    npm run r2:create
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Bucket создан!"
        
        # Обновление wrangler.toml
        echo "⚙️  Обновляю wrangler.toml..."
        sed -i.bak 's/# \[\[r2_buckets\]\]/[[r2_buckets]]/' wrangler.toml
        sed -i.bak 's/# binding = "BACKUP_BUCKET"/binding = "BACKUP_BUCKET"/' wrangler.toml
        sed -i.bak 's/# bucket_name = "cozy-soccer-backups"/bucket_name = "cozy-soccer-backups"/' wrangler.toml
        rm wrangler.toml.bak 2>/dev/null
        
        echo "✅ wrangler.toml обновлен"
    else
        echo ""
        echo "⏭️  Пропускаю R2 (можно настроить позже)"
    fi
else
    echo ""
    echo "⏭️  R2 можно активировать позже"
    echo "   Запустите: npm run backup:setup"
fi

# Деплой
echo ""
echo "🚀 Деплой обновленного worker..."
echo ""

npm run build && npm run deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║         ✅ Настройка завершена!           ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""
    echo "📊 Статус:"
    echo "  ✅ Автобекапы: Каждый день в 03:00 UTC"
    echo "  ✅ Telegram: Настроен (ID: $CHAT_ID)"
    if [ "$r2_enabled" = "y" ]; then
        echo "  ✅ R2: Настроен (bucket: cozy-soccer-backups)"
    else
        echo "  ⏳ R2: Не настроен (опционально)"
    fi
    echo ""
    echo "🧪 Проверьте работу:"
    echo "  npm run backup              # Локальный бекап"
    echo "  wrangler tail               # Смотреть логи"
    if [ "$r2_enabled" = "y" ]; then
        echo "  npm run r2:list             # Список buckets"
    fi
    echo ""
    echo "📚 Документация: NEXT_STEPS.md"
    echo ""
else
    echo ""
    echo "❌ Ошибка деплоя"
    echo "   Попробуйте вручную: npm run build && npm run deploy"
fi

