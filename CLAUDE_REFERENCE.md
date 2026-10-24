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
id · user_id · actor_id (FK profiles) · type · task_id · expense_request_id
data (jsonb) · is_read · created_at
```
Типы (CHECK на колонке, расширять вместе с `NotificationType` в `lib/notifications.ts`):
`task_assigned` · `assignee_changed` · `creator_changed` · `status_changed` · `comment_added`
`deadline_soon` · `deadline_overdue` · `expense_submitted` · `expense_decided` · `expense_comment` · `expense_paid`

**`actor_id` ссылается на `profiles`, а не на `auth.users`** — колокольчик подтягивает имя автора
через `profiles!notifications_actor_id_fkey`, и на `auth.users` PostgREST связь не находит (PGRST200).

**Исторический урок (28 сентября 2026).** Уведомления не создавались НИ РАЗУ с момента появления
функции: таблицу завели вручную, и она разошлась с кодом по трём пунктам — не было колонок
`actor_id` и `data` (PGRST204), CHECK разрешал только старые имена `assigned|commented|sprint_fixed|mentioned`
(23514), а `actor_id` ссылался на `auth.users` (PGRST200 при чтении). Сбой был невидим, потому что
результат `insert` не проверялся. Теперь `createNotifications` пишет ошибку в лог — **не убирать
эту проверку**, иначе следующее расхождение схемы снова будет молчать месяцами. Миграция
`20260928100000_notifications_missing_columns.sql`.

Клик по уведомлению о задаче ведёт на `/projects/<id>/backlog?task=<taskId>` — `BacklogBoard`
читает `?task=` и открывает карточку (иначе человек попадал в бэклог и искал задачу глазами).

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

### CRM → Ученики (`lib/crm/students.ts`)
- Счёт ведётся **не от Битрикса, а от отметки владельца** (`student_baseline`: 341 на 30.09.2026) плюс движения после неё. По воронкам Битрикса набирается ~386 — расхождение в незаполненных ФИО и не выведенных из воронки ушедших, поэтому прямой подсчёт не используется.
- Сделка = семья: учеников считаем по полям «ФИО ученика 1…4» (коды зафиксированы явно, в портале полно полей-дублей). Одинаковые имена внутри одной сделки схлопываются — их вписывают в два поля, и человек задваивался.
- **Плюс** — вход в «Зарегистрировать на платформу» (`C4:PREPARATION`) **из «Полная оплата есть»** (`WON`). Заведённые руками из «Неразобранное», «Новые написавшие номера», «Дубль» не в счёт.
- **Минус** — вход в «Запросили отчисление» (`C6:NEW`), но только если человек **до этого числился учеником**: либо мы сами его прибавляли (есть плюс после отметки), либо он пришёл со стадии из белого списка `STUDYING_STAGES` (воронка «Все ученики» и зачисление начиная с регистрации). Повторная отметка по той же сделке после последнего зачисления не в счёт.
- Почему список белый: 7–8 октября 2026 в отчисление разом отправили 40 старых сделок (33 заведены при переносе из AMO осенью 2025, 23 пришли из «Выбышие должники», 16 уже проходили отчисление раньше) и счётчик вычел 47 человек, из которых прибавлял он только одного. Незнакомая стадия теперь ученика не убавляет, строка видна в таблице с причиной.
- `reviewRecentMoves()` пересчитывает **все** движения после отметки по текущим правилам, строго по времени (решение по минусу зависит от того, кто числится на этот момент). Запускается после каждой синхронизации; при смене правил достаточно её прогона — записи обновятся. Раньше она считала по упрощённой логике и возвращала в счёт то, что синхронизация отсеяла.
- Движения не удаляются: не прошедшие отбор лежат с `counted=false` и `skip_reason`, в таблице показываются приглушённо.
- `manual_counted` — ручное решение после сверки с выгрузкой платформы; `null` значит «решает автоматика». Пересчёт такие строки не трогает. 13.10.2026 так сняты все 41 октябрьских отчислений: сверка с `globalos.kz/students/export` показала, что 32 человека отчислены ещё до 16.09, двое выпускники, трое на платформе не найдены, трое до сих пор учатся, а **ни одного совпадения с 15 реально ушедшими за период не нашлось** — в Битриксе свежие уходы не отмечают, там задним числом оформляют старые. Правила по стадиям этот случай не ловят: стадия говорит, где лежала карточка, а не учился ли человек.
- Выгрузка платформы: `https://globalos.kz/students/export?is_test=0&filter=all` (GET, нужна сессия), статусы «Активный», «Новенький», «Не подтвержден», «Отчислен», «Выпускник». Даты смены статуса в ней нет — кто ушёл за период, видно только сравнением двух выгрузок.
- Синхронизация ходит в Битрикс из `/api/crm`, обёрнута в `unstable_cache` на 10 минут (`crm-students`), иначе бьёт по лимитам на каждое открытие вкладки.

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

