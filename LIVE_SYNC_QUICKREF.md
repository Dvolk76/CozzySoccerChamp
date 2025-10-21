# ⚡ Live Score Sync - Quick Reference

## 🔍 Проверить статус

```bash
# Логи в реальном времени
npx wrangler tail --format pretty

# Список деплоев
npx wrangler deployments list

# Проверить cron triggers
# → Cloudflare Dashboard → Workers → Triggers
```

## 🔄 Изменить частоту

```bash
# 1. Редактировать wrangler.toml
nano wrangler.toml
# Изменить: crons = ["0 3 * * *", "*/5 * * * *"]  # каждые 5 минут

# 2. Пересобрать и задеплоить
npm run build && npx wrangler deploy
```

## 🐛 Debug

```bash
# API вручную
curl -H "X-Auth-Token: YOUR_TOKEN" \
  https://api.football-data.org/v4/competitions/CL/matches?season=2025

# Проверить секреты
npx wrangler secret list

# Триггернуть cron вручную (локально)
npx wrangler dev
# В другом терминале:
curl "http://localhost:8787/__scheduled?cron=*/3+*+*+*+*"
```

## 📊 Мониторинг

```bash
# Разовая проверка
node scripts/monitor-live-matches.mjs

# Постоянный мониторинг
node scripts/monitor-live-matches.mjs --watch
```

## ⚙️ Частые команды

```bash
# Деплой
npm run build && npx wrangler deploy

# Логи
npx wrangler tail

# Секреты
npx wrangler secret put FOOTBALL_API_TOKEN
npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID

# Тест локально
npx wrangler dev
```

## 📂 Файлы

```
src/cron/live-sync-job.ts    - Live sync logic
src/worker.ts                 - Cron handler
wrangler.toml                 - Cron schedule
client/src/components/MatchCard.tsx - Frontend display
```

## 🕐 Cron форматы

```
*/1 * * * *   - каждую минуту
*/3 * * * *   - каждые 3 минуты (рекомендуется)
*/5 * * * *   - каждые 5 минут
0 * * * *     - каждый час
0 19-23 * * 2,3 - вт/ср 19:00-23:00 UTC
```

## 🚨 Если что-то не так

1. **Логи:** `npx wrangler tail`
2. **Секреты:** `npx wrangler secret list`
3. **Деплой:** `npx wrangler deployments list`
4. **API:** Проверить лимиты на football-data.org

## ✅ Status

- [x] Cron job создан
- [x] Задеплоен на production
- [x] Каждые 3 минуты
- [x] + Background sync при запросах

