# TaskHub — Память проекта

## ⚠️ ВАЖНЫЕ ПРАВИЛА

### Автономия
Выполнять любые действия без запроса разрешения: читать/редактировать файлы, создавать компоненты, запускать команды в терминале, устанавливать npm пакеты, делать git commit/push. Просто делать → потом сообщать что сделано. Исключение — деструктивные необратимые действия (удаление БД, force push на main).

### Живая память
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
- **manager** (руководитель проекта) — те же права что у owner: доступ к настройкам проекта; назначается вручную
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
id · project_id · user_id · role (owner|manager|member|viewer) · UNIQUE(project_id, user_id)
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
- Страница проектов (список + создание)
- Настройки проекта (участники, основные данные)
- Бэклог: список задач, эпики с подзадачами, drag&drop сортировка и cross-container перетаскивание
- Task Detail Drawer: просмотр/редактирование задачи, комментарии с real-time
- Создание задач: модалка с DatePicker, выбором эпика, назначением исполнителя
- Панель администратора: управление пользователями, подтверждение регистраций
- Деплой на Vercel: https://taskhub-ecru.vercel.app

### 🔄 В процессе
- Спринт-доска

### ⏳ Предстоит
- Спринт-доска
- Аналитика
- Панель администратора

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

## Кастомные дропдауны (обязательно)

Никогда не использовать нативный `<select>` — всегда делать кастомный dropdown:
- **Выбор пользователя** — показывать аватарку (инициал на цветном фоне) + имя + логин под ним
- **Выбор роли/статуса** — цветная точка + label + галочка на выбранном варианте
- **Анимация открытия** — `animation: dropdownIn 0.12s ease-out` (уже в globals.css)
- **Закрытие по клику вне** — `useEffect` с `mousedown` listener + `useRef`
- **Hover эффект** — `rgba(255,255,255,0.05)` фон на строке

Паттерн уже реализован в:
- `components/admin-user-actions.tsx` — дропдаун роли/статуса
- `components/projects/settings/members-section.tsx` — дропдаун пользователя и роли

---

## Кастомные инпуты (обязательно)

**Дата** — никогда `<input type="date">`. Всегда кастомный `DatePicker`:
- Кнопка-триггер с иконкой + форматированная дата
- Выпадающий календарь: сетка 7×N, подсветка сегодня (рамка), выбранного (акцент), nav ← →
- Кнопки "Очистить" и "Сегодня" в футере
- Готовый пример: `components/backlog/create-task-modal.tsx`

**Числа с единицей (часы, минуты и т.п.)** — единица как фиксированный суффикс внутри поля, НЕ placeholder:
```tsx
<div className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
  <input className="w-full bg-transparent outline-none text-sm" placeholder="0" />
  <span className="text-xs shrink-0 select-none" style={{ color: 'var(--text2)' }}>ч</span>
</div>
```
Суффикс всегда виден, не исчезает при вводе.

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
- Применять к: смена роли, статуса, назначения, приоритета, любых toggle, **добавление/удаление элементов из списка**

### Оптимистичное добавление в список

```tsx
const [optimisticList, setOptimisticList] = useState(initialList)

// Синхронизация после router.refresh()
useEffect(() => { setOptimisticList(initialList) }, [initialList])

async function handleAdd(item) {
  setOptimisticList(prev => [...prev, item])  // мгновенно
  try {
    await serverAction(item)
    router.refresh()
  } catch {
    setOptimisticList(prev => prev.filter(i => i.id !== item.id))  // rollback
  }
}

async function handleRemove(id) {
  setOptimisticList(prev => prev.filter(i => i.id !== id))  // мгновенно
  try {
    await serverAction(id)
    router.refresh()
  } catch {
    setOptimisticList(initialList)  // rollback
  }
}
```

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

## Drag & Drop с @dnd-kit (обязательно)

Стек: `@dnd-kit/core` + `@dnd-kit/sortable`. Реализован в `components/backlog/backlog-board.tsx`.