**Кто что видит.** Свои заявки — каждый. Все заявки и право решать — у `role = 'admin'` и у тех, кому выдан флаг `profiles.can_approve_expenses`. Бухгалтерии выдаётся отдельный флаг `profiles.can_pay_expenses`: она видит весь список и проставляет оплату, но решений не принимает — платит и решает не один и тот же человек. В RLS за видимость отвечает `can_see_all_expenses(uid)`, в server actions — `requirePayer` (оплата) против `requireApprover` (решения). Раздел для неё открывается сразу на вкладке «Ждут оплаты», а при одобрении заявки ей приходит уведомление. Флаг введён ради учредителя: раздел расходов нужен, а пользователи и CRM — нет. Выдаёт только суперадмин (`setCanApproveExpenses`), переключатель — в карточке пользователя в админке.

**Статусы:** `pending` → `approved` / `rejected` / `needs_info`, плюс `cancelled` (автор отозвал). Решение принимает любой из утверждающих в одиночку, второго подтверждения не требуется.

**Оплата — не статус, а свои поля** (`paid_at`, `paid_by`, `paid_amount`, `paid_note`): она следующий шаг после одобрения, а `paid_amount` отдельно от `amount`, потому что по факту покупают дешевле или дороже запрошенного. В таблице такая заявка показывается бейджем «Оплачено», хотя `status` остаётся `approved`.

**Номер** `ЗР-0042` — из `expense_request_number_seq`, сквозной, генерится дефолтом колонки.

**`department`** пишется копией из профиля в момент подачи: человек может перейти в другой отдел, а заявка должна остаться за прежним.

**RLS включён** (в отличие от остальных таблиц проекта) — речь о деньгах, и чужую заявку база не отдаст, даже если в коде появится дыра. Функция `can_approve_expenses(uid)` — `security definer`. Приложение при этом ходит сервисным ключом и проверяет права в `actions.ts` (`requireApprover`), как и везде.

**Уведомления** переиспользуют `notifications` — добавлена колонка `expense_request_id` и типы `expense_submitted`, `expense_decided`, `expense_comment`, `expense_paid`. Клик по такому уведомлению ведёт на `/expenses`.

Вложения кладутся в существующий бакет `task-attachments` (публичный, лимит 25 МБ), префикс `expenses/`.

### CRM: кэш дашборда и процессорное время Vercel
Расчёт месяца — самая тяжёлая операция проекта: читает «Лиды», «Сделки», расходы, курс, настройки и строит воронку по дням и неделям для всех источников. Без кэша он повторялся на каждое открытие вкладки, и к октябрю 2026 проект съедал 3 ч 22 мин из 4 часов Fluid Active CPU, включённых в Hobby (три уведомления о 75 % подряд). Остальные лимиты были заняты не больше чем на половину.

`getCachedDashboard(month)` в `lib/crm/compute.ts` оборачивает расчёт в `unstable_cache` на `CRM_CACHE_SECONDS` (300) с тегами `crm` и `crm:<месяц>`. Один пересчёт обслуживает всех, кто открыл дашборд за эти пять минут.

**Кэш обязан сбрасываться на каждом сохранении** — иначе человек сохранит значение и увидит старое. В POST `/api/crm` это делает `dropCache(monthKey)`: расход и курс сбрасывают месяц из даты, план и заморозка — свой месяц, группы и исключённые источники — тег `crm` целиком (они влияют на все месяцы). В Next 16 `revalidateTag` требует вторым аргументом профиль cacheLife, используется `'max'`.

Кнопка «Обновить» шлёт `?fresh=1` — сбрасывает тег и считает заново. В шапке стоит отметка «данные на HH:MM» из поля `computedAt`, которое пишется в момент расчёта, а не ответа, — по ней видно возраст цифр. У замороженного месяца отметки нет: снимок не стареет.

Синхронизация движений учеников (`syncStudentMoves`) ходит в Битрикс и пишет в базу. Она тоже запускалась на каждое открытие вкладки — теперь обёрнута в `unstable_cache` на 600 секунд, то есть не чаще раза в десять минут на всех.

### CRM: фиксация месяца перед архивацией
4-го числа в 03:00 по Алматы Apps Script таблицы Битрикса уносит строки прошлого месяца в отдельный файл «Архив B24 - <Месяц> <Год>» и удаляет их из листов «Лиды» и «Сделки». `computeDashboardData` читает только рабочие листы, поэтому месяц обязан быть снят до этого.

`/api/cron/freeze` (`vercel.json`, `0 6 3 * *` — 3-го числа, 11:00 Алматы) берёт прошлый месяц, считает дашборд и пишет снимок в лист `Snapshots`. Идемпотентно: существующий снимок не перезаписывается, пустой месяц не фиксируется (409, чтобы расписание не затёрло месяц нулями). Авторизация как у `auto-fix-sprints` — `Authorization: Bearer CRON_SECRET`; ручной прогон `?key=<secret>&month=2026-10`.

