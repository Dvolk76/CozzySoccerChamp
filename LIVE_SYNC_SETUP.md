# 🔄 Live Score Auto-Sync Setup

## Описание

Система автоматической синхронизации live счета матчей настроена и работает на двух уровнях:

### 1. 🚀 Background Sync (каждые 60 секунд)
- Работает автоматически при любом API запросе
- Синхронизирует все матчи если прошло >60 секунд с последней синхронизации
- Не требует дополнительной настройки
- Код: `src/worker.ts` (строки 186-229)

### 2. ⏰ Cron Job (каждые 3 минуты)
- Запускается по расписанию независимо от запросов
- Гарантирует обновление даже если нет активности пользователей
- Отправляет уведомления в Telegram о live матчах
- Код: `src/cron/live-sync-job.ts`

## Настройки Cron Jobs

В `wrangler.toml` настроены два cron job:

```toml
[triggers]
crons = [
  "0 3 * * *",      # Daily backup at 03:00 UTC
  "*/3 * * * *"     # Live sync every 3 minutes
]
```

### Изменение частоты синхронизации

Если нужно изменить частоту:

- `*/1 * * * *` - каждую минуту (частое обновление, больше CPU)
- `*/3 * * * *` - каждые 3 минуты (рекомендуется)
- `*/5 * * * *` - каждые 5 минут (экономный режим)
- `*/10 * * * *` - каждые 10 минут

## Как работает синхронизация

1. **API запрос** к football-data.org
   - Получает ВСЕ матчи сезона (включая live)
   - Статусы: `IN_PLAY`, `LIVE`, `PAUSED`, `FINISHED`, `TIMED`
   
2. **Обработка live счета**
   ```typescript
   // Для live матчей берем счет из fullTime
   let scoreHome = m.score?.fullTime?.home ?? null;
   let scoreAway = m.score?.fullTime?.away ?? null;
   
   // Если fullTime нет, используем halfTime для live
   if ((scoreHome === null || scoreAway === null) && 
       (status === 'LIVE' || status === 'IN_PLAY' || status === 'PAUSED')) {
     scoreHome = m.score?.halfTime?.home ?? scoreHome;
     scoreAway = m.score?.halfTime?.away ?? scoreAway;
   }
   ```

3. **Upsert в базу данных**
   - Обновляет существующие матчи
   - Создает новые матчи

4. **Отображение на фронтенде**
   - `MatchCard` автоматически показывает счет для live матчей
   - Анимация при изменении счета
   - Индикатор live статуса

## Деплой

После изменений в коде:

```bash
# 1. Компиляция TypeScript
npm run build

# 2. Деплой на Cloudflare Workers
wrangler deploy

# Для production окружения:
wrangler deploy --env production
```

## Проверка работы

### Локальная разработка

```bash
# Запуск с поддержкой cron
wrangler dev

# В другом терминале - тестирование cron вручную
curl "http://localhost:8787/__scheduled?cron=*/3+*+*+*+*"
```

### Production

1. **Через Cloudflare Dashboard:**
   - Workers & Pages → Ваш worker → Triggers → Cron Triggers
   - Увидите оба cron jobs
   - Можно посмотреть логи выполнения

2. **Через API:**
   ```bash
   # Ручная синхронизация через админку
   curl -X POST https://your-worker.workers.dev/api/admin/sync-matches \
     -H "X-Telegram-Init-Data: YOUR_INIT_DATA"
   ```

3. **Логи:**
   ```bash
   wrangler tail
   # или
   wrangler tail --env production
   ```

## Telegram уведомления

Если настроен `TELEGRAM_ADMIN_CHAT_ID`, вы будете получать уведомления:

### При live матчах:
```
🔄 Live Sync Job

✅ Синхронизировано: 189 матчей
⚽ Live матчей: 7
⏱ Время: 1234ms

⚽ Bayer 04 Leverkusen 0:1 Paris Saint-Germain FC (IN_PLAY)
⚽ Arsenal FC 0:0 Club Atlético de Madrid (IN_PLAY)
...
```

### При ошибках:
```
❌ Live Sync Job Failed

Error: API rate limit exceeded
Duration: 500ms
Time: 2025-10-21T22:00:00.000Z
```

## Мониторинг

### Проверка синхронизации

Создайте простой скрипт для мониторинга:

```javascript
// scripts/monitor-live-matches.mjs
const response = await fetch('https://your-worker.workers.dev/api/matches');
const data = await response.json();

const liveMatches = data.matches.filter(m => 
  m.status === 'IN_PLAY' || m.status === 'LIVE'
);

console.log(`⚽ Live матчей: ${liveMatches.length}`);
liveMatches.forEach(m => {
  console.log(`  ${m.homeTeam} ${m.scoreHome}:${m.scoreAway} ${m.awayTeam}`);
});
```

## Ограничения API

**football-data.org free tier:**
- 10 запросов в минуту
- 30 запросов в час (для некоторых endpoints)

**Рекомендации:**
- Не ставьте частоту выше `*/3 * * * *` (каждые 3 минуты)
- Background sync + cron job в сумме дают хорошее покрытие
- В пиковые часы матчей можно временно увеличить до `*/2 * * * *`

## Отключение синхронизации

Если нужно временно отключить:

1. **Cron job (на production):**
   ```bash
   # Удалите cron из wrangler.toml и сделайте deploy
   # или закомментируйте в worker.ts обработчик
   ```

2. **Background sync:**
   ```typescript
   // В src/worker.ts закомментируйте строки 186-229
   // или увеличьте интервал: timeSinceLastSync > 3600000 (1 час)
   ```

## Troubleshooting

### Cron не запускается

1. Проверьте формат в `wrangler.toml`:
   ```toml
   crons = ["*/3 * * * *"]  # Правильно
   # НЕ:
   crons = "*/3 * * * *"    # Неправильно - должен быть массив
   ```

2. Проверьте деплой:
   ```bash
   wrangler deployments list
   ```

### Счет не обновляется

1. Проверьте логи:
   ```bash
   wrangler tail --format pretty
   ```

2. Проверьте API токен:
   ```bash
   wrangler secret list
   # Должен быть FOOTBALL_API_TOKEN
   ```

3. Тест API вручную:
   ```bash
   curl -H "X-Auth-Token: YOUR_TOKEN" \
     https://api.football-data.org/v4/competitions/CL/matches?season=2025
   ```

### Превышен лимит API

Если видите ошибку "429 Too Many Requests":

1. Увеличьте интервал cron до `*/5 * * * *`
2. Или отключите background sync
3. Проверьте другие источники запросов к API

## Дополнительные возможности

### Синхронизация только во время игр

Можно оптимизировать, синхронизируя только в игровые часы:

```typescript
// В live-sync-job.ts добавьте проверку времени
const hour = new Date().getUTCHours();

// Матчи ЛЧ обычно 17:45 и 20:00 UTC
const isMatchTime = (hour >= 17 && hour <= 23);

if (!isMatchTime) {
  logger.info('[LiveSync] Skipping - not match time');
  return;
}
```

### Webhook вместо cron

Можно настроить webhook от внешнего сервиса для более гибкого управления.

## Support

Если возникли вопросы или проблемы:
1. Проверьте логи: `wrangler tail`
2. Проверьте статус worker: Cloudflare Dashboard
3. Проверьте API лимиты: https://www.football-data.org/client/home

---

**Status:** ✅ Настроено и готово к работе
**Частота:** Каждые 3 минуты + фоновая синхронизация
**Уведомления:** Telegram (опционально)

