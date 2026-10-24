"""Полная схема TaskHub в виде SQL, который разворачивает базу с нуля.

Зачем: папка migrations/ описывает только поздние изменения, а первая миграция пустая.
Без этого текста поднять новую базу (dev, демо, запасную) нельзя.

Как работает: читает метаданные базы через read-only эндпоинт Management API
(supabase_api.query) и раскладывает DDL в том порядке, в котором его примет пустая база.
Пользуются scripts/dump-schema.py (файл supabase/baseline.sql) и scripts/demo-sync.py.
"""

from datetime import date

import supabase_api

ZAPROSY = {
 'extension': """
select 'create extension if not exists ' || quote_ident(e.extname)
       || ' with schema ' || quote_ident(n.nspname) || ';' as ddl
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
where e.extname not in ('plpgsql')""",

 'enum': """
select 'create type public.' || quote_ident(t.typname) || ' as enum ('
       || string_agg(quote_literal(en.enumlabel), ', ' order by en.enumsortorder) || ');' as ddl
from pg_type t join pg_namespace n on n.oid = t.typnamespace
join pg_enum en on en.enumtypid = t.oid
where n.nspname = 'public' group by t.typname""",

 'sequence': """
select 'create sequence if not exists public.' || quote_ident(sequencename)
       || ' as ' || data_type || ' increment by ' || increment_by
       || ' minvalue ' || min_value || ' maxvalue ' || max_value
       || ' start with ' || start_value
       || case when cycle then ' cycle' else ' no cycle' end || ';' as ddl
from pg_sequences where schemaname = 'public'""",

 'table': """
with cols as (
  select c.relname as tbl, a.attnum,
         '  ' || quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod)
         || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
         || case when a.attnotnull then ' not null' else '' end as line
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped)
select 'create table if not exists public.' || quote_ident(tbl) || E' (\n'
       || string_agg(line, E',\n' order by attnum) || E'\n);' as ddl
from cols group by tbl order by tbl""",

 # ключи идут тремя порциями: внешний ключ не создастся, пока у чужой таблицы нет первичного
 'pk_unique': """
select 'do $$ begin if not exists (select 1 from pg_constraint where conname = '
       || quote_literal(c.conname) || ') then alter table public.' || quote_ident(t.relname)
       || ' add constraint ' || quote_ident(c.conname) || ' ' || pg_get_constraintdef(c.oid)
       || '; end if; end $$;' as ddl
from pg_constraint c join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and c.contype in ('p','u') order by c.conname""",

 'check': """
select 'do $$ begin if not exists (select 1 from pg_constraint where conname = '
       || quote_literal(c.conname) || ') then alter table public.' || quote_ident(t.relname)
       || ' add constraint ' || quote_ident(c.conname) || ' ' || pg_get_constraintdef(c.oid)
       || '; end if; end $$;' as ddl
from pg_constraint c join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and c.contype = 'c' order by c.conname""",

 'foreign_key': """
select 'do $$ begin if not exists (select 1 from pg_constraint where conname = '
       || quote_literal(c.conname) || ') then alter table public.' || quote_ident(t.relname)
       || ' add constraint ' || quote_ident(c.conname) || ' ' || pg_get_constraintdef(c.oid)
       || '; end if; end $$;' as ddl
from pg_constraint c join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and c.contype = 'f' order by c.conname""",

 'index': """
select replace(indexdef, 'CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ') || ';' as ddl from pg_indexes i
where i.schemaname = 'public'
  and not exists (select 1 from pg_constraint c where c.conname = i.indexname)
order by indexname""",

 'function': """
select pg_get_functiondef(p.oid) || ';' as ddl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' order by p.proname""",

 'trigger': """
select 'drop trigger if exists ' || quote_ident(t.tgname) || ' on public.' || quote_ident(c.relname)
       || E';\n' || pg_get_triggerdef(t.oid) || ';' as ddl
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal order by t.tgname""",

 'view': """
select 'create or replace view public.' || quote_ident(viewname) || ' as ' || definition as ddl
from pg_views where schemaname = 'public' order by viewname""",

 'rls': """
select 'alter table public.' || quote_ident(c.relname) || ' enable row level security;' as ddl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity order by c.relname""",

 'policy': """
select 'drop policy if exists ' || quote_ident(p.policyname) || ' on public.' || quote_ident(p.tablename) || E';\n'
       || 'create policy ' || quote_ident(p.policyname) || ' on public.' || quote_ident(p.tablename)
       || ' as ' || p.permissive || ' for ' || p.cmd || ' to ' || array_to_string(p.roles, ', ')
       || coalesce(' using (' || p.qual || ')', '')
       || coalesce(' with check (' || p.with_check || ')', '') || ';' as ddl
from pg_policies p where p.schemaname = 'public' order by p.tablename, p.policyname""",

 # права читаются из relacl, а не из information_schema.role_table_grants: та показывает
 # только гранты ролей текущего пользователя, и под read-only пользователем список пуст
 'grant': """
select 'grant ' || string_agg(distinct a.privilege_type, ', ')
       || ' on public.' || quote_ident(c.relname) || ' to ' || quote_ident(r.rolname) || ';' as ddl
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join lateral aclexplode(c.relacl) a
join pg_roles r on r.oid = a.grantee
where n.nspname = 'public' and c.relkind in ('r', 'v')
  and r.rolname in ('anon','authenticated','service_role')
group by c.relname, r.rolname order by c.relname, r.rolname""",

 'auth_trigger': """
select 'drop trigger if exists ' || quote_ident(t.tgname) || ' on auth.users' || E';\n'
       || pg_get_triggerdef(t.oid) || ';' as ddl
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal""",

 'storage_policy': """
select 'drop policy if exists ' || quote_ident(p.policyname) || ' on storage.' || quote_ident(p.tablename) || E';\n'
       || 'create policy ' || quote_ident(p.policyname) || ' on storage.' || quote_ident(p.tablename)
       || ' as ' || p.permissive || ' for ' || p.cmd || ' to ' || array_to_string(p.roles, ', ')
       || coalesce(' using (' || p.qual || ')', '')
       || coalesce(' with check (' || p.with_check || ')', '') || ';' as ddl
from pg_policies p where p.schemaname = 'storage' order by p.tablename, p.policyname""",

 'bucket': """
select 'insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('
       || quote_literal(id) || ', ' || quote_literal(name) || ', ' || public::text || ', '
       || coalesce(file_size_limit::text, 'null') || ', '
       || coalesce(quote_literal(allowed_mime_types::text) || '::text[]', 'null')
       || ') on conflict (id) do nothing;' as ddl
from storage.buckets""",
}