**Почему снимок сентября 2026 не записался.** `writeSnapshot` обновлял строку через `updateRange` с `USER_ENTERED`, и Google превращал ключ «2026-09» в серийную дату 46266 — строка переставала находиться по месяцу, а дашборд показывал нули. Теперь запись только `RAW`, а `rowMonth` распознаёт числовые ключи старых строк. Та же ошибка видна в строках июля и августа.

### CRM → План: месячный план и недельная разбивка
Вкладка `plan` (`components/crm/plan-view.tsx`), расчёт — `lib/crm/plan.ts`, типы `MonthPlan`, `WeekPlanRow`, `CapacityRow` в `lib/crm/types.ts`.

**План хранится объектом, а не числом.** До октября 2026 в `Settings` лежало одно число — цель по заявкам. Теперь значение ключа `monthPlans` — `MonthPlan`: цель по сделкам, четыре норматива конверсии, средний чек, потолок CPL, режим разбивки, ручные веса недель и параметры мощности. Старое число читается как `manual: { leads: N }` (`normalizePlan`), поэтому прошлые месяцы не ломаются. Нормализация стоит и на входе API — с клиента приходит произвольный JSON.

**Метрики считаются вниз по воронке** от цели по сделкам (`planMetrics`): `pre = paid / pre2paid`, `held = pre / held2pre`, `app = held / app2held`, `leads = app / lead2app`. Значения из `manual` перекрывают рассчитанные — план может приходить сверху, а не выводиться из конверсий.

**Правка числа прямо в плитке** (`applyMetricEdit`). Правило, заданное владельцем: изменение одной суммы не двигает другие суммы — пересчитываются только проценты на стыках этой ступени. Поставили 1500 заявок вместо 1444 — назначенные, проведённые, предоплаты и цель стоят, а «заявка → назначено» становится 24,1 %. Правка «назначено» меняет две конверсии вокруг неё, правка оплат — `pre2paid` и `target`. Считается по неокруглённым ступеням (`rawMetrics`), иначе округление соседей ползёт при каждом редактировании. Деньги связаны множителем и потому ведут себя иначе: правка выручки меняет средний чек, правка бюджета — CPL, делится на округлённое число из плитки (иначе введённые $4 000 возвращаются как $3 999). Уведённые от норматива конверсии перечислены под плитками с кнопкой «Вернуть нормативы» (`convDrift`).

**План против факта.** Факт месяца — `monthFact`, из общей карточки. Сравнивается не с планом месяца, а с `planToDate`: ровная доля прошедших дней (сегодняшний день входит). Иначе первого числа всё было бы красным. Ровная, а не догоняющая разбивка — иначе провал первой недели задерёт планку текущей и отставание посчитается дважды. `metricStatus` даёт ✓ при выполнении, ≈ при 90–99 %, ✕ ниже; у рекламного бюджета знак обратный (`lowerIsBetter`): уложиться хорошо, перебрать плохо. Значки стоят в плитках, в колонке «Месяц» и в каждой недельной ячейке; прогноз на конец месяца по текущему темпу — строкой под плитками (`forecastMonth`).

**Продажи считаются по будням, заявки и расход — по календарю.** Факт сентября: в субботу и воскресенье ноль оплат, ноль проведённых собеседований, ноль выручки — а заявок приходит 13–24 % месячного потока, и реклама тратится все семь дней. Поэтому у `PLAN_METRICS` есть флаг `everyDay` (заявки и рекламный бюджет), а остальные метрики делятся и спрашиваются по рабочим дням (`isWorkday` — пн–пт). Это касается и распределения плана по неделям: короткая неделя 01.10–04.10 с двумя буднями получает план по оплатам как за два дня, а не за четыре. Раньше `workdays` исключал только воскресенье — по августовским данным суббота ещё работала, по сентябрьским уже нет.

**Факт внутри недели** сравнивается с её планом по доле прошедших дней (`elapsed` для заявок и расхода, `elapsedWork` для продаж), а не со всем недельным планом: у идущей недели иначе всегда горел бы крестик. У закрытой недели `elapsed` равен числу дней, поэтому сравнение идёт с полным планом, и рядом с фактом стоит отклонение. У недели, которая ещё не началась, факта нет вовсе — строка не рисуется.

**Про `manual` две ловушки, обе уже стреляли.** Деньги считаются от итоговых ступеней, а не от расчётных: иначе при ручной цели по заявкам бюджет брался от расчётного числа, и на экране «1 400 заявок» соседствовало с бюджетом на 1 806. И правка любого поля модели (цель, конверсии, чек, CPL) снимает `manual` целиком — `patchModel` в `plan-view`. Без этого залипшее из старого формата число заявок молча перекрывало расчёт: человек крутит конверсию, а цифра не двигается. Если ручное значение всё-таки стоит, плитка помечена «задано вручную».

**Факт по неделям не вводится руками** — берётся из уже посчитанного `DashData.marketing.overall` (`milestones[].weekValues` по именам стадий, `revenue.weekValues`, `spend.spent.weekValues`). Неделя закрывается сама, когда её последний день прошёл; у замороженного месяца закрыты все.

