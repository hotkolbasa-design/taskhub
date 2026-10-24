-- Полная схема TaskHub, снятая с базы zsmhyuvxldwedshjmvjg 24.10.2026.
--
-- Применяется целиком и повторно: supabase db query --linked -f supabase/baseline.sql
-- Пересобирается скриптом scripts/dump-schema.py после изменений схемы в проде.


-- ======================================================================
-- РАСШИРЕНИЯ (4)
-- ======================================================================

create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- ======================================================================
-- ПОСЛЕДОВАТЕЛЬНОСТИ — на них ссылаются значения по умолчанию, поэтому идут до таблиц (2)
-- ======================================================================

create sequence if not exists public.script_suggestions_id_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 no cycle;
create sequence if not exists public.expense_request_number_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 no cycle;

-- ======================================================================
-- ТАБЛИЦЫ (21)
-- ======================================================================

create table if not exists public.access_settings (
  id uuid default extensions.uuid_generate_v4() not null,
  user_id uuid not null,
  visible_user_ids uuid[] default '{}'::uuid[]
);
create table if not exists public.app_settings (
  key text not null,
  value text not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.article_reads (
  id uuid default gen_random_uuid() not null,
  article_id uuid not null,
  user_id uuid not null,
  version integer not null,
  read_at timestamp with time zone default now() not null
);
create table if not exists public.articles (
  id uuid default gen_random_uuid() not null,
  title text not null,
  summary text,
  content text default ''::text not null,
  category text default 'taskhub'::text not null,
  status text default 'draft'::text not null,
  is_required boolean default false not null,
  departments text[] default '{}'::text[] not null,
  version integer default 1 not null,
  author_id uuid,
  published_by uuid,
  published_at timestamp with time zone,
  attachments jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.call_reviews (
  call_id text not null,
  review jsonb not null,
  model text not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.comments (
  id uuid default extensions.uuid_generate_v4() not null,
  task_id uuid not null,
  author_id uuid not null,
  text text not null,
  attachments jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now()
);
create table if not exists public.expense_request_activities (
  id uuid default gen_random_uuid() not null,
  request_id uuid not null,
  actor_id uuid,
  type text not null,
  old_value text,
  new_value text,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.expense_request_comments (
  id uuid default gen_random_uuid() not null,
  request_id uuid not null,
  author_id uuid not null,
  text text not null,
  attachments jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.expense_requests (
  id uuid default gen_random_uuid() not null,
  number text default ('ЗР-'::text || lpad((nextval('expense_request_number_seq'::regclass))::text, 4, '0'::text)) not null,
  requester_id uuid not null,
  title text not null,
  justification text,
  category text default 'other'::text not null,
  amount numeric(14,2) default 0 not null,
  currency text default 'KZT'::text not null,
  department text,
  needed_by date,
  attachments jsonb default '[]'::jsonb not null,
  status text default 'pending'::text not null,
  decided_by uuid,
  decided_at timestamp with time zone,
  decision_note text,
  paid_at timestamp with time zone,
  paid_by uuid,
  paid_amount numeric(14,2),
  paid_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.notifications (
  id uuid default extensions.uuid_generate_v4() not null,
  user_id uuid not null,
  type text not null,
  task_id uuid,
  is_read boolean default false,
  created_at timestamp with time zone default now(),
  expense_request_id uuid,
  actor_id uuid,
  data jsonb,
  article_id uuid
);
create table if not exists public.profiles (
  id uuid not null,
  full_name text not null,
  login text not null,
  role text default 'employee'::text not null,
  status text default 'pending'::text not null,
  avatar_url text,
  created_at timestamp with time zone default now(),
  "position" text,
  birth_date date,
  department text,
  can_approve_expenses boolean default false not null,
  can_pay_expenses boolean default false not null
);
create table if not exists public.project_members (
  id uuid default extensions.uuid_generate_v4() not null,
  project_id uuid not null,
  user_id uuid not null,
  role text default 'member'::text not null
);
create table if not exists public.projects (
  id uuid default extensions.uuid_generate_v4() not null,
  name text not null,
  description text,
  color text default '#4F8EF7'::text,
  default_assignee_mode text default 'manual'::text,
  default_assignee_id uuid,
  week_cycle_type text default 'mon-sun'::text,
  default_deadline text default 'last-day'::text,
  auto_recurring boolean default false,
  created_by uuid not null,
  created_at timestamp with time zone default now()
);
create table if not exists public.script_suggestions (
  id bigint not null,
  created_at timestamp with time zone default now() not null,
  author_id uuid,
  author_name text not null,
  gde text default ''::text not null,
  pole text default ''::text not null,
  lang text default 'ru'::text not null,
  frag text default ''::text not null,
  variant text not null,
  comment text default ''::text not null,
  status text default 'new'::text not null,
  decision text default ''::text not null,
  decided_by text,
  decided_at timestamp with time zone,
  plan text default ''::text not null
);
create table if not exists public.sprint_columns (
  id uuid default extensions.uuid_generate_v4() not null,
  sprint_id uuid not null,
  name text not null,
  color text default '#4F8EF7'::text,
  order_index integer default 0 not null,
  role text
);
create table if not exists public.sprints (
  id uuid default extensions.uuid_generate_v4() not null,
  project_id uuid not null,
  name text not null,
  date_from date not null,
  date_to date not null,
  status text default 'active'::text not null,
  created_by uuid not null,
  created_at timestamp with time zone default now(),
  is_fixed boolean default false not null,
  fixed_at timestamp with time zone,
  fixed_task_ids uuid[] default '{}'::uuid[]
);
create table if not exists public.student_baseline (
  id uuid default gen_random_uuid() not null,
  as_of date not null,
  total integer not null,
  note text,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.student_moves (
  id uuid default gen_random_uuid() not null,
  history_id bigint not null,
  deal_id bigint not null,
  kind text not null,
  happened_at timestamp with time zone not null,
  students integer default 0 not null,
  student_names text[] default '{}'::text[] not null,
  deal_title text,
  created_at timestamp with time zone default now() not null,
  counted boolean default true not null,
  skip_reason text,
  origin_stage text,
  manual_counted boolean
);
create table if not exists public.task_activities (
  id uuid default gen_random_uuid() not null,
  task_id uuid not null,
  actor_id uuid,
  type text not null,
  old_value text,
  new_value text,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.task_history (
  id uuid default extensions.uuid_generate_v4() not null,
  task_id uuid not null,
  user_id uuid not null,
  action text not null,
  old_value text,
  new_value text,
  created_at timestamp with time zone default now()
);
create table if not exists public.tasks (
  id uuid default extensions.uuid_generate_v4() not null,
  project_id uuid not null,
  title text not null,
  description text,
  type text default 'task'::text not null,
  status text default 'backlog'::text not null,
  assignee_id uuid,
  creator_id uuid not null,
  deadline date,
  time_estimate integer default 0,
  parent_task_id uuid,
  sprint_id uuid,
  column_id uuid,
  column_order integer default 0,
  backlog_order integer default 0,
  is_recurring boolean default false,
  recurring_config jsonb,
  tags text[] default '{}'::text[],
  closed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  workflow_status text default 'new'::text not null,
  priority text,
  deleted_at timestamp with time zone,
  deleted_by uuid
);

-- ======================================================================
-- ПЕРВИЧНЫЕ КЛЮЧИ И УНИКАЛЬНОСТЬ (27)
-- ======================================================================

do $$ begin if not exists (select 1 from pg_constraint where conname = 'access_settings_pkey') then alter table public.access_settings add constraint access_settings_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'access_settings_user_id_key') then alter table public.access_settings add constraint access_settings_user_id_key UNIQUE (user_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'app_settings_pkey') then alter table public.app_settings add constraint app_settings_pkey PRIMARY KEY (key); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'article_reads_article_id_user_id_version_key') then alter table public.article_reads add constraint article_reads_article_id_user_id_version_key UNIQUE (article_id, user_id, version); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'article_reads_pkey') then alter table public.article_reads add constraint article_reads_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'articles_pkey') then alter table public.articles add constraint articles_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'call_reviews_pkey') then alter table public.call_reviews add constraint call_reviews_pkey PRIMARY KEY (call_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'comments_pkey') then alter table public.comments add constraint comments_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_request_activities_pkey') then alter table public.expense_request_activities add constraint expense_request_activities_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_request_comments_pkey') then alter table public.expense_request_comments add constraint expense_request_comments_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_requests_number_key') then alter table public.expense_requests add constraint expense_requests_number_key UNIQUE (number); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_requests_pkey') then alter table public.expense_requests add constraint expense_requests_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'notifications_pkey') then alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'profiles_login_key') then alter table public.profiles add constraint profiles_login_key UNIQUE (login); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'profiles_pkey') then alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'project_members_pkey') then alter table public.project_members add constraint project_members_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'project_members_project_id_user_id_key') then alter table public.project_members add constraint project_members_project_id_user_id_key UNIQUE (project_id, user_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'projects_pkey') then alter table public.projects add constraint projects_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'script_suggestions_pkey') then alter table public.script_suggestions add constraint script_suggestions_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'sprint_columns_pkey') then alter table public.sprint_columns add constraint sprint_columns_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'sprints_pkey') then alter table public.sprints add constraint sprints_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'student_baseline_pkey') then alter table public.student_baseline add constraint student_baseline_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'student_moves_history_id_key') then alter table public.student_moves add constraint student_moves_history_id_key UNIQUE (history_id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'student_moves_pkey') then alter table public.student_moves add constraint student_moves_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'task_activities_pkey') then alter table public.task_activities add constraint task_activities_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'task_history_pkey') then alter table public.task_history add constraint task_history_pkey PRIMARY KEY (id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_pkey') then alter table public.tasks add constraint tasks_pkey PRIMARY KEY (id); end if; end $$;

-- ======================================================================
-- ПРОВЕРОЧНЫЕ ОГРАНИЧЕНИЯ (16)
-- ======================================================================

do $$ begin if not exists (select 1 from pg_constraint where conname = 'notifications_type_check') then alter table public.notifications add constraint notifications_type_check CHECK ((type = ANY (ARRAY['task_assigned'::text, 'assignee_changed'::text, 'creator_changed'::text, 'status_changed'::text, 'comment_added'::text, 'deadline_soon'::text, 'deadline_overdue'::text, 'expense_submitted'::text, 'expense_decided'::text, 'expense_comment'::text, 'expense_paid'::text, 'article_published'::text, 'article_updated'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'employee'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'profiles_status_check') then alter table public.profiles add constraint profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'project_members_role_check') then alter table public.project_members add constraint project_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'member'::text, 'viewer'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'projects_default_assignee_mode_check') then alter table public.projects add constraint projects_default_assignee_mode_check CHECK ((default_assignee_mode = ANY (ARRAY['creator'::text, 'specific'::text, 'manual'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'projects_week_cycle_type_check') then alter table public.projects add constraint projects_week_cycle_type_check CHECK ((week_cycle_type = ANY (ARRAY['mon-sun'::text, 'custom'::text, 'manual'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'script_suggestions_lang_check') then alter table public.script_suggestions add constraint script_suggestions_lang_check CHECK ((lang = ANY (ARRAY['ru'::text, 'kz'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'script_suggestions_status_check') then alter table public.script_suggestions add constraint script_suggestions_status_check CHECK ((status = ANY (ARRAY['new'::text, 'approved'::text, 'rejected'::text, 'applied'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'sprint_columns_role_check') then alter table public.sprint_columns add constraint sprint_columns_role_check CHECK ((role = ANY (ARRAY['todo'::text, 'done'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'sprints_status_check') then alter table public.sprints add constraint sprints_status_check CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'student_moves_kind_check') then alter table public.student_moves add constraint student_moves_kind_check CHECK ((kind = ANY (ARRAY['enroll'::text, 'expel'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'task_history_action_check') then alter table public.task_history add constraint task_history_action_check CHECK ((action = ANY (ARRAY['created'::text, 'status_changed'::text, 'assigned'::text, 'moved'::text, 'deadline_set'::text, 'time_set'::text, 'commented'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_priority_check') then alter table public.tasks add constraint tasks_priority_check CHECK ((priority = ANY (ARRAY['medium'::text, 'high'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_status_check') then alter table public.tasks add constraint tasks_status_check CHECK ((status = ANY (ARRAY['backlog'::text, 'sprint'::text, 'done'::text, 'deleted'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_type_check') then alter table public.tasks add constraint tasks_type_check CHECK ((type = ANY (ARRAY['task'::text, 'epic'::text]))); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_workflow_status_check') then alter table public.tasks add constraint tasks_workflow_status_check CHECK ((workflow_status = ANY (ARRAY['new'::text, 'in_progress'::text, 'review'::text, 'done'::text, 'cancelled'::text]))); end if; end $$;

-- ======================================================================
-- ВНЕШНИЕ КЛЮЧИ — только после первичных, иначе ссылаться не на что (39)
-- ======================================================================

do $$ begin if not exists (select 1 from pg_constraint where conname = 'access_settings_user_id_fkey') then alter table public.access_settings add constraint access_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'article_reads_article_id_fkey') then alter table public.article_reads add constraint article_reads_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'article_reads_user_id_fkey') then alter table public.article_reads add constraint article_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'articles_author_id_fkey') then alter table public.articles add constraint articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'articles_published_by_fkey') then alter table public.articles add constraint articles_published_by_fkey FOREIGN KEY (published_by) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'comments_author_id_fkey') then alter table public.comments add constraint comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'comments_task_id_fkey') then alter table public.comments add constraint comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_request_activities_actor_id_fkey') then alter table public.expense_request_activities add constraint expense_request_activities_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_request_activities_request_id_fkey') then alter table public.expense_request_activities add constraint expense_request_activities_request_id_fkey FOREIGN KEY (request_id) REFERENCES expense_requests(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_request_comments_author_id_fkey') then alter table public.expense_request_comments add constraint expense_request_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_request_comments_request_id_fkey') then alter table public.expense_request_comments add constraint expense_request_comments_request_id_fkey FOREIGN KEY (request_id) REFERENCES expense_requests(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_requests_decided_by_fkey') then alter table public.expense_requests add constraint expense_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_requests_paid_by_fkey') then alter table public.expense_requests add constraint expense_requests_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES auth.users(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'expense_requests_requester_id_fkey') then alter table public.expense_requests add constraint expense_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'notifications_actor_id_fkey') then alter table public.notifications add constraint notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'notifications_article_id_fkey') then alter table public.notifications add constraint notifications_article_id_fkey FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'notifications_expense_request_id_fkey') then alter table public.notifications add constraint notifications_expense_request_id_fkey FOREIGN KEY (expense_request_id) REFERENCES expense_requests(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'notifications_task_id_fkey') then alter table public.notifications add constraint notifications_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'notifications_user_id_fkey') then alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'profiles_id_fkey') then alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'project_members_project_id_fkey') then alter table public.project_members add constraint project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'project_members_user_id_fkey') then alter table public.project_members add constraint project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'projects_created_by_fkey') then alter table public.projects add constraint projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'projects_default_assignee_id_fkey') then alter table public.projects add constraint projects_default_assignee_id_fkey FOREIGN KEY (default_assignee_id) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'script_suggestions_author_id_fkey') then alter table public.script_suggestions add constraint script_suggestions_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'sprint_columns_sprint_id_fkey') then alter table public.sprint_columns add constraint sprint_columns_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'sprints_created_by_fkey') then alter table public.sprints add constraint sprints_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'sprints_project_id_fkey') then alter table public.sprints add constraint sprints_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'task_activities_actor_id_fkey') then alter table public.task_activities add constraint task_activities_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'task_activities_task_id_fkey') then alter table public.task_activities add constraint task_activities_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'task_history_task_id_fkey') then alter table public.task_history add constraint task_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'task_history_user_id_fkey') then alter table public.task_history add constraint task_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_assignee_id_fkey') then alter table public.tasks add constraint tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_column_id_fkey') then alter table public.tasks add constraint tasks_column_id_fkey FOREIGN KEY (column_id) REFERENCES sprint_columns(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_creator_id_fkey') then alter table public.tasks add constraint tasks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES profiles(id); end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_deleted_by_fkey') then alter table public.tasks add constraint tasks_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES profiles(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_parent_task_id_fkey') then alter table public.tasks add constraint tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_project_id_fkey') then alter table public.tasks add constraint tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE; end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'tasks_sprint_id_fkey') then alter table public.tasks add constraint tasks_sprint_id_fkey FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL; end if; end $$;

