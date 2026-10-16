# TaskHub

## Правила
- Действовать без запроса разрешения: читать/редактировать файлы, создавать компоненты, запускать команды, устанавливать пакеты, делать commit/push. Просто делать → потом сообщать.
- Исключение: деструктивные необратимые действия (удаление БД, force push на main).
- При изменении логики/архитектуры/дизайна → сразу обновить CLAUDE.md или CLAUDE_REFERENCE.md.

## Среда
- Локально: `npm run dev -- -p 3001` → **http://localhost:3001** (3000 занят другим проектом)
- Supabase project ID: `zsmhyuvxldwedshjmvjg`
- Время задач — всегда **минуты** (integer) в БД. Конвертация: `lib/utils/time.ts`
- `middleware.ts` → переименован в `proxy.ts` (экспортирует `proxy`, не `middleware`)
- Маршрут без авторизации → обязательно в `publicRoutes` (`proxy.ts`), иначе редирект на `/login`. Восстановление пароля — в CLAUDE_REFERENCE.md
- `/api/*` proxy не проверяет. `/api/zvonok?id=&k=` — публичная страница расшифровки звонка Globalos (ссылки из таблицы «Интеграция B24 звонки»); данные берёт у Apps Script-просмотрщика, подпись `k` проверяет он
- `/api/zvonok?...&review=1` — разбор звонка по скрипту (Claude, `lib/zvonok/review.ts`), кэш — таблица `call_reviews` (миграция `20261013200000_call_reviews.sql`, применена `supabase db query`). Колонка разбора встраивается в страницу расшифровки скриптом `REVIEW_UI`; данные реплик приходят от Apps Script в поле `call`
- Подсказчик: POST `{act:'suggest'}` — предложение правки скрипта хантером → таблица `script_suggestions` (миграция `20261013210000`), раздел **`/predlozheniya`** (видят как CRM, решают админы: new/approved/rejected/applied + решение для хантера; `plan` — план правки от Claude, вносится только после «Одобрить»), `?mine=1` — свои предложения в подсказчике
- `/podskazchik` — подсказчик хантера Globalos под аккаунтом (доступ как к CRM: `canAccessCrm`), открывается из меню в новой вкладке; без входа proxy уводит на `/login?next=/podskazchik`, login возвращает на `next` (только внутренний путь). Запасной вход без аккаунта — `/api/podskazchik?h=<код>` (скрипт звонка и ответы на возражения). База — Google-таблица `16ylUmoP7g8V71bz3I6vN10AKgw1ez07waWjLh1KTYV4` (сервисный аккаунт — редактор), коды хантеров — лист «Хантеры», журнал — «Журнал». `lib/podskazchik/page.ts` генерируется скриптом `v_taskhub.py` из `~/Desktop/Globalos/Отдел продаж и маркетинг/Подсказчик хантера/Исходники/страница.html` — руками не править. ИИ-подбор включается ключом `app_settings.anthropic_api_key`

## Запреты UI
- Нативный `<select>` — **ЗАПРЕЩЁН** → кастомный дропдаун (паттерн в CLAUDE_REFERENCE.md)
- `<input type="date">` — **ЗАПРЕЩЁН** → кастомный DatePicker (`components/backlog/create-task-modal.tsx`)
- Дропдауны внутри `overflow`-контейнеров → **обязательно** `createPortal` + `position: fixed`
- Любой дропдаун в портале → **обязательно** `useKeepInView(open, dropRef, triggerRef)` (`components/common/use-keep-in-view.ts`): у карточки внизу экрана список уходил за край, а прокрутить его нельзя — он вне потока страницы и закрывается на скролл
- Любая кнопка/кликабельный элемент → `cursor: pointer`
- При любой новой функции → индикатор загрузки (кнопки: `disabled` + спиннер, навигация: `NavigationLoader`)
- Оптимистичные обновления: UI меняется мгновенно, сервер обновляется фоном, rollback при ошибке

## DnD — критические правила (@dnd-kit)
- **НИКОГДА** DOM-элемент как индикатор позиции → бесконечный цикл через layout detection. Только `box-shadow`: `'0 -3px 0 0 var(--accent)'` (перед) / `'0 3px 0 0 var(--accent)'` (после).
- **НИКОГДА** `setTasks` в `handleDragOver` → только refs + `applyDragPreview` с equality-check.

## Код
- TypeScript везде, `'use client'` только где нужна интерактивность
- Запросы к БД → `lib/queries/`, не писать SQL в компонентах
- Цвета → только CSS переменные (список в CLAUDE_REFERENCE.md)
- Комментарии только если WHY неочевиден

## Детали, паттерны, схема БД → CLAUDE_REFERENCE.md