**Три режима разбивки** (`buildWeekPlan`):
- `even` — пропорционально дням недели, факт не влияет;
- `catch` (по умолчанию) — закрытые недели держат свой ровный план, а остаток цели (`план месяца − факт закрытых`) делится между открытыми по дням. Поэтому план впереди всегда сходится с целью: `факт закрытых + план открытых = цель`;
- `manual` — то же, но с множителем недели из `weights` (ключ — ISO первого дня недели).

**Вес принадлежит неделе, а не её состоянию.** Раньше закрытая неделя получала ровный план, и поставленный ей множитель 0,5 переставал действовать, как только она прошла: план прыгал со 103 на 194, а факт 102 получал крестик за план, которого этой неделе не ставили. Теперь закрытые недели тоже считаются по весам (`weightSum` по всем строкам), и множитель виден в шапке закрытой недели — иначе её план выглядит необъяснимым.

Сумма чисел по строке при этом расходится с планом месяца ровно на величину недобора — у закрытой недели показан её исходный план, а в итог идёт факт. Это не ошибка, под таблицей стоит пояснение.

**Проверка мощности** (`buildCapacity`) сверяет догоняющий план с двумя ограничениями: потолок заявок на ставку хантера (`hunters × cap ÷ callable`, по умолчанию 80 заявок со звонком на ставку) и слоты собеседований (`slots × рабочие дни недели`, воскресенье выходное). Узкими бывают оба ресурса по отдельности, поэтому подсказка разделена: `neededHunters` считается только при перегрузке по заявкам, `neededSlots` — при перегрузке по собеседованиям. Смешивать их нельзя: бывает неделя с 21 % загрузки обзвона и 227 % по слотам.

Вкладка «Обзор» больше не редактирует план — показывает цель из `planMetrics(data.plan).leads` и кнопку перехода на «План» (`onGoPlan`), чтобы источник плана был один.

**План ставится до начала месяца.** `getAvailableMonths` отдаёт 13 месяцев: следующий (с `future: true` и пометкой «· план» в подписи) плюс 12 прошедших. Дашборд по умолчанию открывает первый НЕ будущий месяц — иначе при загрузке показывался бы пустой следующий. На будущем месяце факт нулевой, поэтому «Обзор» не считает темп: статус заменяется на «Месяц ещё не начался», прогноз скрыт (иначе выходило бы «отстаём от плана» на месяце, который не начался).

### CRM → Каналы: эффективность источников
Отдельная вкладка `kanaly` (`components/crm/channels-table.tsx`, экспорт `ChannelsView`). Сначала жила блоком внутри «Маркетинга», но это самостоятельный вопрос — какой канал работает лучше, а не вступление к карточкам источников.

Сверху три вывода (`Findings`): где клиент дешевле всего, какой канал лучше доводит до оплаты, куда деньги уходят впустую. В лидеры по конверсии канал меньше 20 заявок не берётся — на пяти заявках «40 %» это случайность, а не канал. «Деньги впустую» = платный канал со сквозной ниже 0,8 средней (при равенстве — самый затратный), иначе самый большой поток заявок без единой оплаты.

Ниже таблица: строка на канал — заявки, конверсии «→ назначено» и «→ проведено», оплаты, сквозная заявка→оплата, расход, CPL, цена клиента, выручка, ROMI, доля в оплатах.

Берёт готовые `marketing.groups` и видимые `marketing.sources` (без тех, что входят в группы и исключённых) — ничего не пересчитывает с нуля. Ступени читаются по индексам `milestones`, оплаты — последняя ступень: у Instagram первая стадия называется иначе, по имени искать нельзя.

Пороги подсветки — не абсолютные, а относительно месяца: зелёная сквозная при ≥ 1,25 средней, красная при ≤ 0,6; цена клиента сравнивается со средней по платным каналам. ROMI зелёный от 400 %, красный ниже 100 %. Сортировка по цене клиента ставит нули (бесплатные каналы) в конец, иначе органика возглавляла бы рейтинг «самых дешёвых». Каналы меньше 5 заявок без оплат и расхода скрыты — это шум из опечаток в UTM.

### CRM: лист «Сделки» — это лог событий, а не список сделок
Одна карточка даёт строку на каждое изменение стадии, поэтому считать строки нельзя — получится число событий. `uniqueDeals` в `lib/crm/marketing.ts` оставляет одну строку на карточку, самую раннюю по времени: предоплата получена тогда, когда получена, а не когда отметку повторили.

**Предоплата считается только по воронке «Собеседование», и менять это нельзя.** Менеджер ставит стадию там, после чего карточка автоматически уезжает в «Продажи» с тем же названием стадии — это одно событие, а не два. Попытка считать обе воронки (5 октября 2026) была откачена: дедупликация по карточке тут не спасает, потому что повторная отметка приходит другим месяцем. Живой пример — сделка 12216: предоплата в «Собеседовании» 30 сентября, а в «Продажах» та же стадия всплыла 5 октября, уже после полной оплаты, и октябрь получил бы лишнюю предоплату.

