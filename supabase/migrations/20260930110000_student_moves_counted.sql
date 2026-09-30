-- В Битриксе сделки дублируются и объединяются: дубль успевает войти в стадию,
-- потом его удаляют — и один ученик оказывается посчитан дважды.
-- Поэтому движение хранится всегда, но в счёт идёт только помеченное counted.
alter table student_moves add column if not exists counted boolean not null default true;
alter table student_moves add column if not exists skip_reason text;

create index if not exists student_moves_counted_idx on student_moves(counted, happened_at desc);