-- ======================================================================
-- ИНДЕКСЫ (30)
-- ======================================================================

CREATE INDEX IF NOT EXISTS article_reads_article_idx ON public.article_reads USING btree (article_id);
CREATE INDEX IF NOT EXISTS article_reads_user_idx ON public.article_reads USING btree (user_id);
CREATE INDEX IF NOT EXISTS articles_author_idx ON public.articles USING btree (author_id);
CREATE INDEX IF NOT EXISTS articles_status_idx ON public.articles USING btree (status, category);
CREATE INDEX IF NOT EXISTS expense_request_activities_request_idx ON public.expense_request_activities USING btree (request_id, created_at);
CREATE INDEX IF NOT EXISTS expense_request_comments_request_idx ON public.expense_request_comments USING btree (request_id, created_at);
CREATE INDEX IF NOT EXISTS expense_requests_created_idx ON public.expense_requests USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS expense_requests_requester_idx ON public.expense_requests USING btree (requester_id);
CREATE INDEX IF NOT EXISTS expense_requests_status_idx ON public.expense_requests USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON public.comments USING btree (task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications USING btree (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks USING btree (assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON public.tasks USING btree (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON public.tasks USING btree (sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks USING btree (status);
CREATE INDEX IF NOT EXISTS notifications_actor_idx ON public.notifications USING btree (actor_id);
CREATE INDEX IF NOT EXISTS notifications_article_idx ON public.notifications USING btree (article_id);
CREATE INDEX IF NOT EXISTS notifications_expense_request_idx ON public.notifications USING btree (expense_request_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON public.notifications USING btree (user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_task_id_idx ON public.notifications USING btree (task_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS script_suggestions_status_idx ON public.script_suggestions USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS student_moves_counted_idx ON public.student_moves USING btree (counted, happened_at DESC);
CREATE INDEX IF NOT EXISTS student_moves_kind_idx ON public.student_moves USING btree (kind, happened_at DESC);
CREATE INDEX IF NOT EXISTS student_moves_when_idx ON public.student_moves USING btree (happened_at DESC);
CREATE INDEX IF NOT EXISTS task_activities_created_at_idx ON public.task_activities USING btree (created_at);
CREATE INDEX IF NOT EXISTS task_activities_task_id_idx ON public.task_activities USING btree (task_id);

-- ======================================================================
-- ФУНКЦИИ (6)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.can_approve_expenses(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select p.role = 'admin' or p.can_approve_expenses from profiles p where p.id = uid),
    false
  )
$function$
;
CREATE OR REPLACE FUNCTION public.can_pay_expenses(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select p.role = 'admin' or p.can_approve_expenses or p.can_pay_expenses
     from profiles p where p.id = uid),
    false
  )
$function$
;
CREATE OR REPLACE FUNCTION public.can_see_all_expenses(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select p.role = 'admin' or p.can_approve_expenses or p.can_pay_expenses
     from profiles p where p.id = uid),
    false
  )
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, login, role, status, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'login',     split_part(NEW.email, '@', 1)),
    'employee',
    'pending',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select p.role = 'admin' from profiles p where p.id = uid), false)
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

-- ======================================================================
-- ТРИГГЕРЫ (3)
-- ======================================================================

drop trigger if exists articles_updated_at on public.articles;
CREATE TRIGGER articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
drop trigger if exists expense_requests_updated_at on public.expense_requests;
CREATE TRIGGER expense_requests_updated_at BEFORE UPDATE ON public.expense_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
drop trigger if exists tasks_updated_at on public.tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ======================================================================
-- ВКЛЮЧЕНИЕ ROW LEVEL SECURITY (21)
-- ======================================================================

alter table public.access_settings enable row level security;
alter table public.app_settings enable row level security;
alter table public.article_reads enable row level security;
alter table public.articles enable row level security;
alter table public.call_reviews enable row level security;
alter table public.comments enable row level security;
alter table public.expense_request_activities enable row level security;
alter table public.expense_request_comments enable row level security;
alter table public.expense_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.profiles enable row level security;
alter table public.project_members enable row level security;
alter table public.projects enable row level security;
alter table public.script_suggestions enable row level security;
alter table public.sprint_columns enable row level security;
alter table public.sprints enable row level security;
alter table public.student_baseline enable row level security;
alter table public.student_moves enable row level security;
alter table public.task_activities enable row level security;
alter table public.task_history enable row level security;
alter table public.tasks enable row level security;

-- ======================================================================
-- ПОЛИТИКИ ДОСТУПА (45)
-- ======================================================================

drop policy if exists access_all on public.access_settings;
create policy access_all on public.access_settings as PERMISSIVE for ALL to public using ((auth.uid() = user_id));
drop policy if exists access_select on public.access_settings;
create policy access_select on public.access_settings as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));
drop policy if exists article_reads_insert on public.article_reads;
create policy article_reads_insert on public.article_reads as PERMISSIVE for INSERT to public with check ((user_id = auth.uid()));
drop policy if exists article_reads_select on public.article_reads;
create policy article_reads_select on public.article_reads as PERMISSIVE for SELECT to public using (((user_id = auth.uid()) OR is_admin(auth.uid())));
drop policy if exists articles_insert on public.articles;
create policy articles_insert on public.articles as PERMISSIVE for INSERT to public with check ((author_id = auth.uid()));
drop policy if exists articles_select on public.articles;
create policy articles_select on public.articles as PERMISSIVE for SELECT to public using (((status = 'published'::text) OR (author_id = auth.uid()) OR is_admin(auth.uid())));
drop policy if exists articles_update on public.articles;
create policy articles_update on public.articles as PERMISSIVE for UPDATE to public using ((((author_id = auth.uid()) AND (status <> 'published'::text)) OR is_admin(auth.uid())));
drop policy if exists "auth users can read comments" on public.comments;
create policy "auth users can read comments" on public.comments as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments as PERMISSIVE for DELETE to public using ((auth.uid() = author_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments as PERMISSIVE for INSERT to public with check ((auth.uid() = author_id));
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM (tasks t
     JOIN project_members pm ON ((pm.project_id = t.project_id)))
  WHERE ((t.id = comments.task_id) AND (pm.user_id = auth.uid())))));