Побочный эффект известен: сделки, заведённые сразу в «Продажах» (путь «Форма заполнена → Предоплата получена», минуя собеседование), в статистику предоплат не попадают — в сентябре таких было 13. Поправить это надёжно нельзя: после архивации месяца не видно, была ли у карточки отметка раньше.

`pipeline` у вехи с тех пор принимает и массив — на случай, если другая стадия действительно живёт в нескольких воронках.

Масштаб дублей по сентябрю: «Одобрен педсоветом» — 177 событий против **116** карточек, «Собеседование проведено» — 170 против 169, «Полная оплата есть» — 92 против 92 (там чисто, выручка не была завышена). Выручка и сводка продаж тоже пропущены через `uniqueDeals` на будущее.

Снимки месяцев, снятые до 5 октября 2026, посчитаны по старой методике — у сентября занижена предоплата и завышен педсовет. Пересчитываются только перезаписью снимка.

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

### CRM → Хантеры: работа каждого по дням, неделям и месяцу
Вкладка `hantery` (`components/crm/hunters-view.tsx`), сбор данных — `lib/crm/hunters.ts`, типы `HunterDay`, `HunterReport`, `HunterPlan`.

**Три источника, склеиваются только здесь.** Звонки и скорость реакции лежат в таблице «Интеграция B24 звонки» (`1Nq7EmiXI6r6MYoxENGX0TmIc_Qfpr9yDAVutRfNPZF8`, листы `Звонки` и `Реакция на лиды`), баллы за скрипт — в «Прогресс хантеров» (`1qQKO5-GGM-247j7ydiDOiEUg8QIWn2pNL_-web-L_f8`, лист `По дням`), заявки и собеседования — в рабочей таблице CRM. У сервисного аккаунта доступ ко всем трём есть.

Три грабли этих данных:
- колонка «Окно» в «Реакции» принимает `Рабочее время`, `Вне графика`, `Выходные` — сравнивать строгим равенством, подстрока «график» есть и во «Вне графика»;
- в «Прогрессе» имена короткие (только имя), в звонках и CRM полные — сводятся по первому слову;
- один набор не равен одному разговору: в октябре у одного хантера 5 265 наборов и 693 разговора, поэтому «звонки» всегда уточняются.

**Список хантеров — только в таблице** (`МаркетингРасходы`, K5:L5, `[{name, share}]`): репозиторий открытый, имена сотрудников в коде не держим. Пустая ячейка — вкладка без хантеров. До 24.10.2026 список был зашит в `DEFAULT_HUNTERS`, в тот день перенесён в таблицу один в один.

**Проведённое собеседование засчитывается тому, кто его назначил**, а не ответственному на карточке (там эксперт). Связь — по id карточки сделки через самое раннее событие «Собеседование назначено».

**Кэш 15 минут** (`getHunterReport`), потому что полный пересчёт читает 11 тысяч строк звонков и занимает около 4 секунд — это заметная доля месячного лимита Fluid Active CPU. Кнопка «Пересчитать» сбрасывает тег `crm-hunters:<месяц>`.

**Планы живут в настройках, а не в браузере** (`getHunterPlans`, лист `МаркетингРасходы`, ячейки K6:L6): планка должна быть одна у всех, кто открывает раздел. Дневные нормы при первом заходе множатся на долю ставки хантера, нормативы качества — нет: быстро отвечать и держать скрипт должен каждый одинаково. Состав хантеров и доли — `getHunters`, ячейки K5:L5.

Статусы считаются от плана: зелёный при выполнении, жёлтый от 70 %, красный ниже. Для реакции сравнение перевёрнуто. Недельная цель — дневная норма × рабочие дни недели, поэтому короткая неделя не требует полной.

## Демо-копия

Копия платформы для показа работодателям (решение Марлена 24.10.2026). Рабочая версия — боевая:
все изменения вносятся туда, демо только повторяет код и структуру базы, данных своих не хранит.

**Из чего состоит**

| | где |
|---|---|
| Сайт | https://taskhub-demo-sigma.vercel.app — проект Vercel `taskhub-demo`, тот же репозиторий и ветка `main` |
| База | Supabase `taskhub-dev`, ref `jvjvugitvnowwfibrplp` |
| Пересборка | `scripts/demo-sync.py`, launchd `~/Library/LaunchAgents/local.taskhub-demo-sync.plist` |
| Данные | `scripts/demo_data.py` (задачи, расходы, ученики), `lib/demo/crm-sheets.ts` (листы CRM) |
| Журнал | `~/Library/Logs/taskhub-demo-sync.log`; при сбое — уведомление macOS «Демо TaskHub» |

