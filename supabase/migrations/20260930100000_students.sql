-- Счётчик учеников школы. Ученик ≠ сделка: в одной сделке (семье) до четырёх детей,
-- поэтому каждое движение считается по заполненным полям «ФИО ученика 1…4».
--
-- Правило счёта (задано владельцем 30.09.2026):
--   стартовая отметка — 341 ученик на 30 сентября 2026;
--   сделка вошла в стадию «Зарегистрировать на платформу» (C4:PREPARATION) → плюс её ученики;
--   сделка вошла в стадию «Запросили отчисление» (C6:NEW) → минус её ученики.

-- Секреты интеграций: вебхук Битрикса лежит здесь, а не в переменных Vercel,
-- чтобы не требовать доступа к настройкам деплоя. Читается только сервисным ключом.
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
-- Политик нет намеренно: таблица доступна только сервисному ключу

-- Отправная точка. Если когда-нибудь пересчитают вручную — добавляется новая строка,
-- и счёт ведётся от самой свежей
create table if not exists student_baseline (
  id uuid primary key default gen_random_uuid(),
  as_of date not null,
  total integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists student_moves (
  id uuid primary key default gen_random_uuid(),
  -- Ключ идемпотентности: одна запись истории стадий Битрикса = одна строка здесь
  history_id bigint not null unique,
  deal_id bigint not null,
  kind text not null check (kind in ('enroll', 'expel')),
  happened_at timestamptz not null,
  students integer not null default 0,
  -- ФИО детей из сделки — чтобы в таблице движения было видно, кто именно пришёл или ушёл
  student_names text[] not null default '{}',
  deal_title text,
  created_at timestamptz not null default now()
);

create index if not exists student_moves_when_idx on student_moves(happened_at desc);
create index if not exists student_moves_kind_idx on student_moves(kind, happened_at desc);

alter table student_moves enable row level security;
alter table student_baseline enable row level security;

-- Раздел CRM и так открыт не всем (canAccessCrm), внутри него цифры видят все, кто дошёл
drop policy if exists "student_moves_select" on student_moves;
create policy "student_moves_select" on student_moves for select using (auth.uid() is not null);

drop policy if exists "student_baseline_select" on student_baseline;
create policy "student_baseline_select" on student_baseline for select using (auth.uid() is not null);
