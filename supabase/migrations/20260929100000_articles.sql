-- База инструкций: сотрудники пишут текст в своём ИИ, вставляют разметкой,
-- админ проверяет и публикует. Обязательные статьи требуют отметки об ознакомлении.

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  -- Текст в Markdown: его удобно получать от ИИ и вставлять как есть
  content text not null default '',
  category text not null default 'taskhub',
  -- taskhub | processes | hr | sales | other
  status text not null default 'draft',
  -- draft (черновик автора) | review (отдал на проверку) | published (виден всем)
  is_required boolean not null default false,
  -- Кому адресована. Пусто = всем; иначе список отделов из profiles.department
  departments text[] not null default '{}',
  -- Растёт при смысловой правке: отметки об ознакомлении сбрасываются на старой версии
  version integer not null default 1,
  author_id uuid references profiles(id) on delete set null,
  published_by uuid references profiles(id) on delete set null,
  published_at timestamptz,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_status_idx on articles(status, category);
create index if not exists articles_author_idx on articles(author_id);

drop trigger if exists articles_updated_at on articles;
create trigger articles_updated_at
  before update on articles
  for each row execute function update_updated_at();

-- Отметка «прочитал». Версия важна: после правки инструкции отметка на старой
-- версии больше не считается, и человека просят перечитать
create table if not exists article_reads (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  version integer not null,
  read_at timestamptz not null default now(),
  unique (article_id, user_id, version)
);

create index if not exists article_reads_user_idx on article_reads(user_id);
create index if not exists article_reads_article_idx on article_reads(article_id);

-- Уведомления о новых и обновлённых инструкциях
alter table notifications add column if not exists article_id uuid references articles(id) on delete cascade;
create index if not exists notifications_article_idx on notifications(article_id);

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in (
  'task_assigned', 'assignee_changed', 'creator_changed', 'status_changed', 'comment_added',
  'deadline_soon', 'deadline_overdue',
  'expense_submitted', 'expense_decided', 'expense_comment', 'expense_paid',
  'article_published', 'article_updated'
));

-- ─── Права ───────────────────────────────────────────────────────────────────
-- Опубликованное читают все, черновик — только автор и админы.
-- Как и в расходах, RLS здесь второй рубеж: приложение ходит сервисным ключом
-- и проверяет права в server actions.

create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select p.role = 'admin' from profiles p where p.id = uid), false)
$$;

alter table articles enable row level security;
alter table article_reads enable row level security;

drop policy if exists "articles_select" on articles;
create policy "articles_select" on articles
  for select using (status = 'published' or author_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "articles_insert" on articles;
create policy "articles_insert" on articles
  for insert with check (author_id = auth.uid());

drop policy if exists "articles_update" on articles;
create policy "articles_update" on articles
  for update using (
    (author_id = auth.uid() and status <> 'published') or is_admin(auth.uid())
  );

drop policy if exists "article_reads_select" on article_reads;
create policy "article_reads_select" on article_reads
  for select using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists "article_reads_insert" on article_reads;
create policy "article_reads_insert" on article_reads
  for insert with check (user_id = auth.uid());
