-- Бухгалтерии нужно видеть все заявки на расходы: они их оплачивают.
-- Решать (одобрять и отклонять) при этом по-прежнему могут только утверждающие,
-- поэтому право отдельное, а не расширение can_approve_expenses.
alter table profiles add column if not exists can_pay_expenses boolean not null default false;

-- Кто видит весь список: админ, утверждающий и бухгалтерия
create or replace function can_see_all_expenses(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin' or p.can_approve_expenses or p.can_pay_expenses
     from profiles p where p.id = uid),
    false
  )
$$;

-- Кто может отмечать оплату: утверждающие и бухгалтерия
create or replace function can_pay_expenses(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin' or p.can_approve_expenses or p.can_pay_expenses
     from profiles p where p.id = uid),
    false
  )
$$;

drop policy if exists "expense_requests_select" on expense_requests;
create policy "expense_requests_select" on expense_requests
  for select using (requester_id = auth.uid() or can_see_all_expenses(auth.uid()));

-- Оплату проставляет бухгалтерия, поэтому право на update шире, чем право решать.
-- Какие именно поля меняются, проверяется в server actions
drop policy if exists "expense_requests_update" on expense_requests;
create policy "expense_requests_update" on expense_requests
  for update using (
    (requester_id = auth.uid() and status in ('pending', 'needs_info'))
    or can_see_all_expenses(auth.uid())
  );

drop policy if exists "expense_request_comments_select" on expense_request_comments;
create policy "expense_request_comments_select" on expense_request_comments
  for select using (
    exists (
      select 1 from expense_requests r
      where r.id = request_id
        and (r.requester_id = auth.uid() or can_see_all_expenses(auth.uid()))
    )
  );

drop policy if exists "expense_request_comments_insert" on expense_request_comments;
create policy "expense_request_comments_insert" on expense_request_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from expense_requests r
      where r.id = request_id
        and (r.requester_id = auth.uid() or can_see_all_expenses(auth.uid()))
    )
  );

drop policy if exists "expense_request_activities_select" on expense_request_activities;
create policy "expense_request_activities_select" on expense_request_activities
  for select using (
    exists (
      select 1 from expense_requests r
      where r.id = request_id
        and (r.requester_id = auth.uid() or can_see_all_expenses(auth.uid()))
    )
  );