**Вход для работодателей — без пароля:** https://taskhub-demo-sigma.vercel.app/api/demo (24.10.2026). Эту
ссылку и ставим в профили, резюме и Notion; сам пароль нигде не публикуем. Устроено в два шага:
- `app/api/demo/route.ts` — лёгкая страница 200: `<title>`, `og:title`/`og:description`/`og:url`,
  `noindex`, кнопка «Open the demo» и скрипт `location.replace('/api/demo/enter')`. Браузер уходит на вход
  сразу, боты превью скриптов не выполняют и берут карточку. Картинки `og:image` нет — в `public/`
  подходящей не нашлось. Раньше вход был прямо здесь (307 с кукой сессии ~4 КБ и переход на тяжёлый
  `/dashboard`), и превью-боты ссылку не открывали: Upwork писал «We can't access the link», LinkedIn
  Featured сохранял `/login`.
- `app/api/demo/enter/route.ts` — сам вход под `demo@taskhub.local` паролем из переменной `DEMO_PASSWORD`
  проекта Vercel `taskhub-demo`, затем `/dashboard`; если пароль общей учётки всё же сменили — возвращает
  его сервисным ключом (`createUnguardedAdminClient`) и входит снова.

Оба без `DEMO_MODE=1` отдают 404. На `/login` демо-сайта — кнопка «Войти в демо без пароля» (ведёт на
`/api/demo`). Сменился `DEMO_PASSWORD` в `.env.local.dev` — обновить и переменную у `taskhub-demo`.

**Вход:** `demo@taskhub.local` — администратор «Дана Алиева», видит всё. Пароль — `DEMO_PASSWORD` в
`.env.local.dev`, он общий для всех 16 демо-учёток `<логин>@taskhub.local` (логины — `LYUDI` в
`demo_data.py`). Под `saule@` видно, как платформу видит сотрудник без CRM; под `asel@` —
маркетолог с CRM; `nurlan@` — бухгалтерия с правом оплаты.

**Что происходит раз в неделю** — первым запуском новой недели (launchd стартует скрипт каждое утро в
07:00 или при пробуждении Мака; в остальные дни он только пингует базу):
1. С боевой базы снимается схема (`scripts/baseline.py`) — через read-only эндпоинт Management API
   (`scripts/supabase_api.py`), запросы идут от `supabase_read_only_user` в read-only транзакции.
2. В демо-базе удаляется всё из `public` и накатывается свежая схема: новые таблицы, колонки,
   функции, политики доезжают сами.
3. Учётки приводятся к списку `LYUDI`: недостающие создаются, лишние (кто зарегистрировался в
   демо) удаляются, пароли сбрасываются. Вложения в бакете стираются.
4. Заливаются вымышленные данные с датами от сегодняшнего дня: текущий спринт всегда на этой
   неделе, десять закрытых недель истории, бэклог, расходы, инструкции, уведомления, ученики.
   Затем у ролей `anon` и `authenticated` отбирается запись в `public` («Только просмотр» ниже).
5. Сбрасывается кэш сайта: `POST DEMO_URL/api/revalidate` с `Authorization: Bearer DEMO_CRON_SECRET`
   и списком тегов. Без этого `unstable_cache` показывал бы прошлую неделю бесконечно.

Почему раз в неделю: так решил Марлен — TaskHub меняется не каждый день. Пересборка в начале недели
держит текущий спринт в пределах календарной недели. Цена: внутри недели данные не двигаются, спринт
в пятницу выглядит так же, как в понедельник утром. Посетители ничего не меняют — сайт только для просмотра (ниже).
Нужна пересборка раньше (показ, свежая доработка в бою) — `python3 scripts/demo-sync.py`.

**Что не копируется с боя:** строки таблиц (задачи, люди, расходы, разборы звонков, предложения),
`app_settings` (вебхук Битрикса, ключ Claude), `access_settings`. Компания и люди в демо
выдуманные, имена сверены с боевыми профилями — совпадений нет.

**DEMO_MODE=1** (переменная только у проекта `taskhub-demo`, проверка — `isDemo()` из `lib/demo/mode.ts`):
- `lib/crm/sheets.ts` отдаёт листы из `lib/demo/crm-sheets.ts`: «Лиды», «Сделки», «Воронки»,
  «МаркетингРасходы» (расходы, курс, настройки K1–K6), «Snapshots», а из таблиц хантеров —
  «Звонки», «Реакция на лиды», «По дням». Генерируются при первом обращении за день, хранятся в
  памяти экземпляра функции. Запись в них на демо-сайте запрещена (см. «Только просмотр» ниже).
- Хантеры в демо — `Мадина Нурланова`, `Тимур Беков`, `Камила Рахимова` (лист K5:L5), без них
  подставились бы `DEFAULT_HUNTERS` из `settings.ts` — там настоящие имена.
- `syncStudentMoves` сразу выходит: иначе `reviewRecentMoves` переписал бы выдуманные движения
  в «сделка удалена или объединена». Ученики берутся из таблиц, которые заливает `demo_data.py`.
- В меню нет подсказчика и предложений (они на Google-таблицах Globalos), логотип «taskhub · демо»,
  ссылки на сделки Битрикса в «Учениках» выключены.
- Ключей Google у демо-сайта нет вовсе — ни одна ветка кода не может дойти до таблиц Globalos.

