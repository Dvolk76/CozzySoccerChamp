# 📜 Фича: История изменений прогнозов

## 🎯 Описание

Добавлена возможность просмотра истории изменений прогнозов пользователей. При клике на прогноз любого игрока в разделе "Ставки игроков" открывается модальное окно с полной историей всех изменений.

## 😈 Мотивация

> "что бы было обиднее после смены результата на неверный" © 

Теперь можно увидеть:
- Сколько раз пользователь передумывал
- Какие прогнозы были до финального
- Когда были сделаны изменения

## 🔧 Что было сделано

### Backend (API)

**Новый endpoint:** `GET /api/predictions/:userId/:matchId/history`

**Расположение:** `src/routes/worker-adapters.ts` (строки 155-240)

**Возвращает:**
```typescript
{
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  match: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    kickoffAt: string;
  };
  history: Array<{
    predHome: number;
    predAway: number;
    createdAt: string;
  }>;
  current: {
    predHome: number;
    predAway: number;
    createdAt: string;
  } | null;
  totalChanges: number;
}
```

**Логика:**
- Достаёт все записи из таблицы `PredictionHistory`
- Добавляет текущий прогноз из таблицы `Prediction`
- Сортирует по времени создания
- Возвращает полную хронологию

### Frontend

#### 1. Типы (`client/src/types.ts`)

Добавлены новые интерфейсы:
- `PredictionHistoryEntry` - одна запись в истории
- `PredictionHistoryResponse` - ответ API

#### 2. API метод (`client/src/api.ts`)

```typescript
async getPredictionHistory(userId: string, matchId: string)
```

#### 3. Модальное окно (`client/src/components/PredictionHistoryModal.tsx`)

**Новый компонент с:**
- Красивым градиентным дизайном
- Временной шкалой изменений
- Анимациями
- Статистикой (количество изменений, версий)
- Эмодзи-реакциями на количество изменений:
  - 1 изменение: "🤔 Передумал раз..."
  - 2 изменения: "😅 Передумал пару раз"
  - 3+ изменений: "😱 Передумывал много раз!"

#### 4. Обновление MatchCard (`client/src/components/MatchCard.tsx`)

**Изменения:**
- Добавлен импорт `PredictionHistoryModal`
- Добавлен state для модального окна
- Добавлены обработчики клика на строки таблицы
- Добавлен `cursor: pointer` и `title` для подсказки
- Модальное окно рендерится при клике

## 📊 Как работает система истории

### Сохранение истории

Каждый раз при **изменении** прогноза (не создании нового):

1. **Перед обновлением** текущий прогноз сохраняется в `PredictionHistory`:

```typescript
// Код из src/routes/worker-adapters.ts:194-208
const existing = await prisma.prediction.findUnique({ 
  where: { userId_matchId: { userId: user.id, matchId } } 
});

if (existing) {
  await prisma.predictionHistory.create({
    data: {
      userId: user.id,
      matchId,
      predHome: existing.predHome,
      predAway: existing.predAway,
    },
  });
}

// Затем обновляем текущий прогноз
await prisma.prediction.upsert(...)
```

2. После этого создаётся/обновляется текущий прогноз
3. История **никогда не удаляется**, даже если удалить сам прогноз

### База данных

**Таблица `PredictionHistory`:**
```sql
CREATE TABLE "PredictionHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "predHome" INTEGER NOT NULL,
    "predAway" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PredictionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id"),
    CONSTRAINT "PredictionHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id")
);
```

**Особенности:**
- Нет уникального ограничения - можно хранить множество записей
- Связана с User и Match через foreign keys
- `createdAt` - время когда был сделан **старый** прогноз (который теперь в истории)

## 🎨 UI/UX

### Взаимодействие:

1. Пользователь открывает матч после начала (когда доступны "Ставки игроков")
2. Нажимает "Ставки игроков ▾"
3. Видит таблицу с прогнозами всех игроков
4. **Кликает на любую строку** с прогнозом
5. Открывается модальное окно с историей изменений

### Визуал модального окна:

```
┌─────────────────────────────────┐
│ 📜 История прогноза          × │  <- Градиентный header
├─────────────────────────────────┤
│  👤 Goofy Goober               │
│     Galatasaray vs Bodø/Glimt   │
├─────────────────────────────────┤
│  Статистика:                    │
│  [1] Изменение  [2] Всего версий│
├─────────────────────────────────┤
│  ⏱️ Временная шкала             │
│                                 │
│  ✓ ✅ Текущий прогноз           │
│     2 : 2                       │
│     21 окт, 19:33               │
│     │                           │
│  1  📝 Предыдущий прогноз       │
│     2 : 1                       │
│     6 окт, 11:28                │
├─────────────────────────────────┤
│  🤔 Передумал раз...            │
└─────────────────────────────────┘
```

## 🚀 Деплой

### Сборка:

```bash
# Backend
npm run build

# Frontend  
cd client && npm run build
```

### Деплой на Cloudflare:

```bash
npm run deploy
```

## 🧪 Тестирование

### Вручную проверить:

1. Создать прогноз на матч
2. Изменить прогноз несколько раз (до начала матча)
3. После начала матча открыть "Ставки игроков"
4. Кликнуть на свой прогноз
5. Убедиться что показывается вся история

### SQL запрос для проверки:

```sql
-- Посмотреть историю для конкретного пользователя и матча
SELECT 
  u.name as user_name,
  m.homeTeam || ' vs ' || m.awayTeam as match,
  ph.predHome,
  ph.predAway,
  ph.createdAt as changed_at
FROM PredictionHistory ph
JOIN User u ON ph.userId = u.id
JOIN Match m ON ph.matchId = m.id
WHERE u.name = 'Goofy Goober'
ORDER BY ph.createdAt DESC;
```

## 📝 Примечания

### Безопасность:
- История доступна **всем** авторизованным пользователям
- Это не приватная информация - прогнозы видны после начала матча
- Подходит для "дружеского троллинга" 😈

### Производительность:
- История загружается только при клике (lazy loading)
- Используется индекс на (userId, matchId)
- Для одного пользователя и матча обычно < 10 записей

### Будущие улучшения:
- [ ] Показывать "дельту" между изменениями (что изменилось)
- [ ] Добавить фильтр "только те кто менял прогноз"
- [ ] Статистика "кто чаще всех меняет прогнозы"
- [ ] Экспорт истории в CSV

## 🎉 Результат

Теперь в приложении есть полная прозрачность изменений прогнозов. Пользователи могут:
- Видеть свою историю решений
- "Троллить" друзей за частые изменения
- Анализировать как менялось мнение перед матчем
- Наслаждаться красивым UI с анимациями

**Статус:** ✅ Готово к продакшену

