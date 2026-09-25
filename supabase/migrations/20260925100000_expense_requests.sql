-- Заявки на расходы: отдел просит купить, утверждающие разбирают их раз в неделю.
-- Сотрудник видит только свои заявки, админы и держатели флага can_approve_expenses — все.

-- Право утверждать расходы, не открывая остальную админку:
-- учредителю нужен этот раздел целиком, но не пользователи и не CRM
alter table profiles add column if not exists can_approve_expenses boolean not null default false;

create sequence if not exists expense_request_number_seq;

create table if not exists expense_requests (
  id uuid primary key default gen_random_uuid(),
  -- Номер для разговора и переписки: «что там с ЗР-0042»
  number text unique not null default 'ЗР-' || lpad(nextval('expense_request_number_seq')::text, 4, '0'),
  requester_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  justification text,
  category text not null default 'other',
  -- equipment | software | services | office | marketing | other
  amount numeric(14,2) not null default 0,
  currency text not null default 'KZT',
  -- Копия отдела на момент подачи: человек может перейти в другой, а заявка остаётся за прежним
  department text,
  needed_by date,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  -- pending | approved | rejected | needs_info | cancelled
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  -- Оплата — отдельный шаг после одобрения, поэтому не статус, а свои поля.
  -- paid_amount отдельно от amount: запросили 2 млн, купили за 1,8
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  paid_amount numeric(14,2),
  paid_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expense_requests_requester_idx on expense_requests(requester_id);
create index if not exists expense_requests_status_idx on expense_requests(status, created_at desc);
create index if not exists expense_requests_created_idx on expense_requests(created_at desc);

drop trigger if exists expense_requests_updated_at on expense_requests;
create trigger expense_requests_updated_at
  before update on expense_requests
  for each row execute function update_updated_at();

create table if not exists expense_request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references expense_requests(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists expense_request_comments_request_idx on expense_request_comments(request_id, created_at);

-- Журнал решений: кто подал, кто одобрил, кто поправил сумму. Показывается в одной ленте с комментариями
create table if not exists expense_request_activities (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references expense_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  -- created | status_changed | edited | paid | payment_undone
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index if not exists expense_request_activities_request_idx on expense_request_activities(request_id, created_at);

alter table notifications add column if not exists expense_request_id uuid references expense_requests(id) on delete cascade;
create index if not exists notifications_expense_request_idx on notifications(expense_request_id);

-- ─── Права ───────────────────────────────────────────────────────────────────
-- Приложение ходит в базу сервисным ключом и проверяет права в server actions.
-- RLS здесь — второй рубеж: речь о деньгах, и чужую заявку база не должна отдавать,
-- даже если в коде когда-нибудь появится дыра.

create or replace function can_approve_expenses(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin' or p.can_approve_expenses from profiles p where p.id = uid),
    false
  )
$$;

alter table expense_requests enable row level security;
alter table expense_request_comments enable row level security;
alter table expense_request_activities enable row level security;

drop policy if exists "expense_requests_select" on expense_requests;
create policy "expense_requests_select" on expense_requests
  for select using (requester_id = auth.uid() or can_approve_expenses(auth.uid()));

drop policy if exists "expense_requests_insert" on expense_requests;
create policy "expense_requests_insert" on expense_requests
  for insert with check (requester_id = auth.uid());

-- Автор правит заявку, пока она не решена; утверждающий — в любой момент
drop policy if exists "expense_requests_update" on expense_requests;
create policy "expense_requests_update" on expense_requests
  for update using (
    (requester_id = auth.uid() and status in ('pending', 'needs_info'))
    or can_approve_expenses(auth.uid())
  );

drop policy if exists "expense_request_comments_select" on expense_request_comments;
create policy "expense_request_comments_select" on expense_request_comments
  for select using (
    exists (
      select 1 from expense_requests r
      where r.id = request_id
        and (r.requester_id = auth.uid() or can_approve_expenses(auth.uid()))
    )
  );

drop policy if exists "expense_request_comments_insert" on expense_request_comments;
create policy "expense_request_comments_insert" on expense_request_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from expense_requests r
      where r.id = request_id
        and (r.requester_id = auth.uid() or can_approve_expenses(auth.uid()))
    )
  );

drop policy if exists "expense_request_activities_select" on expense_request_activities;
create policy "expense_request_activities_select" on expense_request_activities
  for select using (
    exists (
      select 1 from expense_requests r
      where r.id = request_id
        and (r.requester_id = auth.uid() or can_approve_expenses(auth.uid()))
    )
  );
