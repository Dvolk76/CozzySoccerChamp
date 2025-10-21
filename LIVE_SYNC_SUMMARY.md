# ✅ Live Score Auto-Sync - Настроено и работает!

## 🎯 Что сделано

### 1. Создан Cron Job для автоматической синхронизации
**Файл:** `src/cron/live-sync-job.ts`

- ⏰ Запускается каждые **3 минуты**
- 📊 Синхронизирует все матчи (включая live)
- 📱 Отправляет Telegram уведомления (опционально)
- 🔄 Обрабатывает live счета из API

### 2. Обновлена конфигурация Worker
**Файлы:** `wrangler.toml`, `src/worker.ts`

```toml
[triggers]
crons = [
  "0 3 * * *",      # Daily backup at 03:00 UTC
  "*/3 * * * *"     # Live sync every 3 minutes ← НОВЫЙ
]
```

### 3. Два уровня синхронизации

#### 🚀 Background Sync (каждые 60 секунд)
- Работает при любом API запросе
- Не требует дополнительной настройки
- Код: `src/worker.ts` (строки 186-229)

#### ⏰ Cron Job (каждые 3 минуты)
- Работает независимо от запросов
- Гарантирует обновление даже без активности
- Код: `src/cron/live-sync-job.ts`

## 📊 Как это работает

### API football-data.org возвращает live счет:

```json
{
  "status": "IN_PLAY",
  "score": {
    "fullTime": { "home": 0, "away": 1 },
    "halfTime": { "home": 0, "away": 0 }
  }
}
```

### Обработка в коде:

```typescript
// Для live матчей берем счет из fullTime
let scoreHome = m.score?.fullTime?.home ?? null;
let scoreAway = m.score?.fullTime?.away ?? null;

// Если fullTime нет, используем halfTime
if ((scoreHome === null || scoreAway === null) && 
    (status === 'LIVE' || status === 'IN_PLAY' || status === 'PAUSED')) {
  scoreHome = m.score?.halfTime?.home ?? scoreHome;
  scoreAway = m.score?.halfTime?.away ?? scoreAway;
}
```

### Отображение на фронтенде:

```tsx
// client/src/components/MatchCard.tsx
<div className={`score ${scoreChanged ? `score-changed-${scoreChanged}` : ''}`}>
  {hasScore ? `${match.scoreHome}:${match.scoreAway}` : 'vs'}
</div>
```

- ✅ Автоматически показывает live счет
- 🎨 Анимация при изменении счета
- 🔴 Индикатор live статуса

## 🚀 Деплой выполнен

```bash
✅ Worker deployed: cozy-soccer-champ
✅ URL: https://cozy-soccer-champ.cozzy-soccer.workers.dev
✅ Cron triggers registered:
   - schedule: 0 3 * * * (daily backup)
   - schedule: */3 * * * * (live sync) ← РАБОТАЕТ!
```

## 📱 Telegram уведомления

При настроенном `TELEGRAM_ADMIN_CHAT_ID` вы получите:

### Во время live матчей:
```
🔄 Live Sync Job

✅ Синхронизировано: 189 матчей
⚽ Live матчей: 7
⏱ Время: 1234ms

⚽ Bayer 04 Leverkusen 0:1 Paris Saint-Germain FC (IN_PLAY)
⚽ Arsenal FC 0:0 Club Atlético de Madrid (IN_PLAY)
⚽ PSV 0:0 SSC Napoli (IN_PLAY)
...
```

## 🔍 Мониторинг

### Проверить логи в реальном времени:
```bash
npx wrangler tail --format pretty
```

### Локальный мониторинг (из скрипта):
```bash
# Одноразовая проверка
node scripts/monitor-live-matches.mjs

# Постоянный мониторинг (обновление каждые 30 сек)
node scripts/monitor-live-matches.mjs --watch
```

### Проверить cron triggers в Dashboard:
1. Перейти: https://dash.cloudflare.com
2. Workers & Pages → cozy-soccer-champ
3. Triggers → Cron Triggers
4. Увидите оба расписания

## ⚙️ Настройки

### Изменить частоту синхронизации

В `wrangler.toml`:

```toml
# Частые обновления (каждую минуту)
crons = ["0 3 * * *", "*/1 * * * *"]

# Рекомендуется (каждые 3 минуты)
crons = ["0 3 * * *", "*/3 * * * *"]

# Экономный режим (каждые 5 минут)
crons = ["0 3 * * *", "*/5 * * * *"]

# Только во время матчей (19:00-23:00 UTC по вторникам и средам)
crons = ["0 3 * * *", "0 19-23 * * 2,3"]
```

После изменения:
```bash
npm run build
npx wrangler deploy
```

## ⚡ Производительность

### API Limits (football-data.org free tier):
- ✅ 10 запросов в минуту
- ✅ Cron каждые 3 минуты = 20 запросов/час
- ✅ + Background sync при активности
- ✅ Укладываемся в лимиты!

### Cloudflare Workers:
- ✅ Unlimited requests (free tier: 100,000/day)
- ✅ Cron triggers: Unlimited
- ✅ D1 Database: 5 GB storage

## 🐛 Troubleshooting

### Cron не запускается

1. Проверить деплой:
```bash
npx wrangler deployments list
```

2. Проверить формат в wrangler.toml:
```toml
crons = ["*/3 * * * *"]  # ✅ Правильно - массив
crons = "*/3 * * * *"    # ❌ Неправильно
```

### Счет не обновляется

1. Проверить логи:
```bash
npx wrangler tail
```

2. Проверить секреты:
```bash
npx wrangler secret list
```

Должен быть `FOOTBALL_API_TOKEN`.

3. Проверить API вручную:
```bash
curl -H "X-Auth-Token: YOUR_TOKEN" \
  https://api.football-data.org/v4/competitions/CL/matches?season=2025
```

### 429 Too Many Requests

Если превышен лимит API:
1. Увеличить интервал до `*/5 * * * *`
2. Или отключить background sync

## 📚 Документация

- **Полная документация:** `LIVE_SYNC_SETUP.md`
- **Код cron job:** `src/cron/live-sync-job.ts`
- **Worker config:** `wrangler.toml`
- **Worker handler:** `src/worker.ts`
- **Frontend display:** `client/src/components/MatchCard.tsx`

## 🎉 Готово к использованию!

### Что получилось:
- ✅ Автоматическое обновление live счета каждые 3 минуты
- ✅ Фоновая синхронизация при активности пользователей
- ✅ Отображение live счета на фронтенде с анимацией
- ✅ Telegram уведомления о live матчах
- ✅ Мониторинг и логирование
- ✅ Задеплоено на production

### Следующие шаги:

1. **Проверьте логи:**
   ```bash
   npx wrangler tail --format pretty
   ```

2. **Дождитесь ближайшего матча** (см. график матчей ЛЧ)

3. **Откройте приложение** и наблюдайте live счет в реальном времени! ⚽

## 🔗 Ссылки

- **Worker URL:** https://cozy-soccer-champ.cozzy-soccer.workers.dev
- **Dashboard:** https://dash.cloudflare.com
- **API Docs:** https://www.football-data.org/documentation/api

---

**Status:** ✅ Полностью настроено и задеплоено
**Дата:** 21 октября 2025
**Частота:** Каждые 3 минуты + фоновая синхронизация