**Только просмотр** (24.10.2026, просьба Марлена: работодатель смотрит, но ничего не меняет).
Раньше посетитель мог создавать и править задачи, проекты, расходы, статьи, пользователей —
правки жили до пересборки и их видели следующие гости.

- **Где режется.** `lib/demo/read-only.ts`, `readOnlyFetch` — свой `fetch` для клиентов Supabase.
  Подключён в `createAdminClient()` (`lib/supabase/admin.ts`), серверном `createClient()`
  (`lib/supabase/server.ts`) и браузерном (`lib/supabase/client.ts`) — только при `isDemoReadOnly()`,
  на проде опции клиентов прежние. Права в базе не помогли бы: почти все действия пишут сервисным
  ключом. GET/HEAD проходят; любой другой метод получает ответ 403 `DEMO_READ_ONLY`
  («Демо-режим: только просмотр, изменения не сохраняются»), не уходя в сеть. Это REST
  insert/update/upsert/delete, **любой POST к rpc** (читающую rpc звать с `{ get: true }`),
  storage upload/update/move/copy/remove/createSignedUploadUrl, все `auth.admin` кроме чтения,
  `signUp`, `updateUser`, `resetPasswordForEmail`, OTP. Пропускаются: `/auth/v1/token` (вход,
  обновление токена), `/auth/v1/verify`, подписанные ссылки и список файлов хранилища.
  Выход (`/auth/v1/logout`) получает «готово» без запроса к серверу: учётка общая, `signOut()` со
  scope=global выбил бы всех, кто сейчас смотрит демо. Библиотеки превращают ответ в обычный
  `{ error }` — код действий не менялся: проверяющие запись бросают ошибку, остальные «успешно»
  ничего не делают.
- **Чтения работают:** `fetchTasksForUser(s)`, `getComments`, `getActivities`, `getNotifications`,
  `getTaskDrawerData`, `getTaskForDrawer`, `getMyProfile`, `getPendingUsersCount`, `fetchExpenseFeed`,
  `fetchArticleReaders`, `getTasksMissingData` — внутри только select. Записей при загрузке страниц
  (page/layout/lib/queries) нет; проверено 24.10.2026.
- **Интерфейс.** Над страницами — плашка `components/demo/read-only-bar.tsx` (в
  `app/(dashboard)/layout.tsx`, только в демо). На каждую попытку изменить — всплывающая подсказка
  с тем же текстом. Как она узнаёт:
  - упавший server action (статус 500): Next в продакшене прячет текст ошибки («An error occurred
    in the Server Components render…»), поэтому плашка подменяет такой ответ на `text/plain` с
    текстом демо — его Next отдаёт в `catch` как есть, и окна (инструкции, расходы и т. п.)
    показывают понятную ошибку вместо английской заглушки;
  - действие не проверило результат записи и ответило «успех»: сервер ставит куку
    `taskhub_demo_blocked` (`lib/demo/read-only-server.ts`), плашка её читает и стирает;
  - `/api/crm` POST отвечает 403 с заголовком `X-Demo-Read-Only: 1`;
  - браузерный клиент Supabase шлёт событие `taskhub:demo-blocked`.
  Оптимистичные правки у действий без отката остаются на экране до перезагрузки — подсказка
  объясняет, что они не сохранены. Восстановление из корзины (`startTransition`) в демо ошибку
  глотает, иначе страница ушла бы в `error.tsx`. Регистрация, «Забыли пароль» и смена пароля
  показывают текст демо в своей строке ошибки.
- **Браузеру признак нужен при сборке:** `next.config.ts` → `env.TASKHUB_DEMO_READ_ONLY`
  (из `DEMO_MODE` и `DEMO_WRITABLE`). Переменная `DEMO_MODE` у `taskhub-demo` доступна сборке
  (тип plain, production + preview).
- **Остальное:** `/api/crm` POST — 403 сразу; запись в листы CRM (`lib/crm/sheets.ts`) бросает
  `DemoReadOnlyError`; кроны `auto-fix-sprints` и `freeze` в демо выходят сразу (спринты,
  уведомления и снимки там такие, какими их залила пересборка).
- **Исключение одно:** `createUnguardedAdminClient()` — только для `app/api/demo/enter/route.ts`
  (вернуть пароль общей учётки). Больше нигде.
- **Второй рубеж — права демо-базы:** `scripts/demo-sync.py` после заливки отбирает у `anon` и
  `authenticated` INSERT/UPDATE/DELETE/TRUNCATE в `public` (константа `TOLKO_CHTENIE`, применено
  и 24.10.2026 вручную). Это закрывает прямые запросы к REST с публичным ключом и токеном
  демо-учётки мимо приложения. Сервисный ключ не затронут. Хранилище не закрыто: политика
  «auth users can upload attachments» на `storage.objects` осталась — файл, залитый напрямую,
  ни на что не ссылается и стирается пересборкой.
