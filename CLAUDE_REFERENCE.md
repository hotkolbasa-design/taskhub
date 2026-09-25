# TaskHub — Справочник деталей

> Читается по необходимости. Актуальные правила и запреты — в `CLAUDE.md`.

---

## Проект и стек
Внутренняя платформа управления задачами. Заменяет Google Sheets + Битрикс. Логика: Asana/Битрикс — бэклог, спринты, проекты, аналитика.

- **Frontend**: Next.js 16.2.7 (App Router) + TypeScript
- **UI**: Tailwind CSS (без UI библиотек)
- **БД**: Supabase (PostgreSQL) — проект `taskhub-prod`, ID: `zsmhyuvxldwedshjmvjg`
- **Auth**: Supabase Auth (email/password), **Real-time**: Supabase Realtime, **Files**: Supabase Storage
- **Деплой**: Vercel → **https://taskhub-ecru.vercel.app**

---

## Структура файлов
```
app/(auth)/login · register · forgot-password · reset-password
app/auth/confirm/route.ts  ← приём ссылок из писем Supabase (recovery, invite)
app/(dashboard)/dashboard · projects · projects/[id]/backlog|sprint|settings · my-tasks · admin
lib/supabase/client.ts · server.ts · admin.ts
lib/queries/projects.ts · tasks.ts · sprints.ts · comments.ts
lib/utils/time.ts  ← minutesToDisplay / displayToMinutes
components/backlog/ · sprint/ · task/ · modals/
types/index.ts · proxy.ts
```

---

## Дизайн

### CSS переменные
```
--bg: #0F1117       (фон страницы)
--surface: #181C27  (карточки, панели)
--surface2: #1F2436 (вложенные элементы)
--text: #E8EAF0     (основной текст)
--text2: #8892A4    (второстепенный текст)
--accent: #4F8EF7   (синий, акцент)
--green: #2DD4A0
--red: #F75C6E
--yellow: #F7C04F
--border: rgba(255,255,255,0.08)
```

### Шрифты
- `Geologica` — основной
- `JetBrains Mono` — числа, время, даты (`var(--font-mono)`)

---

## Роли
`admin` · `owner` (создатель проекта) · `manager` (назначается) · `member` · `viewer`

Регистрация: `pending` → admin подтверждает → `active`. До подтверждения вход заблокирован.

`owner` — тот кто создал проект (не admin автоматически).

---

## Восстановление пароля

Пароли лежат в Supabase Auth как bcrypt-хэш — прочитать нельзя, только перезаписать.

**Путь пользователя:** `/login` → «Забыли пароль?» → `/forgot-password` (`resetPasswordForEmail` с `redirectTo` на `/auth/confirm?next=/reset-password`) → письмо → `/auth/confirm` → `/reset-password` (`updateUser({ password })`).

`app/auth/confirm/route.ts` принимает оба формата ссылки: `token_hash` + `type` (`verifyOtp` — работает в любом браузере) и `code` (`exchangeCodeForSession` — PKCE, только в том браузере, где запрашивали). Без параметров — пропускает на `next`, чтобы клиент разобрал токены из хэша. Битая или просроченная ссылка → `/forgot-password?error=link|expired`.

`publicRoutes` в `proxy.ts`: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth`. Новый маршрут без авторизации → добавлять сюда, иначе proxy отправит на `/login`.

**Сброс силами админа** — основной рабочий путь. Карточка пользователя в админке → «Сбросить пароль» → временный пароль на экране (`resetUserPassword` в `app/(dashboard)/admin/actions.ts`, Admin API, без писем и лимитов). Показывается один раз, себе сбросить нельзя, суперадмина трогает только суперадмин (`guardTarget`).

**Ограничения почты Supabase (free + встроенный провайдер)** — почему письмо не запасной вариант, а предмет отдельной настройки:
- `rate_limit_email_sent` = **2 письма в час на весь проект**. Меняется только после подключения своего SMTP.
- Шаблоны писем редактировать **запрещено**: Management API отвечает `Email template modification is not available for free tier projects using the default email provider`. Поэтому в письме дефолтный `{{ .ConfirmationURL }}` → PKCE-код → ссылка срабатывает только в том браузере, где её запросили.
- `smtp_max_frequency` = 60 с одному адресу, `mailer_otp_exp` = 3600 с, `password_min_length` = 6 (в UI требуем 8).
- Свой SMTP (Resend / Brevo / SES) снимает и лимит, и запрет на шаблон. Тогда шаблон recovery стоит перевести на `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` — `route.ts` это уже понимает, и ссылка начнёт открываться на любом устройстве.

**URL Configuration** (Dashboard): Site URL `https://taskhub-ecru.vercel.app`, Redirect URLs — `https://taskhub-ecru.vercel.app/**` и `http://localhost:3001/**`. Без них `redirectTo` игнорируется и ссылка ведёт на Site URL.

