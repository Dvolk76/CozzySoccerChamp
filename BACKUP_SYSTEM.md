# 🗄️ Система автоматического бекапа базы данных

Комплексное решение для автоматического бекапа Cloudflare D1 базы данных с несколькими вариантами хранения и восстановления.

## 📋 Оглавление

1. [Возможности](#возможности)
2. [Автоматический бекап (Cloudflare Cron)](#автоматический-бекап)
3. [Ручной бекап через API](#ручной-бекап-через-api)
4. [Локальный бекап через CLI](#локальный-бекап-через-cli)
5. [Настройка R2 хранилища](#настройка-r2-хранилища)
6. [Восстановление из бекапа](#восстановление-из-бекапа)
7. [Уведомления в Telegram](#уведомления-в-telegram)

---

## 🎯 Возможности

- ✅ **Автоматический бекап** по расписанию (cron)
- ✅ **Ручной бекап** через API или CLI
- ✅ **Хранение в R2** (Cloudflare Object Storage)
- ✅ **Отправка на webhook** (альтернатива R2)
- ✅ **Telegram уведомления** о статусе бекапов
- ✅ **Автоочистка** старых бекапов (хранит последние 30)
- ✅ **Восстановление** из бекапа через API или CLI
- ✅ **Экспорт схемы БД** вместе с данными

---

## 🤖 Автоматический бекап

### Настройка расписания

Бекапы автоматически создаются по расписанию, настроенному в `wrangler.toml`:

```toml
[triggers]
crons = ["0 3 * * *"]  # Каждый день в 03:00 UTC
```

**Примеры расписаний:**
- `"0 3 * * *"` - каждый день в 03:00 UTC
- `"0 */6 * * *"` - каждые 6 часов
- `"0 0 * * 0"` - каждое воскресенье в полночь
- `"0 0 1 * *"` - первого числа каждого месяца

### Как это работает

1. Cloudflare Workers выполняет scheduled event по расписанию
2. Выполняется функция `handleScheduledBackup` из `src/cron/backup-job.ts`
3. Экспортируются все данные из таблиц: User, Match, Prediction, PredictionHistory, Score
4. Данные сохраняются в R2 или отправляются на webhook
5. Автоматически удаляются старые бекапы (оставляет последние 30)
6. Отправляется уведомление в Telegram (если настроено)

---

## 🔧 Ручной бекап через API

### Создание бекапа

**Endpoint:** `POST /api/backup/create`  
**Требует:** Права администратора

```bash
curl -X POST https://your-worker.workers.dev/api/backup/create \
  -H "X-Telegram-Init-Data: <telegram-init-data>"
```

**Ответ:**
```json
{
  "success": true,
  "message": "Backup created successfully",
  "timestamp": "2025-10-06T12:00:00.000Z",
  "tables": ["User", "Match", "Prediction", "PredictionHistory", "Score"],
  "size": 15420,
  "location": "r2://backup-2025-10-06T12-00-00-000Z.json"
}
```

### Список бекапов

**Endpoint:** `GET /api/backup/list`  
**Требует:** Права администратора

```bash
curl https://your-worker.workers.dev/api/backup/list \
  -H "X-Telegram-Init-Data: <telegram-init-data>"
```

**Ответ:**
```json
{
  "success": true,
  "backups": [
    {
      "key": "backup-2025-10-06T12-00-00-000Z.json",
      "size": 15420,
      "uploaded": "2025-10-06T12:00:00.000Z",
      "metadata": {
        "timestamp": "2025-10-06T12:00:00.000Z",
        "tables": "User,Match,Prediction,PredictionHistory,Score",
        "size": "15420"
      }
    }
  ],
  "count": 1
}
```

### Восстановление из бекапа

**Endpoint:** `POST /api/backup/restore`  
**Требует:** Права администратора

```bash
curl -X POST https://your-worker.workers.dev/api/backup/restore \
  -H "X-Telegram-Init-Data: <telegram-init-data>" \
  -H "Content-Type: application/json" \
  -d '{"backupKey": "backup-2025-10-06T12-00-00-000Z.json"}'
```

**Ответ:**
```json
{
  "success": true,
  "message": "Database restored successfully",
  "tablesRestored": ["User", "Match", "Prediction", "PredictionHistory", "Score"]
}
```

---

## 💻 Локальный бекап через CLI

### Создание бекапа

```bash
# Бекап в файл с автоматическим названием
node scripts/manual-backup.mjs

# Бекап в указанный файл
node scripts/manual-backup.mjs --output my-backup.json
```

**Вывод:**
```
🔄 Creating database backup...
📦 Database: cozy-soccer-champ-db
📁 Output: backup-2025-10-06T12-00-00-000Z.json
📊 Exporting User...
   ✓ 25 rows
📊 Exporting Match...
   ✓ 125 rows
...
✅ Backup completed successfully!
📁 File: /path/to/backup-2025-10-06T12-00-00-000Z.json
💾 Size: 15.08 KB
```

### Восстановление из бекапа

```bash
# С подтверждением через консоль
node scripts/restore-backup.mjs --input backup.json

# Автоматическое подтверждение
node scripts/restore-backup.mjs --input backup.json --confirm
```

⚠️ **Внимание:** Восстановление ЗАМЕНЯЕТ все данные в базе!

---

## ☁️ Настройка R2 хранилища

### 1. Создание R2 bucket

```bash
wrangler r2 bucket create cozy-soccer-backups
```

### 2. Настройка в wrangler.toml

Раскомментируйте секцию R2 в `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "BACKUP_BUCKET"
bucket_name = "cozy-soccer-backups"
```

### 3. Deploy

```bash
npm run deploy
```

### Альтернатива: Webhook

Если вы не хотите использовать R2, можно настроить webhook для отправки бекапов:

```bash
wrangler secret put BACKUP_WEBHOOK_URL
# Введите URL вашего webhook (например, на ваш сервер или Telegram Bot API)
```

---

## 🔄 Восстановление из бекапа

### Через API (с R2)

1. Получите список бекапов:
   ```bash
   curl https://your-worker.workers.dev/api/backup/list \
     -H "X-Telegram-Init-Data: <telegram-init-data>"
   ```

2. Выберите нужный бекап и восстановите:
   ```bash
   curl -X POST https://your-worker.workers.dev/api/backup/restore \
     -H "X-Telegram-Init-Data: <telegram-init-data>" \
     -H "Content-Type: application/json" \
     -d '{"backupKey": "backup-2025-10-06T12-00-00-000Z.json"}'
   ```

### Через CLI (локальный файл)

```bash
node scripts/restore-backup.mjs --input backup-2025-10-06T12-00-00-000Z.json
```

Скрипт запросит подтверждение:
```
⚠️  This will REPLACE all data in the database. Continue? (yes/no):
```

Введите `yes` для продолжения.

---

## 📱 Уведомления в Telegram

### Настройка

1. **Получите Chat ID администратора:**
   - Отправьте любое сообщение вашему боту
   - Используйте API: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Найдите `chat.id` в ответе

2. **Установите секрет:**
   ```bash
   wrangler secret put TELEGRAM_ADMIN_CHAT_ID
   # Введите chat ID (число, например: 123456789)
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

### Примеры уведомлений

**Успешный бекап:**
```
✅ Database Backup Successful

📅 Time: 2025-10-06T03:00:00.000Z
📊 Tables: User, Match, Prediction, PredictionHistory, Score
💾 Size: 15.08 KB
📍 Location: r2://backup-2025-10-06T03-00-00-000Z.json
```

**Ошибка бекапа:**
```
❌ Database Backup Failed

⚠️ Error: Connection timeout
📅 Time: 2025-10-06T03:00:00.000Z
```

---

## 🛠️ Структура файлов

```
/Users/dmitryvolkov/CozzySoccerChamp/
├── src/
│   ├── services/
│   │   └── backup.ts                  # Основной сервис бекапа
│   ├── routes/
│   │   └── worker-adapters.ts         # API обработчики (backupHandler)
│   ├── cron/
│   │   └── backup-job.ts              # Cron job для автоматического бекапа
│   └── worker.ts                      # Главный worker (+ scheduled handler)
├── scripts/
│   ├── manual-backup.mjs              # CLI скрипт для бекапа
│   └── restore-backup.mjs             # CLI скрипт для восстановления
├── wrangler.toml                      # Конфигурация (cron, R2)
└── BACKUP_SYSTEM.md                   # Эта документация
```

---

## 🔐 Безопасность

1. **Доступ к API:** Только для администраторов (проверка `user.role === 'ADMIN'`)
2. **R2 Bucket:** Приватный, доступен только вашему Worker
3. **Secrets:** Храните токены и chat ID в Cloudflare Secrets (не в коде!)
4. **Восстановление:** Требует явного подтверждения при использовании CLI

---

## 📊 Мониторинг

### Логи в Cloudflare Dashboard

1. Откройте [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Workers & Pages → Ваш worker → Logs
3. Фильтруйте по "backup" или "scheduled"

### Локальные логи (dev режим)

```bash
npm run dev:worker
# Логи будут отображаться в консоли
```

---

## 🚀 Quick Start

### Минимальная настройка (без R2)

1. **Deploy worker с cron:**
   ```bash
   npm run deploy
   ```

2. **Проверьте scheduled events:**
   ```bash
   wrangler tail
   ```

Бекапы будут выполняться, но данные будут только логироваться (без сохранения).

### Полная настройка (с R2 и Telegram)

1. **Создайте R2 bucket:**
   ```bash
   wrangler r2 bucket create cozy-soccer-backups
   ```

2. **Раскомментируйте R2 в wrangler.toml:**
   ```toml
   [[r2_buckets]]
   binding = "BACKUP_BUCKET"
   bucket_name = "cozy-soccer-backups"
   ```

3. **Настройте Telegram уведомления:**
   ```bash
   wrangler secret put TELEGRAM_ADMIN_CHAT_ID
   ```

4. **Deploy:**
   ```bash
   npm run deploy
   ```

5. **Протестируйте ручной бекап:**
   ```bash
   curl -X POST https://your-worker.workers.dev/api/backup/create \
     -H "X-Telegram-Init-Data: <telegram-init-data>"
   ```

---

## 🐛 Troubleshooting

### Cron не запускается

- **Проверьте логи:** `wrangler tail`
- **Проверьте формат cron:** [crontab.guru](https://crontab.guru)
- **Убедитесь, что worker задеплоен:** `npm run deploy`

### R2 bucket не найден

```bash
# Проверьте список buckets
wrangler r2 bucket list

# Убедитесь, что bucket_name в wrangler.toml совпадает с реальным
```

### Telegram уведомления не приходят

```bash
# Проверьте, что секрет установлен
wrangler secret list

# Проверьте chat ID (должно быть число)
# Убедитесь, что бот может писать в этот чат
```

### Восстановление не работает

- **Убедитесь, что формат бекапа правильный** (JSON с полями `timestamp`, `tables`, `schema`)
- **Проверьте права администратора** при восстановлении через API
- **Используйте `--confirm` флаг** при восстановлении через CLI для автоматического подтверждения

---

## 📚 Дополнительные ресурсы

- [Cloudflare Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

---

## 💡 Рекомендации

1. **Храните бекапы в нескольких местах:**
   - R2 bucket (основное хранилище)
   - Локальные файлы (периодически делайте через CLI)
   - Внешний сервер (через webhook)

2. **Тестируйте восстановление:**
   - Регулярно проверяйте, что бекапы можно восстановить
   - Используйте тестовую базу данных для проверки

3. **Мониторьте размер:**
   - Следите за размером бекапов
   - Настройте автоочистку старых бекапов (по умолчанию 30 дней)

4. **Уведомления:**
   - Настройте Telegram уведомления для мгновенного оповещения об ошибках
   - Проверяйте логи в Cloudflare Dashboard еженедельно

---

**Создано:** 6 октября 2025  
**Автор:** AI Assistant  
**Версия:** 1.0

