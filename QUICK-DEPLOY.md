# 🚀 Быстрый деплой на Cloudflare

## ⚡ За 5 минут

```bash
# 1. Войти в Cloudflare  
npx wrangler login

# 2. Установить зависимости
npm ci
cd client && npm ci && cd ..

# 3. Запустить автоматический деплой
./deploy.sh
```

## 📋 Что происходит при деплое

1. **Создается D1 база данных** (SQLite в облаке)
2. **Применяются миграции** базы данных
3. **Собирается backend** для Cloudflare Workers
4. **Собирается frontend** для Cloudflare Pages
5. **Деплоится backend** на Workers
6. **Выводятся инструкции** для настройки Pages

## 🔑 Секреты (важно!)

После деплоя обязательно добавь секреты:

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN  
npx wrangler secret put FOOTBALL_API_TOKEN
```

## 🌐 Настройка фронтенда

1. Иди на [dash.cloudflare.com](https://dash.cloudflare.com) → Pages
2. Нажми **"Connect to Git"**
3. Выбери свой GitHub репозиторий
4. Настрой:
   - **Build command**: `cd client && npm run build`
   - **Build output**: `client/dist`

## 🔄 Обновление API URL

После деплоя обнови `client/src/api.ts`:

```typescript
const API_BASE_URL = 'https://твой-воркер.workers.dev';
```

## ✅ Готово!

Твое приложение будет доступно по адресам:
- **Frontend**: `https://твой-проект.pages.dev`
- **Backend**: `https://твой-воркер.workers.dev`

---

**💡 Нужна помощь?** Смотри подробную документацию:
- `DEPLOYMENT.md` - полное руководство
- `README-CLOUDFLARE.md` - детальная инструкция
- `scripts/` - вспомогательные скрипты
