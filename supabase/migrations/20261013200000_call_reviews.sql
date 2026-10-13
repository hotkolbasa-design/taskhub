-- Разборы звонков отдела продаж Globalos по скрипту хантера (страница /api/zvonok).
-- Делает Claude при первом открытии расшифровки; хранится, чтобы не платить за повторный разбор.
create table if not exists public.call_reviews (
  call_id    text primary key,
  review     jsonb not null,
  model      text not null,
  created_at timestamptz not null default now()
);
-- Только сервер (service role): клиентских политик нет
alter table public.call_reviews enable row level security;
