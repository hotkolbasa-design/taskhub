-- Политики project_members ссылались на саму project_members, поэтому любой запрос к задачам,
-- проектам, спринтам и комментариям от имени пользователя падал с 42P17 «infinite recursion
-- detected in policy». Приложение этого не замечало — эти таблицы оно читает сервисным ключом, —
-- но второй рубеж защиты фактически не работал: прямой запрос с ключом anon получал ошибку
-- вместо данных по случайности, а не по правилам.
--
-- Проверка членства переезжает в security definer функции: они читают project_members в обход
-- RLS, и цикл разрывается. Политики остальных таблиц не меняются — их подзапросы к
-- project_members теперь проходят через members_select без рекурсии.
--
-- Заодно две дыры в members_insert:
--   * сравнивалось project_members_1.project_id само с собой — добавлять участников в любой
--     проект мог владелец любого другого проекта;
--   * ветка «auth.uid() = user_id» позволяла любому вошедшему вписать себя в чужой проект.
-- Теперь добавлять и удалять участников по правилам может только владелец проекта. Приложение
-- делает это сервисным ключом и правилами не ограничено.

create or replace function public.is_project_member(pid uuid, uid uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from project_members where project_id = pid and user_id = uid)
$$;

create or replace function public.is_project_owner(pid uuid, uid uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from project_members where project_id = pid and user_id = uid and role = 'owner')
$$;

drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members for select
  using (user_id = auth.uid() or public.is_project_member(project_id, auth.uid()));

drop policy if exists members_insert on public.project_members;
create policy members_insert on public.project_members for insert
  with check (public.is_project_owner(project_id, auth.uid()));

drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members for delete
  using (public.is_project_owner(project_id, auth.uid()));
