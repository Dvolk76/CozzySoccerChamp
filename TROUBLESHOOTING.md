# Руководство по устранению неполадок

## Проблема: Результаты матчей не отображаются

### Диагностика

1. **Проверить логи worker:**
```bash
npx wrangler tail cozy-soccer-champ --format pretty
```

Ищите сообщения:
- `[Worker] Background sync check` - должно появляться при каждом запросе
- `[Worker] Triggering background API sync...` - должно появляться раз в минуту
- `[Worker] Resetting stuck sync flag` - НЕ должно появляться (только если флаг застрял)

2. **Проверить данные в базе:**
```bash
npx wrangler d1 execute cozy-soccer-champ-db --remote \
  --command "SELECT COUNT(*) as finished FROM Match WHERE status='FINISHED'"
```

3. **Проверить API football-data.org:**
```bash
# Получить количество завершенных матчей
curl -H "X-Auth-Token: YOUR_TOKEN" \
  "https://api.football-data.org/v4/competitions/CL/matches?season=2025&status=FINISHED" \
  | jq '.matches | length'
```

### Решение

#### 1. Принудительная синхронизация
Если синхронизация не работает автоматически, запустите:
```bash
node scripts/quick-sync.mjs
```

Это обновит все завершенные матчи напрямую в D1.

#### 2. Сброс кэша
Если данные в базе правильные, но не отображаются на клиенте:
```bash
# Перезапустить worker (автоматически очищает кэш)
npx wrangler deploy
```

#### 3. Проверка секретов
Убедитесь что API токен установлен:
```bash
npx wrangler secret list
# Должен быть FOOTBALL_API_TOKEN или FOOTBALL_DATA_API_TOKEN
```

Если нет, установите:
```bash
npx wrangler secret put FOOTBALL_API_TOKEN
# Введите токен: 96637ff475924456a64fa80adc981cbb
```

## Проблема: Синхронизация зависла

### Симптомы
В логах видно:
```
globalIsApiSyncInProgress: true
shouldTriggerSync: false
timeSinceSyncStarted: 1234567890
```

И синхронизация не запускается.

### Решение
Worker автоматически сбросит флаг через 30 секунд. Если это не помогло:
```bash
# Перезапустить worker
npx wrangler deploy
```

## Проблема: Rate limit от API

### Симптомы
В логах:
```
football-data error 429
```

### Решение
API имеет лимит 10 запросов в минуту. Система автоматически кэширует запросы на 60 секунд. Подождите 1-2 минуты.

## Проблема: Устаревшие данные на клиенте

### Проверка
1. Проверьте данные в базе (см. выше)
2. Проверьте API напрямую (должен возвращать `matches: [...]`)
3. Проверьте клиентский кэш

### Решение
Клиент автоматически обновляется каждые 30 секунд. Если данные все еще устаревшие:
1. Очистите кэш браузера (Cmd+Shift+R)
2. Проверьте что worker возвращает свежие данные
3. Пересоберите и разверните клиент:
```bash
cd client && npm run build && cd ..
npx wrangler pages deploy client/dist --project-name=cozzysoccerchamp --commit-dirty=true
```

## Полезные скрипты

### Проверка API
```bash
node scripts/force-sync-production.mjs
```

### Ручная синхронизация
```bash
node scripts/quick-sync.mjs
```

### Проверка логики синхронизации
```bash
node scripts/test-sync-logic.mjs
```

### Пересчет очков
```bash
node scripts/recalc-scores.mjs
```

## Мониторинг

### Ключевые метрики
1. **Частота синхронизации**: раз в 60 секунд
2. **Время синхронизации**: обычно 2-5 секунд
3. **Rate limit**: 9-10 запросов доступно после синхронизации

### Проверка здоровья системы
```bash
# Health check
curl https://cozy-soccer-champ.cozzy-soccer.workers.dev/health

# Логи в реальном времени
npx wrangler tail cozy-soccer-champ --format pretty

# Статус базы данных
npx wrangler d1 execute cozy-soccer-champ-db --remote \
  --command "SELECT status, COUNT(*) FROM Match GROUP BY status"
```

## Контакты для поддержки

- Worker URL: https://cozy-soccer-champ.cozzy-soccer.workers.dev
- Pages URL: https://cozzysoccerchamp.pages.dev
- API football-data.org: https://www.football-data.org/documentation/api

