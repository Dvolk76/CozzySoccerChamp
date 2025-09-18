# 🌐 Настройка Cloudflare Pages для фронтенда

## 🚀 Твой backend уже работает!
**Backend URL**: `https://cozy-soccer-champ.cozzy-soccer.workers.dev`

## 📋 Настройка Cloudflare Pages:

### Шаг 1: Загрузи код на GitHub
```bash
# Добавь и зафиксируй изменения
git add .
git commit -m "🚀 Ready for Cloudflare deployment"
git push origin main
```

### Шаг 2: Настрой Cloudflare Pages
1. Иди на [dash.cloudflare.com](https://dash.cloudflare.com)
2. В левой панели выбери **"Pages"**
3. Нажми **"Connect to Git"** или **"Create application"**
4. Выбери **GitHub** и авторизуйся
5. Выбери репозиторий **CozzySoccerChamp**
6. Настрой параметры сборки:

#### 🔧 Настройки сборки:
- **Project name**: `cozy-soccer-champ`
- **Production branch**: `main`
- **Build command**: `cd client && npm ci && npm run build`
- **Build output directory**: `client/dist`
- **Root directory**: `/` (оставить пустым)

#### 🔄 Альтернативная настройка (если не работает):
- **Build command**: `npm ci && cd client && npm ci && npm run build`
- **Build output directory**: `client/dist`

#### 🌍 Переменные окружения:
Добавь в **Environment variables**:
- **Variable name**: `VITE_API_BASE`
- **Value**: `https://cozy-soccer-champ.cozzy-soccer.workers.dev`

### Шаг 3: Деплой
1. Нажми **"Save and Deploy"**
2. Дождись завершения сборки (2-3 минуты)
3. Получи URL вида: `https://cozy-soccer-champ.pages.dev`

## ✅ Готово!

После деплоя у тебя будет:
- **Frontend**: `https://cozy-soccer-champ.pages.dev`
- **Backend**: `https://cozy-soccer-champ.cozzy-soccer.workers.dev`

## 🔄 Обновление CORS

После получения URL Pages обнови CORS в Workers:
```bash
npx wrangler secret put CORS_ORIGIN --env=""
# Введи: https://cozy-soccer-champ.pages.dev
```

## 🎉 Твое приложение готово!

Теперь можешь:
1. Открыть `https://cozy-soccer-champ.pages.dev`
2. Протестировать все функции
3. Поделиться ссылкой с друзьями

---

## 🆘 Если что-то не работает:

### Проверь логи:
```bash
# Логи Workers
npx wrangler tail --env=""

# Статус Pages
# Смотри в dash.cloudflare.com > Pages
```

### Полезные команды:
```bash
# Пересобрать frontend
cd client && npm run build

# Обновить backend
npx wrangler deploy --env=""

# Проверить секреты
npx wrangler secret list --env=""
```
