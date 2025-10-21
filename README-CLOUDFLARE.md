## Safe schema updates (D1)

This project includes an idempotent step in `deploy.sh` to ensure new columns exist on D1 without breaking existing data:

- `User.championPick` (TEXT, nullable)
- `User.topScorerPick` (TEXT, nullable)
- `Score.bonusPoints` (INTEGER, default 0)

The deploy script probes `PRAGMA table_info('<table>')` and applies `ALTER TABLE` only when a column is missing.

# 🚀 Деплой на Cloudflare

Этот гайд поможет тебе задеплоить Cozy Soccer Champ на платформу Cloudflare.

## 🎯 Что мы деплоим

- **Frontend** (React) → **Cloudflare Pages**
- **Backend** (Node.js/Express) → **Cloudflare Workers**  
- **Database** (PostgreSQL) → **Cloudflare D1** (SQLite)

## ⚡ Быстрый старт

```bash
# 1. Первоначальная настройка Cloudflare
./scripts/setup-cloudflare.sh

# 2. Проверка готовности к деплою
./scripts/pre-deploy-check.sh

# 3. Деплой
./deploy.sh
```

## 📋 Пошаговая инструкция

### Шаг 1: Подготовка

```bash
# Установить зависимости
npm ci
cd client && npm ci && cd ..

# Установить Wrangler CLI (если еще не установлен)
npm install -g wrangler
```

### Шаг 2: Аутентификация

```bash
# Войти в Cloudflare
wrangler login
```

### Шаг 3: Создание D1 базы данных

```bash
# Создать базу данных
wrangler d1 create cozy-soccer-champ-db

# Скопировать database_id из вывода и обновить wrangler.toml
# Например: database_id = "xxxx-xxxx-xxxx-xxxx"
```

### Шаг 4: Настройка секретов

```bash
# Обязательные секреты
wrangler secret put SESSION_SECRET
wrangler secret put TELEGRAM_BOT_TOKEN  
wrangler secret put FOOTBALL_API_TOKEN

# Опционально для разработки
wrangler secret put TG_INIT_BYPASS
```

### Шаг 5: Миграция базы данных

```bash
# Применить миграции
wrangler d1 execute cozy-soccer-champ-db --file=./migrations/0001_initial.sql
```

### Шаг 6: Деплой Backend

```bash
# Генерация Prisma клиента для D1
npm run prisma:generate:d1

# Сборка и деплой
npm run build
wrangler deploy
```

### Шаг 7: Настройка Frontend (Cloudflare Pages)

1. Иди в [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/pages)
2. Нажми **"Connect to Git"**
3. Выбери свой GitHub репозиторий
4. Настрой сборку:
   - **Build command**: `cd client && npm run build`
   - **Build output directory**: `client/dist`
   - **Root directory**: `/`

### Шаг 8: Обновление API URL

После деплоя обнови URL в `client/src/api.ts`:

```typescript
const API_BASE_URL = 'https://cozy-soccer-champ.<твой-поддомен>.workers.dev';
```

Или создай `client/.env`:

```
VITE_API_BASE=https://cozy-soccer-champ.<твой-поддомен>.workers.dev
```

## 🔧 Полезные команды

```bash
# Локальная разработка
npm run dev                    # Backend (Express)
npm run dev:worker            # Workers (локально)
cd client && npm run dev      # Frontend

# Деплой
wrangler deploy               # Backend
# Frontend деплоится автоматически через Pages

# Мониторинг
wrangler tail                 # Логи Workers
wrangler metrics              # Статистика

# База данных
wrangler d1 list              # Список баз
wrangler d1 info DB_NAME      # Информация о базе
wrangler d1 execute DB_NAME --command="SELECT * FROM User LIMIT 10"
```

## 🌍 Переменные окружения

### Backend (Workers)
| Переменная | Тип | Описание |
|------------|-----|----------|
| `SESSION_SECRET` | Secret | Секрет для сессий |
| `TELEGRAM_BOT_TOKEN` | Secret | Токен Telegram бота |
| `FOOTBALL_API_TOKEN` | Secret | Токен football-data.org |
| `TG_INIT_BYPASS` | Secret | Обход проверки (dev only) |
| `CORS_ORIGIN` | Variable | Домены для CORS |
| `NODE_ENV` | Variable | production |
| `LOG_LEVEL` | Variable | info |

### Frontend (Pages)
| Переменная | Описание |
|------------|----------|
| `VITE_API_BASE` | URL backend API |

## 🚨 Troubleshooting

### "Database not found"
```bash
# Проверь database_id в wrangler.toml
wrangler d1 list
```

### "Module not found" 
```bash
# Пересобери проект
npm run build
```

### CORS ошибки
```bash
# Обнови CORS_ORIGIN в Workers
wrangler secret put CORS_ORIGIN
```

### Ошибки сборки
```bash
# Проверь зависимости
./scripts/pre-deploy-check.sh
```

## 📊 Мониторинг

- **Workers**: [dash.cloudflare.com/workers](https://dash.cloudflare.com/workers)
- **Pages**: [dash.cloudflare.com/pages](https://dash.cloudflare.com/pages)
- **D1**: [dash.cloudflare.com/d1](https://dash.cloudflare.com/d1)
- **Логи**: `wrangler tail`

## 💰 Стоимость

Cloudflare предоставляет щедрый бесплатный план:
- **Workers**: 100,000 запросов/день
- **Pages**: Безлимитные запросы
- **D1**: 5 млн запросов/месяц, 5 ГБ хранилища

## 🔄 CI/CD

Для автоматического деплоя настрой GitHub Actions:

1. Добавь секреты в репозиторий:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

2. Используй `.github/workflows/deploy.yml` (уже создан)

## ✅ Готово!

После деплоя твое приложение будет доступно:
- **Frontend**: `https://<project-name>.pages.dev`
- **Backend**: `https://<worker-name>.<subdomain>.workers.dev`

🎉 **Поздравляю! Твое приложение задеплоено на Cloudflare!**