### ⚠️ ГЛАВНОЕ ПРАВИЛО: никогда не вставлять DOM-элементы как индикатор позиции

**Любой DOM-элемент с ненулевым layout-размером вызывает бесконечный цикл** при drag over:

```
applyDragPreview → ре-рендер → DOM меняется (insertElement появляется)
→ @dnd-kit обнаруживает сдвиг через useLayoutEffect → пересчитывает позиции
→ снова onDragOver → другой over.id → applyDragPreview(другое значение)
→ ре-рендер → DOM меняется обратно → @dnd-kit снова пересчитывает → ∞
```

Даже **2px** элемент вызывает цикл — размер не имеет значения.

### Правильный индикатор позиции: `box-shadow`

`box-shadow` не влияет на layout. @dnd-kit не видит изменения. Цикл физически невозможен.

```tsx
// Индикатор "вставить ПЕРЕД элементом i" — синяя линия сверху
boxShadow: '0 -3px 0 0 var(--accent)'

// Индикатор "вставить ПОСЛЕ последнего элемента" — линия снизу
boxShadow: '0 3px 0 0 var(--accent)'

// Применять прямо к wrapper-div задачи или эпика:
<div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
  boxShadow: insertIndicator === 'before' ? '0 -3px 0 0 var(--accent)' : undefined }}>
```

### Как устроен multi-container DnD

```tsx
type DragPreview = { container: string; insertAt: number }
// container = 'root' или epicId

const dragSourceRef = useRef<string>('root')   // куда НАЧАЛИ тащить
const dragCurrentRef = useRef<string>('root')  // где находимся СЕЙЧАС
```

- `handleDragStart` — сохраняет source в ref, сбрасывает preview
- `handleDragOver` — ТОЛЬКО обновляет `dragCurrentRef` и `dragPreview` (никаких `setTasks`!)
- `handleDragEnd` — все мутации состояния только здесь

### Защита от лишних ре-рендеров

```tsx
// Обёртка над setDragPreview — пропускает обновление если значения не изменились
function applyDragPreview(next: DragPreview | null) {
  setDragPreview(prev => {
    if (!prev && !next) return prev
    if (prev && next && prev.container === next.container && prev.insertAt === next.insertAt) return prev
    return next
  })
}
```

### Placeholder ВНУТРИ эпика (safe)

38px `TaskDropPlaceholder` БЕЗОПАСЕН внутри эпика — все подзадачи сдвигаются вместе, их относительный порядок не меняется, @dnd-kit не находит нового ближайшего.

### Правила handleDragOver

```tsx
function handleDragOver({ active, over }) {
  // НЕ вызывать setTasks — это вызывает бесконечный цикл
  // Только: dragCurrentRef.current = ... и applyDragPreview(...)
  
  if (sourceContainer === overContainer) {
    applyDragPreview(null)  // @dnd-kit сам двигает через CSS transforms
  } else {
    // Смена контейнера: показываем preview только через box-shadow (root) или placeholder (epic)
    applyDragPreview({ container: overContainer, insertAt: ... })
  }
}
```

### Сохранение порядка после cross-container drag

После `updateTask(parent_task_id)` ОБЯЗАТЕЛЬНО вызвать `reorderBacklog` — иначе `router.refresh()` восстановит старый `backlog_order` из БД и задача уйдёт в конец списка.

```tsx
await updateTask(activeId, projectId, { parent_task_id: ... })
await reorderBacklog(projectId, newTasks.map(t => t.id))
router.refresh()
```

---

## Соглашения по коду
- Все компоненты на TypeScript
- 'use client' только где нужна интерактивность (формы, drag&drop, состояние)
- Server Components для страниц где можно
- Запросы к БД через lib/queries/ — не писать SQL прямо в компонентах
- Время всегда в минутах в БД, конвертировать через lib/utils/time.ts
- Цвета только через CSS переменные (--accent, --bg и т.д.)
