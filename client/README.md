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

```bash
npm run build
```

Файлы появятся в `dist/` — их можно разместить на статическом хостинге.

## Особенности

- Использует @twa-dev/sdk для интеграции с Telegram
- Адаптивный дизайн под мобильные устройства
- Темизация под цвета Telegram
- TypeScript + React
