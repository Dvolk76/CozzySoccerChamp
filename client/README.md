# Cozy Soccer Champ - Client

React-клиент для Telegram Mini App.

## Запуск

1. Установи зависимости:
```bash
cd client
npm install
```

2. Скопируй env.example в .env и настрой API_BASE:
```bash
copy env.example .env
```

3. Запусти dev сервер:
```bash
npm run dev
```

4. Открой http://localhost:5173

## Продакшн

### Локальная сборка
```bash
npm run build
```

Файлы появятся в `dist/` — их можно разместить на статическом хостинге.

### Cloudflare Pages (рекомендуется)

1. Настрой переменную окружения:
```bash
VITE_API_BASE=https://your-worker.workers.dev
```

2. Автоматический деплой через GitHub:
   - **Build command**: `cd client && npm run build` 
   - **Build output**: `client/dist`

См. `../QUICK-DEPLOY.md` для быстрого деплоя всего приложения.

## Особенности

- Использует @twa-dev/sdk для интеграции с Telegram
- Адаптивный дизайн под мобильные устройства
- Темизация под цвета Telegram
- TypeScript + React