drop policy if exists expense_request_activities_select on public.expense_request_activities;
create policy expense_request_activities_select on public.expense_request_activities as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM expense_requests r
  WHERE ((r.id = expense_request_activities.request_id) AND ((r.requester_id = auth.uid()) OR can_see_all_expenses(auth.uid()))))));
drop policy if exists expense_request_comments_insert on public.expense_request_comments;
create policy expense_request_comments_insert on public.expense_request_comments as PERMISSIVE for INSERT to public with check (((author_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM expense_requests r
  WHERE ((r.id = expense_request_comments.request_id) AND ((r.requester_id = auth.uid()) OR can_see_all_expenses(auth.uid())))))));
drop policy if exists expense_request_comments_select on public.expense_request_comments;
create policy expense_request_comments_select on public.expense_request_comments as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM expense_requests r
  WHERE ((r.id = expense_request_comments.request_id) AND ((r.requester_id = auth.uid()) OR can_see_all_expenses(auth.uid()))))));
drop policy if exists expense_requests_insert on public.expense_requests;
create policy expense_requests_insert on public.expense_requests as PERMISSIVE for INSERT to public with check ((requester_id = auth.uid()));
drop policy if exists expense_requests_select on public.expense_requests;
create policy expense_requests_select on public.expense_requests as PERMISSIVE for SELECT to public using (((requester_id = auth.uid()) OR can_see_all_expenses(auth.uid())));
drop policy if exists expense_requests_update on public.expense_requests;
create policy expense_requests_update on public.expense_requests as PERMISSIVE for UPDATE to public using ((((requester_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'needs_info'::text]))) OR can_see_all_expenses(auth.uid())));
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications as PERMISSIVE for UPDATE to public using ((auth.uid() = user_id));
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications as PERMISSIVE for UPDATE to public using ((auth.uid() = user_id));
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles as PERMISSIVE for SELECT to public using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles as PERMISSIVE for UPDATE to public using ((auth.uid() = id));
drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members as PERMISSIVE for DELETE to public using ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = project_members.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = 'owner'::text)))));
drop policy if exists members_insert on public.project_members;
create policy members_insert on public.project_members as PERMISSIVE for INSERT to public with check (((EXISTS ( SELECT 1
   FROM project_members project_members_1
  WHERE ((project_members_1.project_id = project_members_1.project_id) AND (project_members_1.user_id = auth.uid()) AND (project_members_1.role = 'owner'::text)))) OR (auth.uid() = user_id)));
