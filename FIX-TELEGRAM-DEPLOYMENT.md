# 🔧 Исправление работы в Telegram и других браузерах

## ✅ Уже исправлено в коде:
- Убрал `credentials: 'include'` из API клиента (блокировалось в Safari/Telegram WebView)
- Добавил типы Vite в TypeScript конфиг
- Создал правильный `_headers` файл с CSP для Telegram

## 🚀 Что нужно сделать вручную:

### 1. Настройка Cloudflare Pages (Frontend)

Идите в [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/pages) → ваш проект → Settings → Environment variables:

**Добавить переменную:**
- **Variable name**: `VITE_API_BASE`
- **Value**: `https://cozy-soccer-champ.cozzy-soccer.workers.dev`
- **Environment**: Production

### 2. Настройка Cloudflare Workers (Backend)

Идите в [Cloudflare Dashboard → Workers](https://dash.cloudflare.com/workers) → ваш worker → Settings → Variables:

**Добавить/обновить переменную:**
- **Variable name**: `CORS_ORIGIN`  
- **Value**: `https://cozy-soccer-champ.pages.dev` (замените на ваш реальный Pages URL)
- **Type**: Environment variable

**Проверить наличие секретов:**
- `TELEGRAM_BOT_TOKEN` ✓
- `SESSION_SECRET` ✓
- `FOOTBALL_API_TOKEN` ✓
- `TG_INIT_BYPASS` (для тестирования, можно поставить "1")

### 3. Редеплой

После добавления переменных:

```bash
# Редеплой Pages (автоматически при пуше)
git add .
git commit -m "🔧 Fix Telegram WebApp and cross-browser issues"
git push origin main

# Или вручную: Pages → ваш проект → "Retry deployment"
```

### 4. Проверка

После деплоя откройте:
- В Chrome: `https://cozy-soccer-champ.pages.dev`
- В Safari/Firefox: должно работать без CORS ошибок  
- В Telegram WebApp: должно корректно встраиваться

### 5. Отладка (если всё ещё не работает)

**В браузере (F12 → Network):**
- Проверьте, что API запросы идут на `https://cozy-soccer-champ.cozzy-soccer.workers.dev`
- CORS headers должны включать: `Access-Control-Allow-Origin: https://cozy-soccer-champ.pages.dev`
- OPTIONS preflight должен возвращать 200

**В консоли:**
- Не должно быть CORS ошибок
- `WebApp.initData` должен быть доступен в Telegram

## 🎯 Суть проблемы была:

1. **CORS с credentials** - Safari/Telegram WebView блокируют third-party cookies
2. **Неправильные origin** - Workers не знал про Pages домен
3. **Отсутствие CSP frame-ancestors** - Telegram не мог встроить страницу
4. **Неправильный API_BASE** - фронт стучался не туда

Теперь всё должно работать! 🚀
