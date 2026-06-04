# TaskHub — Память проекта

## ⚠️ ВАЖНОЕ ПРАВИЛО
Этот файл — живая память проекта. Если в процессе работы принимается решение изменить логику, архитектуру, дизайн или любую другую деталь — **немедленно обнови этот файл**. Не жди отдельной команды. Увидел изменение → обновил CLAUDE.md.

---

## Что это за проект
Внутренняя платформа управления задачами для команды. Полностью заменяет Google Sheets дашборд и Битрикс задачи. Логика похожа на Asana/Битрикс — бэклог, спринты, проекты, аналитика эффективности.

## Стек
- **Frontend**: Next.js 16.2.7 (App Router) + TypeScript
- **UI**: Tailwind CSS (без UI библиотек пока)
- **База данных**: Supabase (PostgreSQL) — проект taskhub-prod
- **Авторизация**: Supabase Auth (email/password)
- **Real-time**: Supabase Realtime (комментарии, статусы)
- **Файлы**: Supabase Storage (вложения к задачам)
- **Деплой**: Vercel — продакшн домен: **https://taskhub-ecru.vercel.app**

## ⚠️ ВАЖНО: Деплой и разработка
- Продакшн сайт: **https://taskhub-ecru.vercel.app**
- Локальная разработка: **http://localhost:3001** → запуск: `npm run dev -- -p 3001`
- `localhost:3000` занят другим проектом пользователя (товарный бизнес) — TaskHub там не тестируется
- Во время разработки проверять на `localhost:3001` — изменения мгновенные, без деплоя
- Финальную версию пушить: `git commit` + `git push` → Vercel задеплоит автоматически

## Supabase
- Project ID: zsmhyuvxldwedshjmvjg
- URL: https://zsmhyuvxldwedshjmvjg.supabase.co
- Переменные в .env.local:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY

## Важно про Next.js 16
- middleware.ts переименован в proxy.ts (экспортирует функцию proxy, не middleware/default)
- Используй App Router везде
- Server Components по умолчанию, 'use client' только где нужна интерактивность

## Дизайн
Тёмная тема. CSS переменные:
```
--bg: #0F1117         /* фон страницы */
--surface: #181C27    /* карточки, панели */
--surface2: #1F2436   /* вложенные элементы */
--text: #E8EAF0       /* основной текст */
--text2: #8892A4      /* второстепенный текст */
--accent: #4F8EF7     /* акцент, кнопки */
--green: #2DD4A0      /* успех, выполнено */
--red: #F75C6E        /* ошибка, просрочено */
--yellow: #F7C04F     /* предупреждение */
```
Шрифты: Geologica (основной), JetBrains Mono (числа, время, даты)

---

## Роли пользователей
- **admin** — видит всё, управляет всеми, подтверждает регистрации, фиксирует недели за любого
- **owner** проекта — тот кто создал проект, полный контроль над ним
- **member** — участник проекта, создаёт и редактирует задачи
- **viewer** — только просмотр

### Регистрация
1. Сотрудник регистрируется сам (email + пароль + full_name + login)
2. Аккаунт создаётся со статусом `pending`
3. Admin подтверждает → статус меняется на `active`
4. До подтверждения вход заблокирован

---

## База данных — таблицы

### profiles
```
id (UUID, FK auth.users) · full_name · login (unique) · role (admin|employee) · status (active|inactive|pending) · avatar_url · created_at
```

### projects
```
id · name · description · color · default_assignee_mode (creator|specific|manual) · default_assignee_id · week_cycle_type (mon-sun|custom|manual) · default_deadline · auto_recurring · created_by · created_at
```

### project_members
```
id · project_id · user_id · role (owner|member|viewer) · UNIQUE(project_id, user_id)
```
Owner — тот кто создал проект (не admin автоматически).

### sprints
```
id · project_id · name · date_from · date_to · status (active|closed) · created_by · created_at
```
При завершении спринта автоматически создаётся следующий со следующим периодом по умолчанию.

### sprint_columns
```
id · sprint_id · name · color · order_index
```

### tasks
```
id · project_id · title · description · type (task|epic) · status (backlog|sprint|done|deleted) · assignee_id · creator_id · deadline · time_estimate (минуты) · parent_task_id · sprint_id · column_id · column_order · backlog_order · is_recurring · recurring_config (jsonb) · tags · closed_at · created_at · updated_at
```

### comments
```
id · task_id · author_id · text · attachments (jsonb) · created_at
```

### task_history
```
id · task_id · user_id · action · old_value · new_value · created_at
```

### access_settings
```
id · user_id · visible_user_ids (uuid[])
```

### notifications
```
id · user_id · type (assigned|commented|sprint_fixed|mentioned) · task_id · is_read · created_at
```

---

## Структура проекта
```
app/
  (auth)/
    login/page.tsx
    register/page.tsx
    layout.tsx
  (dashboard)/
    layout.tsx          ← sidebar + header
    dashboard/page.tsx  ← главная с аналитикой
    projects/page.tsx
    projects/[id]/
      backlog/page.tsx
      sprint/page.tsx
      settings/page.tsx
    my-tasks/page.tsx
    admin/page.tsx      ← только для admin
lib/
  supabase/
    client.ts           ← createBrowserClient
    server.ts           ← createServerClient (server)
    middleware.ts       ← createServerClient (proxy)
  queries/
    projects.ts
    tasks.ts
    sprints.ts
    comments.ts
  utils/
    time.ts             ← minutesToDisplay / displayToMinutes
components/
  backlog/
  sprint/
  task/
  modals/
hooks/
types/index.ts
proxy.ts                ← защита роутов (Next.js 16)
```

---

## Ключевые механики