drop policy if exists members_select on public.project_members;
create policy members_select on public.project_members as PERMISSIVE for SELECT to public using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = project_members.project_id) AND (pm.user_id = auth.uid()))))));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects as PERMISSIVE for DELETE to public using ((auth.uid() = created_by));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects as PERMISSIVE for INSERT to public with check ((auth.uid() = created_by));
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects as PERMISSIVE for SELECT to public using (((auth.uid() = created_by) OR (EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = projects.id) AND (project_members.user_id = auth.uid()))))));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects as PERMISSIVE for UPDATE to public using ((EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = projects.id) AND (project_members.user_id = auth.uid()) AND (project_members.role = 'owner'::text)))));
drop policy if exists columns_all on public.sprint_columns;
create policy columns_all on public.sprint_columns as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM (sprints s
     JOIN project_members pm ON ((pm.project_id = s.project_id)))
  WHERE ((s.id = sprint_columns.sprint_id) AND (pm.user_id = auth.uid())))));
drop policy if exists columns_select on public.sprint_columns;
create policy columns_select on public.sprint_columns as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM (sprints s
     JOIN project_members pm ON ((pm.project_id = s.project_id)))
  WHERE ((s.id = sprint_columns.sprint_id) AND (pm.user_id = auth.uid())))));
