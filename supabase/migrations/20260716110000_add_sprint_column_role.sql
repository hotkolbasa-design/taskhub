alter table sprint_columns
  add column if not exists role text check (role in ('todo', 'done'));

-- Отмечаем существующие колонки по имени
update sprint_columns set role = 'todo' where name = 'К выполнению';
update sprint_columns set role = 'done' where name = 'Готово';
