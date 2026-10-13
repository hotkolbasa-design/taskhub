-- Предложения хантеров по скрипту звонка (подсказчик Globalos): выделили фрагмент — предложили свой вариант.
-- Раздел TaskHub /predlozheniya; статус ставят админы (и Claude по просьбе Марлена).
create table if not exists public.script_suggestions (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text not null,
  gde         text not null default '',
  pole        text not null default '',
  lang        text not null default 'ru' check (lang in ('ru', 'kz')),
  frag        text not null default '',
  variant     text not null,
  comment     text not null default '',
  status      text not null default 'new' check (status in ('new', 'approved', 'rejected', 'applied')),
  decision    text not null default '',
  decided_by  text,
  decided_at  timestamptz
);
create index if not exists script_suggestions_status_idx on public.script_suggestions (status, created_at desc);
-- Читает и пишет только сервер (service role) после проверки доступа в коде
alter table public.script_suggestions enable row level security;