drop policy if exists sprints_insert on public.sprints;
create policy sprints_insert on public.sprints as PERMISSIVE for INSERT to public with check ((EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = sprints.project_id) AND (project_members.user_id = auth.uid())))));
drop policy if exists sprints_select on public.sprints;
create policy sprints_select on public.sprints as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = sprints.project_id) AND (project_members.user_id = auth.uid())))));
drop policy if exists sprints_update on public.sprints;
create policy sprints_update on public.sprints as PERMISSIVE for UPDATE to public using ((EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = sprints.project_id) AND (project_members.user_id = auth.uid())))));
drop policy if exists student_baseline_select on public.student_baseline;
create policy student_baseline_select on public.student_baseline as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
drop policy if exists student_moves_select on public.student_moves;
create policy student_moves_select on public.student_moves as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
drop policy if exists task_activities_insert on public.task_activities;
create policy task_activities_insert on public.task_activities as PERMISSIVE for INSERT to public with check ((auth.role() = 'service_role'::text));
drop policy if exists task_activities_select on public.task_activities;
create policy task_activities_select on public.task_activities as PERMISSIVE for SELECT to public using ((auth.role() = 'authenticated'::text));
drop policy if exists history_insert on public.task_history;
create policy history_insert on public.task_history as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));
drop policy if exists history_select on public.task_history;
create policy history_select on public.task_history as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM (tasks t
     JOIN project_members pm ON ((pm.project_id = t.project_id)))
  WHERE ((t.id = task_history.task_id) AND (pm.user_id = auth.uid())))));
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks as PERMISSIVE for DELETE to public using (((auth.uid() = creator_id) OR (EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = tasks.project_id) AND (project_members.user_id = auth.uid()) AND (project_members.role = 'owner'::text))))));
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks as PERMISSIVE for INSERT to public with check ((EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = tasks.project_id) AND (project_members.user_id = auth.uid())))));
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = tasks.project_id) AND (project_members.user_id = auth.uid())))));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks as PERMISSIVE for UPDATE to public using ((EXISTS ( SELECT 1
   FROM project_members
  WHERE ((project_members.project_id = tasks.project_id) AND (project_members.user_id = auth.uid())))));

