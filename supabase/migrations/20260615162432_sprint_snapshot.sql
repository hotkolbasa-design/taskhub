ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS fixed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fixed_task_ids uuid[] DEFAULT '{}';
