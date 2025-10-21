# 🚀 Быстрый старт: Автоматический бекап БД

## 📝 Минимальная настройка (5 минут)

### 1. Включите автоматический бекап

Уже настроено! В `wrangler.toml` включен cron:
```toml
[triggers]
crons = ["0 3 * * *"]  # Каждый день в 03:00 UTC
```

### 2. Deploy

```bash
npm run build
npm run deploy
```

✅ **Готово!** Бекапы будут создаваться автоматически каждый день.

> ⚠️ **Внимание:** Без R2 бекапы только логируются, не сохраняются. Для сохранения настройте R2 (см. ниже).

---

## ☁️ Полная настройка с R2 (10 минут)

### 1. Создайте R2 bucket

```bash
npm run r2:create
```

### 2. Подключите R2 в wrangler.toml

Раскомментируйте:
```toml
[[r2_buckets]]
binding = "BACKUP_BUCKET"
bucket_name = "cozy-soccer-backups"
```

### 3. (Опционально) Настройте Telegram уведомления

```bash
# Получите chat ID: отправьте /start боту, затем:
# https://api.telegram.org/bot<BOT_TOKEN>/getUpdates

wrangler secret put TELEGRAM_ADMIN_CHAT_ID
# Введите ваш chat ID (например: 123456789)
```

### 4. Deploy

```bash
npm run build
npm run deploy
```

✅ **Готово!** Бекапы сохраняются в R2 + Telegram уведомления.

---

## 💻 Использование

### Ручной бекап (локально)

```bash
npm run backup
# Создаст файл: backup-YYYY-MM-DDTHH-mm-ss-sssZ.json
```

### Восстановление из локального файла

```bash
npm run backup:restore -- --input backup.json
```

### Ручной бекап через API

```bash
curl -X POST https://your-worker.workers.dev/api/backup/create \
  -H "X-Telegram-Init-Data: <telegram-init-data>"
```

### Список бекапов в R2

```bash
curl https://your-worker.workers.dev/api/backup/list \
  -H "X-Telegram-Init-Data: <telegram-init-data>"
```

---

## 📊 Проверка работы

### 1. Проверьте логи cron

```bash
wrangler tail
# Ждите 03:00 UTC или измените cron для тестирования
```

### 2. Проверьте R2 bucket

```bash
npm run r2:list
```

### 3. Создайте тестовый бекап

```bash
npm run backup
```

---

## 🔧 Настройка расписания

Измените `wrangler.toml`:

```toml
[triggers]
# Каждые 6 часов
crons = ["0 */6 * * *"]

# Каждое воскресенье
crons = ["0 0 * * 0"]

# Первого числа месяца
crons = ["0 0 1 * *"]
```

**Полная документация:** См. [BACKUP_SYSTEM.md](./BACKUP_SYSTEM.md)

---

## 🆘 Troubleshooting

### Cron не работает
- Убедитесь, что worker задеплоен: `npm run deploy`
- Проверьте логи: `wrangler tail`

### R2 bucket не найден
```bash
npm run r2:list  # Проверьте название bucket
```

### Telegram не присылает уведомления
```bash
wrangler secret list  # Проверьте, что TELEGRAM_ADMIN_CHAT_ID установлен
```

---

**Подробная документация:** [BACKUP_SYSTEM.md](./BACKUP_SYSTEM.md)

