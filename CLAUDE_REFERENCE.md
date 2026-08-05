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
app/(auth)/login · register
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
- История недель: период, задачи, объём, выполнено, удалено, %
- Сводка по сотрудникам (как в старом Google Sheets дашборде)
- Admin видит всех, сотрудник — только себя (или тех к кому есть доступ через `access_settings`)
- Использует `fixed_task_ids` для сравнения плана vs факта
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
- Auth: login, register, pending/active flow
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
