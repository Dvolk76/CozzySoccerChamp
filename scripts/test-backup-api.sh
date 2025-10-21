#!/bin/bash

# Тестовый скрипт для проверки API бекапа
# Требует авторизации администратора через Telegram

echo ""
echo "🧪 Тестирование API бекапа..."
echo ""
echo "⚠️  Для этого теста нужна авторизация администратора"
echo ""
echo "📋 Инструкция:"
echo ""
echo "1. Откройте Telegram Web или приложение"
echo "2. Откройте вашего бота"
echo "3. Откройте DevTools (F12)"
echo "4. В Console выполните:"
echo "   window.Telegram.WebApp.initData"
echo "5. Скопируйте результат"
echo ""
read -p "Введите initData (или 'skip' чтобы пропустить): " INIT_DATA

if [ "$INIT_DATA" = "skip" ]; then
    echo ""
    echo "⏭️  Тест пропущен"
    echo ""
    echo "💡 Автоматический бекап запустится завтра в 03:00 UTC"
    echo "   Проверьте логи: wrangler tail"
    exit 0
fi

echo ""
echo "🔄 Создаю тестовый бекап..."
echo ""

RESPONSE=$(curl -s -X POST \
  "https://cozy-soccer-champ.cozzy-soccer.workers.dev/api/backup/create" \
  -H "X-Telegram-Init-Data: $INIT_DATA" \
  -H "Content-Type: application/json")

echo "$RESPONSE" | jq .

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo ""
    echo "✅ Тестовый бекап создан успешно!"
    echo ""
    echo "📊 Проверьте список бекапов:"
    echo "   curl -s \"https://cozy-soccer-champ.cozzy-soccer.workers.dev/api/backup/list\" \\"
    echo "     -H \"X-Telegram-Init-Data: $INIT_DATA\" | jq ."
else
    echo ""
    echo "❌ Ошибка при создании бекапа"
    echo ""
    echo "💡 Проверьте:"
    echo "   - Права администратора"
    echo "   - Правильность initData"
    echo "   - Логи: wrangler tail"
fi

echo ""

