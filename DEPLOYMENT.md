# Cloudflare Deployment Guide

## Пререквизиты

1. **Cloudflare аккаунт** с доступом к Workers и Pages
2. **GitHub репозиторий** с кодом проекта
3. **Node.js** версии 20+
4. **Wrangler CLI** (устанавливается автоматически)

## Быстрый деплой

```bash
# Запустить автоматический деплой
./deploy.sh
```

## Пошаговое руководство

### 1. Установка Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Аутентификация

```bash
wrangler login
```

### 3. Установка зависимостей

```bash
# Backend dependencies
npm ci

# Frontend dependencies
cd client && npm ci && cd ..
```

### 4. Создание D1 базы данных

```bash
# Создать базу данных
wrangler d1 create cozy-soccer-champ-db

# Обновить wrangler.toml с полученным database_id
# Запустить миграции
wrangler d1 execute cozy-soccer-champ-db --file=./migrations/0001_initial.sql
```

### 5. Настройка переменных окружения

```bash
# Обязательные секреты
wrangler secret put SESSION_SECRET
wrangler secret put TELEGRAM_BOT_TOKEN  
wrangler secret put FOOTBALL_API_TOKEN

# Опциональные переменные
wrangler secret put TG_INIT_BYPASS  # Для разработки
```

### 6. Сборка и деплой backend

```bash
# Генерация Prisma клиента для D1
npm run prisma:generate:d1

# Сборка
npm run build

# Деплой на Workers
wrangler deploy
```

### 7. Настройка Cloudflare Pages (Frontend)

1. Перейдите в [Cloudflare Dashboard > Pages](https://dash.cloudflare.com/pages)
2. Нажмите "Connect to Git"
3. Выберите ваш GitHub репозиторий
4. Настройте сборку:
   - **Build command**: `cd client && npm run build`
   - **Build output directory**: `client/dist`
   - **Root directory**: `/` (корень репозитория)

### 8. Обновление API URL

После деплоя обновите в `client/src/api.ts`:

```typescript
const API_BASE_URL = 'https://cozy-soccer-champ.<your-subdomain>.workers.dev';
```

## Переменные окружения

### Backend (Cloudflare Workers)

| Переменная | Описание | Тип |
|------------|----------|-----|
| `SESSION_SECRET` | Секрет для сессий | Secret |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота | Secret |
| `FOOTBALL_API_TOKEN` | API токен football-data.org | Secret |
| `CORS_ORIGIN` | Разрешенные домены CORS | Variable |
| `NODE_ENV` | Окружение (production) | Variable |
| `LOG_LEVEL` | Уровень логирования | Variable |
| `TG_INIT_BYPASS` | Обход проверки Telegram (dev only) | Secret |

### Frontend (Cloudflare Pages)

Переменные настраиваются в Pages dashboard или через `client/.env`:

| Переменная | Описание |
|------------|----------|
| `VITE_API_BASE_URL` | URL backend API |

## Команды для разработки

```bash
# Локальная разработка backend
npm run dev

# Локальная разработка Workers
npm run dev:worker

# Локальная разработка frontend
cd client && npm run dev

# Сборка для продакшена
npm run build

# Деплой на Cloudflare
npm run deploy
```

## Мониторинг и логи

```bash
# Просмотр логов Workers
wrangler tail

# Статистика использования
wrangler metrics

# Информация о деплое
wrangler deployments list
```

## База данных

### D1 команды

```bash
# Список баз данных
wrangler d1 list

# Информация о базе
wrangler d1 info cozy-soccer-champ-db

# Выполнение SQL
wrangler d1 execute cozy-soccer-champ-db --command="SELECT * FROM User LIMIT 10"

# Дамп данных
wrangler d1 export cozy-soccer-champ-db --output=backup.sql
```

### Миграции

```bash
# Создание новой миграции
# 1. Обновите prisma/schema-d1.prisma
# 2. Сгенерируйте SQL файл миграции
# 3. Примените миграцию:
wrangler d1 execute cozy-soccer-champ-db --file=./migrations/XXXX_migration_name.sql
```

## Troubleshooting

### Ошибки деплоя

1. **"Database not found"**
   - Проверьте `database_id` в `wrangler.toml`
   - Убедитесь, что база создана: `wrangler d1 list`

2. **"Module not found"**
   - Запустите `npm run build`
   - Проверьте пути в `tsconfig.json`

3. **"CORS errors"**
   - Обновите `CORS_ORIGIN` в переменных Workers
   - Убедитесь, что домен Pages добавлен в CORS

### Полезные ссылки

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)  
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

## Мигрирование с других платформ

### С Vercel/Netlify

1. Экспортируйте данные из существующей базы
2. Настройте D1 базу по инструкции выше
3. Импортируйте данные в D1
4. Обновите DNS записи

### С Heroku

1. Экспортируйте PostgreSQL дамп
2. Конвертируйте данные для SQLite (D1)
3. Следуйте стандартной процедуре деплоя