### Время
- Хранится в БД: целые минуты (integer)
- Отображается: "4 ч 30 мин"
- Ввод: два поля — часы и минуты
- Функции: minutesToDisplay() / displayToMinutes() в lib/utils/time.ts

### Бэклог
- Все задачи со статусом backlog
- Эпики вверху с прогресс-баром подзадач
- Drag & drop сортировка (backlog_order)
- Перенос в спринт: кнопка "Взять в спринт" ИЛИ перетаскивание мышкой

### Спринт (канбан)
- Два режима на выбор сотрудника: дни недели (ПН-СБ) или кастомные статусы
- Колонки настраиваемые: название, цвет, порядок
- Шапка колонки: название + кол-во задач + суммарное время
- Drag & drop карточек между колонками

### Фиксация недели
- Доступна ЛЮБОМУ пользователю (не только admin)
- Перед фиксацией — проверка задач без дедлайна и без оценки времени
- После фиксации: добавлять задачи можно, удалять нельзя
- Данные замораживаются для аналитики

### Аналитика эффективности
- История недель: период, задачи, объём, выполнено, удалено, %
- Сводка по сотрудникам (как в старом Google Sheets дашборде)
- Admin видит всех, сотрудник — только себя (или тех к кому есть доступ)

### Назначение задач
- creator_id — постановщик (кто создал)
- assignee_id — исполнитель (кто выполняет)
- Оба видят задачу и комментарии

### Повторяющиеся задачи
- recurring_config: { day_of_week: 5, time_estimate_minutes: 120 }
- При создании спринта: авто-добавление или кнопка "Добавить повторяющиеся"

---

## Текущий прогресс

### ✅ Сделано
- Supabase проект создан (taskhub-prod)
- SQL миграция выполнена — все 10 таблиц созданы
- RLS политики настроены
- Триггеры: updated_at на tasks, автосоздание profile при регистрации
- Next.js 16.2.7 проект создан
- Supabase библиотеки установены (@supabase/supabase-js, @supabase/ssr)
- .env.local заполнен
- lib/supabase/client.ts, server.ts, middleware.ts созданы
- proxy.ts создан (защита роутов)
- Страницы авторизации: login, register, (auth)/layout.tsx
- globals.css обновлён: CSS переменные + шрифты Geologica/JetBrains Mono
- app/layout.tsx: шрифты подключены через next/font/google
- Dashboard layout: sidebar (220px) + main content
- components/sidebar-nav.tsx: навигация, активные ссылки, выход
- app/(dashboard)/dashboard/page.tsx: страница приветствия

### 🔄 В процессе
- Dashboard layout (sidebar + основной контент)

### ⏳ Предстоит
- Страница проектов
- Страница проектов
- Бэклог
- Спринт-доска
- Task Detail drawer
- Комментарии
- Аналитика
- Панель администратора
- Деплой на Vercel

---

## Курсор и интерактивность (обязательно)

- Все кнопки и кликабельные элементы должны показывать `cursor: pointer` при наведении
- Глобальное правило уже в `globals.css`: `button:not(:disabled) { cursor: pointer; }`
- Для кликабельных `div`/`span` добавлять `cursor-pointer` через Tailwind или `style={{ cursor: 'pointer' }}`
- Задизейбленные кнопки (`disabled`) — стандартный курсор (уже обрабатывается через `:not(:disabled)`)

---

## Индикаторы загрузки (обязательно)

При разработке любой новой функции всегда добавлять индикатор загрузки:
- **Навигация** — глобальный оверлей через `NavigationLoader` (уже подключён в dashboard layout)
- **Кнопки действий** — `disabled` + локальный `loading` state со спиннером на кнопке
- **Сохранение + `router.refresh()`** — показывать спиннер до завершения обновления
- **Формы** — кнопка submit блокируется и показывает состояние загрузки
- **Модалки/дравер** — спиннер внутри при загрузке данных
- **Кнопка "Выйти"** — индикатор на кнопке

---

## Оптимистичные обновления (обязательно)

Для любого переключателя/дропдауна где пользователь меняет значение (роль, статус, приоритет и т.д.) — **всегда делать оптимистичное обновление**:

```tsx
const [optimisticValue, setOptimisticValue] = useState(initialValue)

async function handleChange(next: string) {
  setOptimisticValue(next)   // мгновенно меняем UI
  await serverAction(next)   // сервер обновляется фоном
  router.refresh()           // синхронизируем с сервером
}
```

- UI меняется **мгновенно** — пользователь не ждёт сервер
- Если сервер упал — добавить rollback (вернуть предыдущее значение)
- Применять к: смена роли, статуса, назначения, приоритета, любых toggle

---

## Выравнивание колонок в списках (обязательно)

Когда в списке строк нужно чтобы элементы стояли "в одном столбце":
- **НЕ делать** элементы шире через `minWidth` — фон бейджа растягивается и выглядит странно
- **Делать** фиксированный wrapper-div вокруг каждого элемента:
  ```tsx
  <div style={{ width: 100 }}><Badge /></div>
  <div style={{ width: 108 }}><Badge /></div>
  ```
- **Все строки должны иметь одинаковую структуру** — если в одних строках есть опциональный элемент (напр. метка "вы"), добавлять его во все строки с фиксированной шириной, просто пустым:
  ```tsx
  <span style={{ width: 28 }}>{isSelf ? 'вы' : ''}</span>
  ```
  Иначе строки с меткой будут шире → колонки сместятся.

---

## Соглашения по коду
- Все компоненты на TypeScript
- 'use client' только где нужна интерактивность (формы, drag&drop, состояние)
- Server Components для страниц где можно
- Запросы к БД через lib/queries/ — не писать SQL прямо в компонентах
- Время всегда в минутах в БД, конвертировать через lib/utils/time.ts
- Цвета только через CSS переменные (--accent, --bg и т.д.)