-- ======================================================================
-- ПРАВА ДЛЯ РОЛЕЙ anon, authenticated, service_role (63)
-- ======================================================================

grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.access_settings to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.access_settings to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.access_settings to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.app_settings to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.app_settings to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.app_settings to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.article_reads to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.article_reads to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.article_reads to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.articles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.articles to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.articles to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.call_reviews to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.call_reviews to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.call_reviews to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.comments to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.comments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.comments to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.expense_request_activities to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.expense_request_activities to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.expense_request_activities to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.expense_request_comments to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.expense_request_comments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.expense_request_comments to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.expense_requests to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.expense_requests to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.expense_requests to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.notifications to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.notifications to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.notifications to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.profiles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.profiles to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.profiles to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.project_members to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.project_members to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.project_members to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.projects to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.projects to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.projects to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.script_suggestions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.script_suggestions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.script_suggestions to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.sprint_columns to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.sprint_columns to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.sprint_columns to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.sprints to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.sprints to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.sprints to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.student_baseline to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.student_baseline to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.student_baseline to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.student_moves to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.student_moves to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.student_moves to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.task_activities to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.task_activities to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.task_activities to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.task_history to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.task_history to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.task_history to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.tasks to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.tasks to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.tasks to service_role;

-- ======================================================================
-- ХРАНИЛИЩЕ ФАЙЛОВ (1)
-- ======================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('task-attachments', 'task-attachments', true, 26214400, null) on conflict (id) do nothing;

-- ======================================================================
-- ПОЛИТИКИ ХРАНИЛИЩА — кто читает и кто загружает вложения (2)
-- ======================================================================

drop policy if exists "auth users can upload attachments" on storage.objects;
create policy "auth users can upload attachments" on storage.objects as PERMISSIVE for INSERT to authenticated with check ((bucket_id = 'task-attachments'::text));
drop policy if exists "public read attachments" on storage.objects;
create policy "public read attachments" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'task-attachments'::text));

-- ======================================================================
-- ТРИГГЕР НА auth.users — создаёт профиль при регистрации; без него вход есть, а профиля нет (1)
-- ======================================================================

drop trigger if exists on_auth_user_created on auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