# порядок разделов в файле и их заголовки
PORYADOK = [
 ('extension',   'РАСШИРЕНИЯ'),
 ('enum',        'ПОЛЬЗОВАТЕЛЬСКИЕ ТИПЫ'),
 ('sequence',    'ПОСЛЕДОВАТЕЛЬНОСТИ — на них ссылаются значения по умолчанию, поэтому идут до таблиц'),
 ('table',       'ТАБЛИЦЫ'),
 ('pk_unique',   'ПЕРВИЧНЫЕ КЛЮЧИ И УНИКАЛЬНОСТЬ'),
 ('check',       'ПРОВЕРОЧНЫЕ ОГРАНИЧЕНИЯ'),
 ('foreign_key', 'ВНЕШНИЕ КЛЮЧИ — только после первичных, иначе ссылаться не на что'),
 ('index',       'ИНДЕКСЫ'),
 ('function',    'ФУНКЦИИ'),
 ('trigger',     'ТРИГГЕРЫ'),
 ('view',        'ПРЕДСТАВЛЕНИЯ'),
 ('rls',         'ВКЛЮЧЕНИЕ ROW LEVEL SECURITY'),
 ('policy',      'ПОЛИТИКИ ДОСТУПА'),
 ('grant',       'ПРАВА ДЛЯ РОЛЕЙ anon, authenticated, service_role'),
 ('bucket',      'ХРАНИЛИЩЕ ФАЙЛОВ'),
 ('storage_policy', 'ПОЛИТИКИ ХРАНИЛИЩА — кто читает и кто загружает вложения'),
 ('auth_trigger', 'ТРИГГЕР НА auth.users — создаёт профиль при регистрации; без него вход есть, а профиля нет'),
]


def sobrat(ref: str) -> tuple[str, dict[str, int]]:
    """Снимает схему с проекта ref: текст SQL и число объектов по разделам."""
    kuski = [
        f'-- Полная схема TaskHub, снятая с базы {ref} {date.today().strftime("%d.%m.%Y")}.',
        '--',
        '-- Применяется целиком и повторно: supabase db query --linked -f supabase/baseline.sql',
        '-- Пересобирается скриптом scripts/dump-schema.py после изменений схемы в проде.',
        '',
    ]
    itogo = {}
    for kluch, zagolovok in PORYADOK:
        stroki = [r['ddl'] for r in supabase_api.query(ref, ZAPROSY[kluch])]
        itogo[kluch] = len(stroki)
        if not stroki:
            continue
        kuski += ['', '-- ' + '=' * 70, f'-- {zagolovok} ({len(stroki)})', '-- ' + '=' * 70, '']
        kuski += stroki
    return '\n'.join(kuski) + '\n', itogo
