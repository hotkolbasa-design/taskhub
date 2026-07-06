create table if not exists task_activities (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  actor_id    uuid references profiles(id) on delete set null,
  type        text not null, -- 'status_change' | 'deadline_change' | 'time_change'
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);

create index if not exists task_activities_task_id_idx on task_activities(task_id);
create index if not exists task_activities_created_at_idx on task_activities(created_at);

alter table task_activities enable row level security;

-- Читать может любой авторизованный пользователь
create policy "task_activities_select" on task_activities
  for select using (auth.role() = 'authenticated');

-- Вставлять только через сервис (admin client)
create policy "task_activities_insert" on task_activities
  for insert with check (auth.role() = 'service_role');
