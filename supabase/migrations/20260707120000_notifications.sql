-- Таблица уведомлений
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  type text NOT NULL,
  -- 'task_assigned' | 'assignee_changed' | 'creator_changed'
  -- | 'status_changed' | 'comment_added'
  -- | 'deadline_soon' | 'deadline_overdue'
  data jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_task_id_idx ON notifications(task_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои уведомления
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Пользователь может пометить свои уведомления прочитанными
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Добавить assignee_change и creator_change в activity log (комментарий для документации)
-- Эти типы добавляются программно в updateTask action
