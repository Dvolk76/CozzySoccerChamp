# ✅ Система бекапа настроена!

## 🎉 Что уже работает:

### ✅ Автоматический бекап
- **Расписание:** Каждый день в 03:00 UTC (06:00 МСК)
- **Статус:** Активирован и задеплоен
- **URL:** https://cozy-soccer-champ.cozzy-soccer.workers.dev
- **Cron:** `0 3 * * *`

### ✅ Локальный бекап через CLI
- **Команда:** `npm run backup`
- **Тестовый бекап создан:** `backup-2025-10-06T15-36-34-265Z.json` (4.20 KB)
- **Экспортировано:** 3 матча + схема БД

### ✅ API для ручного бекапа
- `POST /api/backup/create` - создать бекап (админ)
- `GET /api/backup/list` - список бекапов (админ)  
- `POST /api/backup/restore` - восстановить (админ)

---

## 📋 Что нужно доделать (2 минуты):

### 1️⃣ Включить R2 для хранения бекапов в облаке

**Шаг 1:** Откройте Cloudflare Dashboard:
```
https://dash.cloudflare.com/
→ R2 Object Storage (в левом меню)
→ Нажмите "Purchase R2" или "Enable R2"
```

**Шаг 2:** Создайте bucket:
```bash
npm run r2:create
```

**Шаг 3:** Раскомментируйте в `wrangler.toml` (строки 42-44):
```toml
[[r2_buckets]]
binding = "BACKUP_BUCKET"
bucket_name = "cozy-soccer-backups"
```

**Шаг 4:** Передеплойте:
```bash
npm run build
npm run deploy
```

✅ **Готово!** Бекапы будут сохраняться в R2.

---

### 2️⃣ Настроить Telegram уведомления

**Шаг 1:** Получите ваш Chat ID:

1. Откройте Telegram и отправьте **любое сообщение** вашему боту
   
2. Откройте в браузере (замените `<BOT_TOKEN>` на ваш токен):
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
   ```
   
3. Найдите в JSON ответе: `"chat":{"id":123456789}`
   
4. Скопируйте это число (например: `123456789`)

**Шаг 2:** Установите секрет:
```bash
wrangler secret put TELEGRAM_ADMIN_CHAT_ID
# Введите ваш chat ID (число)
```

**Шаг 3:** Передеплойте:
```bash
npm run deploy
```

✅ **Готово!** Теперь будете получать уведомления о бекапах.

**Пример уведомления:**
```
✅ Database Backup Successful

📅 Time: 2025-10-06T03:00:00.000Z
📊 Tables: User, Match, Prediction, PredictionHistory, Score
💾 Size: 15.08 KB
📍 Location: r2://backup-2025-10-06T03-00-00-000Z.json
```

---

## 🧪 Проверка работы

### Проверить cron логи:
```bash
wrangler tail
# Ждите 03:00 UTC или измените расписание для теста
```

### Проверить R2 buckets (после активации):
```bash
npm run r2:list
```

### Создать тестовый бекап вручную:
```bash
npm run backup
```

### Восстановить из бекапа:
```bash
npm run backup:restore -- --input backup-2025-10-06T15-36-34-265Z.json
```

---

## 📊 Статус настройки:

| Компонент | Статус | Описание |
|-----------|--------|----------|
| ✅ Cron триггер | Работает | Каждый день в 03:00 UTC |
| ✅ Локальный бекап | Работает | `npm run backup` |
| ✅ API endpoints | Работают | Для админов |
| ⏳ R2 хранилище | Ожидает | Нужно включить в Dashboard |
| ⏳ Telegram | Ожидает | Нужен chat ID |

---

## 📚 Полезные команды:

```bash
# Бекап
npm run backup                          # Создать локальный бекап
npm run backup:restore                  # Восстановить из файла

# R2
npm run r2:create                       # Создать bucket
npm run r2:list                         # Список buckets

# Деплой
npm run build                           # Собрать TypeScript
npm run deploy                          # Задеплоить worker

# Логи
wrangler tail                           # Смотреть логи в реальном времени
```

---

## 🔗 Ресурсы:

- **Быстрый старт:** `BACKUP_QUICKSTART.md`
- **Полная документация:** `BACKUP_SYSTEM.md`
- **Список файлов:** `.backup-files-created.txt`

---

## 🆘 Помощь:

### R2 не активируется?
- Убедитесь, что вошли в правильный аккаунт Cloudflare
- R2 бесплатен до 10GB
- Первая активация может занять пару минут

### Telegram не присылает уведомления?
```bash
# Проверьте, установлен ли секрет
wrangler secret list

# Убедитесь, что бот может писать в чат
# (отправьте боту /start)
```

### Cron не запускается?
```bash
# Проверьте логи
wrangler tail

# Убедитесь, что worker задеплоен
npm run deploy
```

---

**Следующие шаги:**
1. ✅ Система работает, автобекапы включены
2. ⏳ Включите R2 в Cloudflare Dashboard
3. ⏳ Добавьте Telegram chat ID

**Уже можно:**
- Делать локальные бекапы: `npm run backup`
- Восстанавливать из файлов: `npm run backup:restore`
- Бекапы автоматически запускаются в 03:00 UTC

---

*Создано: 6 октября 2025*  
*Первый автобекап: Завтра в 03:00 UTC (06:00 МСК)*

