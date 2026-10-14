-- План правки от Claude: как именно предложение будет внесено в базу подсказчика.
-- Марлен читает план и одобряет/отказывает; вносится только одобренное.
alter table public.script_suggestions add column if not exists plan text not null default '';
