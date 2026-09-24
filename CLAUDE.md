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

## Запреты UI
- Нативный `<select>` — **ЗАПРЕЩЁН** → кастомный дропдаун (паттерн в CLAUDE_REFERENCE.md)
- `<input type="date">` — **ЗАПРЕЩЁН** → кастомный DatePicker (`components/backlog/create-task-modal.tsx`)
- Дропдауны внутри `overflow`-контейнеров → **обязательно** `createPortal` + `position: fixed`
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