---

## База данных — полная схема

### profiles
```
id (UUID, FK auth.users) · full_name · login (unique) · role (admin|employee)
status (active|inactive|pending) · avatar_url · created_at
```

### projects
```
id · name · description · color · default_assignee_mode (creator|specific|manual)
default_assignee_id · week_cycle_type (mon-sun|custom|manual) · default_deadline
auto_recurring · created_by · created_at
```

### project_members
```
id · project_id · user_id · role (owner|manager|member|viewer) · UNIQUE(project_id, user_id)
```

### sprints
```
id · project_id · name · date_from · date_to · status (active|closed)
is_fixed (boolean, default false) · fixed_at (timestamptz) · fixed_task_ids (uuid[])
created_by · created_at
```

### sprint_columns
```
id · sprint_id · name · color · order_index
```

### tasks
```
id · project_id · title · description · type (task|epic) · status (backlog|sprint|done|deleted)
assignee_id · creator_id · deadline · time_estimate (минуты, integer) · parent_task_id · sprint_id
column_id · column_order · backlog_order · is_recurring · recurring_config (jsonb)
tags · workflow_status (new|in_progress|review|done|cancelled) · closed_at · created_at · updated_at
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

## Ключевые механики

### Бэклог
- Все задачи со статусом `backlog`
- Эпики вверху с прогресс-баром подзадач (`subtask_total` / `subtask_done`)
- Drag & drop сортировка (`backlog_order`)
- Перенос в спринт: кнопка "В спринт" ИЛИ перетаскивание мышкой в спринт-панель (правая часть экрана)
- "Убрать из эпика": устанавливает `parent_task_id = null`, задача уходит на корневой уровень
- **Выполненных задач в бэклоге нет.** Как только `workflow_status` становится `done`/`cancelled`, задача из бэклога уводится в архив: `status='backlog'` → `status='done'` (см. `lib/queries/task-archive.ts`, `backlogArchivePatch`). Обратно: снятие статуса возвращает её в конец бэклога. Архив виден только в «Мои задачи» → колонка «Выполненные». Логика применяется во ВСЕХ точках смены статуса: `updateTask` (инлайн-дропдаун бэклога + драйвер) и `updateTaskWorkflowStatus` (инлайн-дропдаун «Мои задачи»). Задачи спринта не трогаются (их архивирует `closeSprint`).
- **Архив эпика** (`syncEpicSubtasksArchive`): при уходе эпика в архив его подзадачи не остаются сиротами. Выполненные подзадачи уходят в архив вместе с эпиком; невыполненные ОСТАЮТСЯ в бэклоге, но отвязываются (`parent_task_id=null`) — становятся самостоятельными задачами.

### Спринт (панель на странице бэклога)
- Эпики раскрываются, подзадачи внутри
- Drag & drop: top-level задачи сортируются, подзадачи перетаскиваются между эпиками
- Любую задачу/эпик можно вернуть в бэклог через "В бэклог" в меню
- **Создание задачи прямо на странице спринта**: в футере каждой колонки «+ Задача» — быстрый ввод (название + Enter, поле остаётся открытым) + «Подробнее» (полная `CreateTaskModal` с `skipCreate`). Задача создаётся `createSprintTask` со `status='sprint'`, `column_id` = колонка (добавлен параметр). В бэклоге не появляется (там только `status='backlog'`), видна в спринт-панели и в «Мои задачи». Оптимистичный `createInColumn` (temp id → реальный).
- **Инлайн статус/приоритет на карточке спринт-борда** (`SprintTaskCard`): портал-дропдауны прямо на карточке, без открытия drawer. Триггеры гасят `pointerdown`+`click` (иначе стартует drag / откроется drawer), закрываются по скроллу. Хендлеры (`handleInlineWorkflow`/`handleInlinePriority`) — оптимистичный `setTaskMap` + `updateTask`.
- **Связка статус ↔ колонка «Готово»**: смена статуса на `done` через инлайн-дропдаун переносит карточку в колонку с `role='done'` (через `moveTaskInSprint`); смена с `done` на другой статус в колонке «Готово» — в первую обычную колонку. Симметрично drag-поведению в `handleDragEnd`.
- **Живая эффективность**: в шапке спринт-панели бейдж «эффект. X%» по активному спринту, считается на клиенте из текущих задач (пересчёт вживую при смене статуса). Клик → портал-поповер с разбивкой по исполнителям. Формула — единый `computeEfficiency` в `lib/utils/efficiency.ts` (тот же, что в истории/аналитике): времяВыполненных / время(выполненных+невыполненных); без времени — по количеству; эпики/отменённые/удалённые исключены.

### Фиксация недели (Snapshot)
- Кнопка "Зафиксировать" в шапке спринт-панели на странице бэклога
- Доступна ЛЮБОМУ пользователю (не только admin)
- Перед фиксацией: проверка задач без дедлайна и без оценки времени (предупреждение, не блокирует)
- На confirm: сохраняет `{ is_fixed: true, fixed_at: now(), fixed_task_ids: [текущие task IDs] }`
- **Снапшот**: фиксирует список задач на момент нажатия для аналитики
- После фиксации: задачи ОСТАЮТСЯ свободными — можно добавлять, убирать в бэклог
- Бейдж "Зафиксировано 15 июн." показывается в шапке спринт-панели и в шапке спринт-доски
- `fixed_task_ids` используется аналитикой для сравнения "что было запланировано" vs "что выполнено"

### Спринт-доска (канбан)
- Колонки по дням недели (Пн-Сб) или кастомные
- Drag & drop карточек между колонками (`column_id`, `column_order`)
- Шапка показывает бейдж фиксации если `is_fixed = true` (read-only, кнопки фиксации тут нет)
- **ВАЖНО (кэш):** `getSprintData` завёрнут в `unstable_cache` (тег `tasks-${projectId}`), а `SprintBoard` — чисто оптимистичный, без `useEffect`-синка. Поэтому ЛЮБОЙ серверный экшен, меняющий колонки/задачи спринта, ОБЯЗАН вызвать `revalidateTag(\`tasks-${projectId}\`)`, иначе изменения записываются в БД, но при следующем заходе борд читает старый кэш и «схлопывает» задачи в первую колонку. Так был баг: `moveTaskInSprint`/`reorderSprintColumns` не ревалидировали.

### Аналитика эффективности
- **Доступ — проектный** (не по `access_settings`): админ («я») видит ВСЕ проекты; остальные — только проекты, где они участники (`project_members.user_id`). Внутри проекта видны все его участники. Данные грузятся на сервере: `getAnalyticsProjects(userId, isAdmin)` → список проектов, затем `getProjectAnalytics(projectId)` по каждому. Нет доступных проектов → redirect на `/dashboard`.
- `getProjectAnalytics` (в `lib/queries/analytics.ts`) возвращает `ProjectAnalytics { project_id, project_name, users, sprintsByUser, weekly }`: участники проекта, понедельные `SprintStat[]` каждого В ЭТОМ проекте, и `weekly: WeekPoint[]` — эффективность проекта в целом по неделям. Разбивка задач спринта по `assignee_id`. Кэш-теги: `sprints-<projectId>`, `members-<projectId>`, `profiles`.
- Компонент `AnalyticsView` получает `projects: ProjectAnalytics[]`. Селектор проекта (`ProjectSelect`, кастомный портал-дропдаун) — «Все проекты» (если проектов >1) или конкретный; при «Все» users/sprintsByUser мёржатся. Выбор проекта персистится (`usePersistedFilter`, ключ с `currentUserId`). Наверху — период текущей недели «Текущая неделя: dd.mm – dd.mm» (`fmtWeekRange`, `lib/utils/week.ts`). Два режима:
  - **Сводка** (`EfficiencySummary`, дефолт) — матрица строк × колонки-недели. **Строки зависят от выбора проекта:** «Все проекты» → строки = **проекты** (каждый проект ≈ ответственный за него; ячейка = эффективность проекта за неделю из `weekly`, агрегируется взвешенно по `total_tasks`); конкретный проект → строки = **сотрудники** этого проекта (ячейка считается через `computeEfficiency` по задачам сотрудника за неделю). `EfficiencySummary` универсальный — принимает `rows: SummaryRow[]` (`{id, name, color, avatarText, isProject, cells: {monday→{eff,active}}, ongoingFrom}`), `weeksCount`, `entityLabel`, `onOpenRow`. **Клик по строке-проекту** → выбирает этот проект (разворот в его сотрудников); **клик по сотруднику** → режим «По сотруднику». Ось недель выровнена по календарным неделям (понедельник ISO, `mondayOf`), непрерывная. Липкие крайние колонки: слева — название + спарклайн тренда + среднее %, справа — «Текущая» (период недели). Единый `overflow-auto`, `maxHeight:56vh`, автоскролл вправо. Ячейка = `EffPill` (цвет-порог `efficiencyColor`), пустая = «·». Аватар проекта — квадрат с иконкой-папкой, сотрудника — круг с буквой.
  - **Индикатор спринта на этой неделе**: точка на аватаре — зелёная = начал НОВЫЙ спринт на текущей неделе (`mondayOf(date_from) === currentMonday`), жёлтая = активный спринт тянется с прошлой недели (`ongoingFrom`), серая = не начат. В колонке «Текущая»: `EffPill` (начал) / «идёт с dd.mm» / «не начат». Чип-сводка «Начали спринт: X/Y» + «Средняя: N%». Управление — в верхней панели `AnalyticsView`: фильтр сотрудников (`UserFilter`, только в режиме конкретного проекта) + выбор недель `8/12/Всё`, оба персистятся.
  - **Графики внизу** (`AnalyticsCharts`) — SVG-линейные графики (area + линия + точки, цвет по последнему значению): секция «График по проектам» (по `weekly` каждого проекта) и «График по сотрудникам» (понедельная эффективность каждого).
  - **По сотруднику** — детальный вид: слева список, справа активный спринт + история недель выбранного.
- Использует `fixed_task_ids` для сравнения плана vs факта.
- **История — «замороженный» набор задач, но цифры пересчитываются вживую** из текущего состояния задач (правка задачи меняет цифры прошлого спринта). Поэтому в «Истории спринтов» задачи открываются в **режиме только для чтения**: `TaskDrawer` с пропом `readOnly` (все дропдауны/инпуты/комментарии заблокированы, бейдж «Только просмотр»). Данные тянет `getTaskForDrawer` (из `my-tasks/actions`). Реопен выполненной задачи делается вручную в бэклоге, чтобы не переписывать историю.

### Превращение задача ↔ эпик
- `convertTaskType(taskId, projectId, toType)` в `backlog/actions.ts`. Отличие эпик/задача — только `type` + связи.
- **Задача → эпик**: `type='epic'`; если была подзадачей — отвязываем (`parent_task_id=null`, эпик не вложенный), в бэклоге даём `backlog_order` в конец.
- **Эпик → задача**: подзадачи отвязываются (`parent_task_id=null`) и становятся самостоятельными (backlog — порядок в конец, sprint — сохраняют колонку); сам эпик → `type='task'`.
- UI: пункт в kebab-меню карточки (`onConvertType` в `task-card.tsx`) + кнопка у метки типа в `TaskDrawer` (кроме `readOnly`). Клиент полагается на `router.refresh()` + merge-эффект бэклога (структурная перестройка), без ручного оптимистичного пересбора.

### Назначение задач
- `creator_id` — постановщик (кто создал)
- `assignee_id` — исполнитель (кто выполняет)

### Мои задачи
- Агрегирует задачи со ВСЕХ проектов (бэклог + спринт), группирует по дедлайну в 6 колонок (+ «Выполненные»). Запрос: `getMyTasks` (`assignee_id` OR `creator_id`, кроме `deleted`).
- Фильтр по роли (исполнитель / постановщик, мультивыбор). **Дефолт — оба вкл. для всех** (и сотрудники раздают задачи друг другу, поэтому постановщик тоже важен). Сузить можно кнопками. См. `roleFilter` в `my-tasks-board.tsx`.

### Фильтр по исполнителю (общий компонент)
- `components/common/user-filter.tsx` (`UserFilter`) — портал-мультиселект по людям, есть на «Мои задачи», бэклоге, спринте.
- **Мои задачи**: у админа выбирает, ЧЬИ задачи агрегировать (`getTasksForUsers` / `fetchTasksForUsers`, только админ смотрит чужих); роль-чипы фильтруют отношение. Дефолт — текущий юзер.
- **Бэклог / Спринт**: фильтрует карточки по `assignee_id` (для всех, они и так видят все задачи проекта). **Важно:** при активном фильтре DnD ОТКЛЮЧАЕТСЯ (`useSensors(...(filterActive ? [] : [sensor]))`) — иначе переупорядочивание отфильтрованного подмножества сломает `backlog_order`/`column_order`.
- Кнопка фильтра на бэклоге — в верхней навигации (обёртка `BacklogView` держит состояние и передаёт `assigneeFilter` в `BacklogBoard`).
- Фильтр влияет и на спринт-панель (правая часть страницы бэклога): `SprintPanel` принимает `assigneeFilter`, фильтрует ТОЛЬКО отображение (`viewTasks` → дерево + статы/эффективность), а мутации (`onTasksChange`) всегда идут по полному `tasks`, иначе скрытые задачи потерялись бы из стейта.

### Повторяющиеся задачи
- `recurring_config: { day_of_week: 5, time_estimate_minutes: 120 }`
- При создании спринта: авто-добавление или кнопка "Добавить повторяющиеся"

---

## Текущий прогресс

### ✅ Сделано
- Supabase: все таблицы, RLS политики, триггеры (updated_at, auto-profile)
- Auth: login, register, pending/active flow, восстановление пароля по письму
- Dashboard layout: sidebar + main
- Страница проектов (список + создание)
- Настройки проекта (участники, основные данные)
- Бэклог: список, эпики, drag&drop, cross-container, карточки
- Task Detail Drawer: просмотр/редактирование, комментарии real-time
- Создание задач: модалка с DatePicker, эпик, исполнитель
- Панель администратора: управление пользователями
- Sprint Panel: список задач спринта с эпиками, DnD, кнопка "Зафиксировать", снапшот фиксации
- Спринт-доска: канбан с колонками, DnD, бейдж фиксации
- "Убрать из эпика": в меню карточки (бэклог + спринт)
- Деплой: https://taskhub-ecru.vercel.app (Vercel builds временно скипаются через vercel.json)

### ⏳ Предстоит
- Аналитика эффективности (использует `fixed_task_ids`)
- My Tasks страница (доработки)
- Доработки панели администратора

---

## Drag & Drop — детальная архитектура

Реализован в `components/backlog/backlog-board.tsx` и `components/backlog/sprint-panel.tsx`.

### Multi-container DnD

```tsx
type DragPreview = { container: string; insertAt: number }
// container = 'root' | 'sprint' | epicId

const dragSourceRef = useRef<string>('root')   // откуда тащим
const dragCurrentRef = useRef<string>('root')  // где сейчас
```

- `handleDragStart` — сохраняет source в ref, сбрасывает preview
- `handleDragOver` — ТОЛЬКО обновляет `dragCurrentRef` и `dragPreview` (никогда `setTasks`!)
- `handleDragEnd` — все мутации состояния только здесь

### applyDragPreview с equality-check

```tsx
function applyDragPreview(next: DragPreview | null) {
  setDragPreview(prev => {
    if (!prev && !next) return prev
    if (prev && next && prev.container === next.container && prev.insertAt === next.insertAt) return prev
    return next
  })
}
```

### Dual-ref паттерн для эпиков

`setNodeRef` ставится на HEADER div (~66px) — для корректного измерения центра коллизии.
`transform` применяется к OUTER div — весь блок (header + subtasks) движется как одно целое.

```tsx
const { setNodeRef: sortableRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: epic.id })

// Outer div — получает transform + opacity
<div style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }}>
  // Header div — получает setNodeRef
  <div ref={sortableRef}>
    <TaskCard externalDragHandle={{ attributes, listeners }} sortableDisabled />
  </div>
</div>
```

### Сохранение порядка после cross-container drag

После `updateTask(parent_task_id)` ОБЯЗАТЕЛЬНО вызвать `reorderBacklog`:

```tsx
await updateTask(activeId, projectId, { parent_task_id: newParent })
await reorderBacklog(projectId, newTasks.map(t => t.id))
router.refresh()
```

Иначе `router.refresh()` восстановит старый `backlog_order` из БД.

---

## Паттерн: кастомный дропдаун

Всегда через `createPortal` + `position: fixed` если внутри overflow-контейнера.

```tsx
function MyDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(o => !o)
  }

  return (
    <>
      <button ref={triggerRef} onClick={handleOpen}>...</button>
      {open && pos && createPortal(
        <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
          background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out' }}>
          ...options...
        </div>,
        document.body
      )}
    </>
  )
}
```

Готовые примеры: `components/admin-user-actions.tsx`, `components/projects/settings/members-section.tsx`, `components/backlog/task-card.tsx`.

---

## Паттерн: оптимистичные обновления

### Одно значение
```tsx
const [optimisticValue, setOptimisticValue] = useState(initialValue)

async function handleChange(next: string) {
  setOptimisticValue(next)
  try {
    await serverAction(next)
    router.refresh()
  } catch {
    setOptimisticValue(initialValue) // rollback
  }
}
```

### Список (добавление/удаление)
```tsx
const [optimisticList, setOptimisticList] = useState(initialList)
useEffect(() => { setOptimisticList(initialList) }, [initialList])

async function handleAdd(item) {
  setOptimisticList(prev => [...prev, item])
  try { await serverAction(item); router.refresh() }
  catch { setOptimisticList(prev => prev.filter(i => i.id !== item.id)) }
}

async function handleRemove(id) {
  setOptimisticList(prev => prev.filter(i => i.id !== id))
  try { await serverAction(id); router.refresh() }
  catch { setOptimisticList(initialList) }
}
```

---

## Паттерн: выравнивание колонок в списках

Фиксированный wrapper вместо minWidth на бейдже:
```tsx
<div style={{ width: 100 }}><Badge /></div>
```

Опциональные элементы — пустой placeholder той же ширины:
```tsx
<span style={{ width: 28 }}>{isSelf ? 'вы' : ''}</span>
```

### Бейдж «ожидают подтверждения»
- В сайдбаре у пункта «Пользователи» (админ) — счётчик profiles со `status='pending'` (`getPendingUsersCount`, админ-гейт). Обновление: опрос 30с + событие `window 'pending-users-changed'` (шлёт `admin-users-client` после смены статуса pending-юзера) + при навигации. Пропадает при 0.

### Персист фильтров
- Фильтры по людям приватны (клиентский стейт, не шарятся) и ЗАПОМИНАЮТСЯ между заходами через `usePersistedFilter` (`lib/hooks/use-persisted-filter.ts`) — localStorage, ключ содержит `userId` (+`projectId` для бэклога/спринта). Применяется: бэклог (`BacklogView`), спринт-борд (`SprintBoard`, добавлен проп `currentUserId`), «Мои задачи» (roleFilter + selectedUsers). SSR/первый рендер = дефолт, затем подтягивается сохранённое (краткий флеш допустим). Персист per-browser.

### Отдел — combobox с добавлением
- В профиле пользователя (`admin-user-drawer`) поле «Отдел» — кастомный combobox (`DepartmentCombobox`): список существующих отделов (distinct из `profiles.department`, передаётся пропом `departments` из `admin-users-client`) + поиск + «Добавить «X»» (вписать новый). Новый отдел сохраняется при сохранении профиля и появляется в списке. Отдельной таблицы отделов нет.

### Доступ к CRM
- `lib/utils/crm-access.ts` (`canAccessCrm`): CRM видят админы, должность «маркетолог» И отделы `Маркетинг`/`Отдел продаж` (`CRM_DEPARTMENTS`, сравнение lowercase+trim). Используется в сайдбаре (`sidebar-nav`) и гарде страницы (`crm/page`). В layout в профиль добавлен `department`.

### Заявки на расходы (`/expenses`)
Отдел просит купить — утверждающие разбирают заявки раз в неделю. Таблицы: `expense_requests`, `expense_request_comments`, `expense_request_activities` (миграция `20260925100000_expense_requests.sql`).

**Кто что видит.** Свои заявки — каждый. Все заявки и право решать — у `role = 'admin'` и у тех, кому выдан флаг `profiles.can_approve_expenses`. Флаг введён ради учредителя: раздел расходов нужен, а пользователи и CRM — нет. Выдаёт только суперадмин (`setCanApproveExpenses`), переключатель — в карточке пользователя в админке.

**Статусы:** `pending` → `approved` / `rejected` / `needs_info`, плюс `cancelled` (автор отозвал). Решение принимает любой из утверждающих в одиночку, второго подтверждения не требуется.

**Оплата — не статус, а свои поля** (`paid_at`, `paid_by`, `paid_amount`, `paid_note`): она следующий шаг после одобрения, а `paid_amount` отдельно от `amount`, потому что по факту покупают дешевле или дороже запрошенного. В таблице такая заявка показывается бейджем «Оплачено», хотя `status` остаётся `approved`.

**Номер** `ЗР-0042` — из `expense_request_number_seq`, сквозной, генерится дефолтом колонки.

**`department`** пишется копией из профиля в момент подачи: человек может перейти в другой отдел, а заявка должна остаться за прежним.

**RLS включён** (в отличие от остальных таблиц проекта) — речь о деньгах, и чужую заявку база не отдаст, даже если в коде появится дыра. Функция `can_approve_expenses(uid)` — `security definer`. Приложение при этом ходит сервисным ключом и проверяет права в `actions.ts` (`requireApprover`), как и везде.

**Уведомления** переиспользуют `notifications` — добавлена колонка `expense_request_id` и типы `expense_submitted`, `expense_decided`, `expense_comment`, `expense_paid`. Клик по такому уведомлению ведёт на `/expenses`.

Вложения кладутся в существующий бакет `task-attachments` (публичный, лимит 25 МБ), префикс `expenses/`.

### CRM → Маркетинг: как считаются лиды
Листы «Лиды» и «Сделки» — **журнал событий Битрикса**, а не карточки: строка = переход в стадию (D — новая стадия, F — предыдущая, B — ссылка с ID). Один лид даёт несколько строк.

Строки воронки «Маркетинг», берущиеся из листа «Лиды» (`Новая заявка (WhatsApp)`, `(Instagram)`, `Собеседование назначено`), считаются **по уникальным лидам** (`uniqueLeads` в `lib/crm/marketing.ts`):
- лид числится за днём **первого** своего события в этом месяце, повторные отбрасываются;
- уникальность считается **внутри месяца** — иначе цифры месяца зависели бы от соседнего;
- строки без ссылки на карточку (нет ID) считаются как есть, поодиночке.

Для «Новой заявки» дополнительно **вычитаются лиды, ушедшие в «Перенести в зачисление»** (`TO_SCHOOL_STAGE`) позже своей заявки: из «Новое обращение» лид уезжает в «Новая заявка» автоматически через полчаса, а звонок колл-центра потом показывает, что человек уже учится у нас. Сравнение по `ts` (время события), поэтому важны обе колонки — дата и ссылка.

**Отметка ДО заявки не считается**: такого лида вернули в работу, и он честно новый (проверено на лиде 54888 — после возврата дошёл до собеседования).

Прямых переходов «Новая заявка» → «Перенести в зачисление» в данных не бывает: Битрикс всегда пишет промежуточный статус (в 21 случае из 28 — «Новое обращение»). Поэтому правило смотрит на **порядок событий**, а не на пару «предыдущий → текущий».

Чего это НЕ касается: строк из листа «Сделки» (собеседование проведено, предоплата, педсовет, оплата), раздела «Воронки» (`pipelines.ts` — там по-прежнему события), замороженных месяцев (снапшот отдаётся как есть; при разморозке пересчитается по новой логике).

Эффект на сентябрь 2026: 1347 → 1270 (−73 дубля, −4 существующих клиента), CPL $1.85 → $1.97.
