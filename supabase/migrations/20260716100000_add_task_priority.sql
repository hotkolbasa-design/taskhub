alter table tasks
  add column if not exists priority text check (priority in ('medium', 'high'));
