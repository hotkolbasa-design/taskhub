-- Уведомления не создавались НИ РАЗУ с момента появления функции: код пишет actor_id и data,
-- а в таблице этих колонок нет. PostgREST отклонял вставку целиком (PGRST204), ошибка
-- терялась, потому что результат insert не проверялся. Таблицу когда-то завели вручную,
-- а миграция 20260707120000_notifications.sql с CREATE TABLE IF NOT EXISTS прошла вхолостую.

-- Кто совершил действие: нужен, чтобы показать «Марлен назначил вас исполнителем».
-- Ссылка именно на profiles, а не на auth.users: колокольчик подтягивает имя автора
-- через этот внешний ключ (profiles!notifications_actor_id_fkey), и на auth.users
-- PostgREST такую связь не находит.
alter table notifications add column if not exists actor_id uuid;
alter table notifications drop constraint if exists notifications_actor_id_fkey;
alter table notifications add constraint notifications_actor_id_fkey
  foreign key (actor_id) references profiles(id) on delete set null;

-- Подробности события (название задачи, старый и новый статус, номер заявки на расход)
alter table notifications add column if not exists data jsonb;

create index if not exists notifications_actor_idx on notifications(actor_id);

-- Вторая причина того же сбоя: CHECK на типе остался от ранней версии и разрешал
-- только assigned/commented/sprint_fixed/mentioned. Код давно шлёт другие имена,
-- поэтому каждая вставка падала ещё и на 23514. Приводим список к тому, что есть в коде.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in (
  'task_assigned',
  'assignee_changed',
  'creator_changed',
  'status_changed',
  'comment_added',
  'deadline_soon',
  'deadline_overdue',
  'expense_submitted',
  'expense_decided',
  'expense_comment',
  'expense_paid'
));