- **Новый способ записи** не через клиенты Supabase (Google-таблицы, внешние API, память
  экземпляра) обязан сам проверять `isDemoReadOnly()` или `assertDemoWritable()`.
- **Разрешить запись на время разработки.** Локально на демо-базе (`cp .env.local.dev .env.local`)
  `DEMO_MODE` не задан — запрет не действует, всё пишется как раньше. Нужно проверить демо-сайт
  с записью — запустить с `DEMO_MODE=1 DEMO_WRITABLE=1` (на Vercel `DEMO_WRITABLE` не ставить).
  Писать в демо-базу токеном пользователя мимо сервисного ключа (обычно не нужно) — вернуть права
  до пересборки: `grant insert, update, delete, truncate on all tables in schema public to anon,
  authenticated;` через `scripts/supabase_api.py` (`query(DEV_REF, ..., write=True)`).
- **Проверить вживую** без пуша: собрать с ключами демо-базы и `DEMO_MODE=1` (переменные окружения
  важнее `.env.local`, его не трогать), `next start -p 3005`, войти через `/api/demo`. После —
  обычная сборка, иначе в `.next` останется демо-версия.

**Добавил раздел или таблицу в бою** — допиши данные в `demo_data.py` (или генератор в
`lib/demo/`), иначе в демо раздел пустой. Колонка NOT NULL без default, которую генератор не
заполняет, уронит пересборку: придёт уведомление, в журнале будет ошибка вставки.

**Руками:** `python3 scripts/demo-sync.py` — пересобрать сейчас; `--ping` — только разбудить базу.
Бесплатный проект Supabase засыпает после недели без запросов — ежедневный пинг это и предотвращает.

### Английская версия (демо)
С 24.10.2026 демо-копия по-английски — её показывают иностранным работодателям. Язык задаётся при
сборке: `NEXT_PUBLIC_LOCALE=en` есть только у проекта Vercel `taskhub-demo`, в бою переменной нет.

- `lib/i18n/index.ts`: `t(ru, params?)` — ключ словаря сама русская строка, подстановки `{n}`;
  `tc(ctx, ru)` — ищет `ctx|ru` («заявка» — lead в CRM, request в расходах); `plural(n, one, few, many, ctx?)`;
  `INTL_LOCALE`; `numericDate(ru, date, withYear)` — даты, которые русский интерфейс пишет цифрами.
- Словари: `lib/i18n/en/common.ts` (глоссарий: меню, статусы, приоритеты, месяцы, дни) и по разделу —
  `shell`, `tasks`, `workspace` (аналитика, расходы, уведомления), `crm`, `demo`. Подключаются в
  `lib/i18n/en/index.ts`; при совпадении ключа побеждает подключённый позже, поэтому короткие общие
  слова в CRM идут через `tc('crm', …)`.
- Стадии и воронки CRM в `lib/crm` — данные, с ними сравнивает расчёт; переводятся только при выводе
  (`t(stage.name)`). Поэтому генератор `lib/demo/crm-sheets.ts` пишет стадии по-русски, а заголовки,
  источники и имена — по-английски. Отделы демо — английские, `canAccessCrm` знает Sales и Marketing.
- Проверка перевода (так делали 24.10): обойти все экраны демо в английском и искать кириллицу; на тех
  же данных снять русский текст до и после правки и сравнить побуквенно — бой не должен измениться.

### Закрытый /api/crm
`proxy.ts` пропускает `/api/*` без проверки (matcher исключает `api`). До 24.10.2026 `/api/crm`
отдавал без входа цифры CRM, отчёт по хантерам (имена и показатели) и принимал POST — заморозку
месяцев, планы, расходы. Теперь `allowed()` в начале GET и POST: вход через `auth.getUser()`,
активный профиль и `canAccessCrm`. Новые маршруты API с данными — так же.

### RLS: рекурсия в project_members
До 24.10.2026 политики `project_members` ссылались на саму `project_members`, и любой запрос к задачам,
проектам, спринтам и комментариям от имени пользователя падал с 42P17. Приложение этого не видело —
эти таблицы оно читает сервисным ключом, — но RLS как второй рубеж не работал. Миграция
`20261024100000_project_members_rls_recursion.sql`: проверка членства в security definer функциях
`is_project_member` / `is_project_owner`, они читают таблицу в обход RLS и рвут цикл. Там же закрыты
две дыры `members_insert`: сравнение `project_id` с самим собой (владелец любого проекта мог добавлять
людей в любой) и ветка «вписать себя куда угодно». Проверено на демо-базе токенами сотрудников:
участник видит задачи только своих проектов, вписать себя в чужой проект не может.

Попутно: публикация `supabase_realtime` пустая, поэтому подписка на новые комментарии в
`comments-section.tsx` не получает событий — живого обновления комментариев нет, только при открытии.

### /api/version
`GET /api/version` → `{ commit, env, demo }`: какой коммит на деплое. Проверка «доехало ли» без
входа: сравнить `commit` с `git rev-parse HEAD`. Работает и для демо-сайта.
