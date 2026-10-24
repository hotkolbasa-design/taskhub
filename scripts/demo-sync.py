#!/usr/bin/env python3
"""Пересборка демо-копии TaskHub: структура — с боевой базы, данные — вымышленные.

Демо живёт в проекте taskhub-dev (DEV_REF): его показывают работодателям, на нём же
можно разрабатывать. Боевая база при пересборке только читается — через read-only
эндпоинт (supabase_api), записать туда что-то этот скрипт не может.

Что происходит при пересборке:
  1. С боевой базы снимается схема целиком (scripts/baseline.py).
  2. В демо-базе удаляется всё из схемы public и накатывается свежая схема —
     так в демо доезжают новые таблицы, колонки, функции и политики.
  3. Учётки демо-сотрудников приводятся к списку из demo_data.LYUDI, пароль у всех —
     DEMO_PASSWORD из .env.local.dev; всё, что зарегистрировали посетители, удаляется.
  4. Заливаются вымышленные данные с датами от сегодняшнего дня (scripts/demo_data.py),
     у ролей anon и authenticated отбирается запись в public (демо только для просмотра).
  5. Сбрасывается кэш демо-сайта (DEMO_URL + DEMO_CRON_SECRET из .env.local.dev).

Раз в неделю (решение Марлена 24.10.2026: TaskHub меняется не каждый день). Пересборка идёт
первым запуском новой недели, поэтому текущий спринт в демо всегда совпадает с календарной
неделей; в остальные дни — только пинг, чтобы бесплатный проект Supabase не уснул.
Цена решения: данные внутри недели не двигаются — какой спринт был в понедельник утром,
такой он и в пятницу.

Режимы:
  demo-sync.py            полная пересборка
  demo-sync.py --if-due   пересборка, если на этой неделе её ещё не было; иначе только пинг
  demo-sync.py --ping     только пинг: бесплатный проект Supabase засыпает после недели без запросов

launchd запускает --if-due каждое утро в 07:00 и при входе в систему
(~/Library/LaunchAgents/local.taskhub-demo-sync.plist); если Мак спал, запуск случится
при пробуждении. Журнал — ~/Library/Logs/taskhub-demo-sync.log.
"""

import argparse
import datetime as dt
import json
import pathlib
import secrets
import subprocess
import sys

import baseline
import demo_data
import supabase_api as api

ENV_FILE = api.PROJECT / '.env.local.dev'
STATE = pathlib.Path.home() / 'Library' / 'Application Support' / 'taskhub-demo' / 'state.json'

# Порядок заливки: сначала то, на что ссылаются внешние ключи
TABLITSY = ['profiles', 'projects', 'project_members', 'sprints', 'sprint_columns', 'tasks', 'comments',
            'task_activities', 'articles', 'article_reads', 'expense_requests', 'expense_request_comments',
            'expense_request_activities', 'notifications', 'student_baseline', 'student_moves']

OCHISTKA = """
do $$ declare r record; begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'v' loop
    execute format('drop view if exists public.%I cascade', r.relname);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in select sequencename from pg_sequences where schemaname = 'public' loop
    execute format('drop sequence if exists public.%I cascade', r.sequencename);
  end loop;
  -- функции расширений не трогаем: их удаляет только drop extension
  for r in select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f'
             and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    execute format('drop function if exists %s cascade', r.f);
  end loop;
  for r in select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typtype in ('e', 'd')
             and not exists (select 1 from pg_depend d where d.objid = t.oid and d.deptype = 'e') loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;
"""


# Демо только для просмотра (решение Марлена 24.10.2026). Приложение режет запись само
# (lib/demo/read-only.ts) — здесь закрыт обход мимо него: прямые запросы к REST API с публичным
# ключом anon и токеном демо-учётки. Сервисный ключ (приложение, этот скрипт) не затронут.
# Вернуть запись до следующей пересборки — grant тех же прав (CLAUDE_REFERENCE.md, «Демо-копия»).
TOLKO_CHTENIE = 'revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;'


def log(msg: str):
    print(f'{dt.datetime.now():%Y-%m-%d %H:%M:%S}  {msg}', flush=True)


def uvedomit(text: str):
    """Сообщение в Центр уведомлений macOS — чтобы сбой ночного прогона не прошёл незамеченным."""
    safe = text.replace('\\', '').replace('"', "'")[:200]
    subprocess.run(['osascript', '-e', f'display notification "{safe}" with title "Демо TaskHub"'],
                   capture_output=True)


def okruzhenie() -> dict[str, str]:
    env = api.read_env(ENV_FILE)
    if api.DEV_REF not in env.get('NEXT_PUBLIC_SUPABASE_URL', ''):
        raise SystemExit(f'{ENV_FILE} смотрит не в демо-базу {api.DEV_REF} — пересборка остановлена')
    if not env.get('DEMO_PASSWORD'):
        # пароль общий для всех демо-учёток и раздаётся работодателям — не секрет, но и не «123456»
        env['DEMO_PASSWORD'] = f'taskhub-demo-{secrets.randbelow(9000) + 1000}'
        with ENV_FILE.open('a', encoding='utf-8') as f:
            f.write('\n# Вход в демо-копию: demo@taskhub.local и этот пароль (общий для всех демо-учёток)\n'
                    f'DEMO_PASSWORD={env["DEMO_PASSWORD"]}\n')
    return env


def auth_api(env: dict, method: str, path: str, body: dict | None = None) -> dict | list:
    key = env['SUPABASE_SERVICE_ROLE_KEY']
    code, text = api.curl(['-X', method, f"{env['NEXT_PUBLIC_SUPABASE_URL']}/auth/v1/admin/{path}",
                           '-H', f'apikey: {key}', '-H', f'Authorization: Bearer {key}',
                           '-H', 'Content-Type: application/json', '--data-binary', '@-'],
                          body=json.dumps(body) if body is not None else '')
    if code >= 300:
        raise RuntimeError(f'Auth {method} {path}: HTTP {code}: {text[:300]}')
    return json.loads(text) if text.strip() else {}


def uchetki(env: dict) -> dict[str, str]:
    """Учётки строго по списку LYUDI: недостающие создаёт, лишние удаляет, пароли сбрасывает."""
    est = {u['email']: u['id'] for u in auth_api(env, 'GET', 'users?per_page=1000').get('users', [])}
    nuzhny = {f"{p['key']}@{demo_data.DOMEN}": p for p in demo_data.LYUDI}
    for email, uid in est.items():
        if email not in nuzhny:
            auth_api(env, 'DELETE', f'users/{uid}')
            log(f'  удалена лишняя учётка {email}')
    ids = {}
    for email, p in nuzhny.items():
        telo = {'email': email, 'password': env['DEMO_PASSWORD'], 'email_confirm': True,
                'user_metadata': {'full_name': p['name'], 'login': p['key']}}
        if email in est:
            auth_api(env, 'PUT', f'users/{est[email]}', {**telo, 'ban_duration': 'none'})
            ids[p['key']] = est[email]
        else:
            ids[p['key']] = auth_api(env, 'POST', 'users', telo)['id']
    return ids


def zalit(tablica: str, stroki: list[dict], upsert: bool = False):
    """Вставка пачками через jsonb_populate_recordset: колонки, которых нет в данных, получают свои default."""
    if not stroki:
        return
    cols = list(dict.fromkeys(k for s in stroki for k in s))
    spisok = ', '.join(f'"{c}"' for c in cols)
    hvost = ''
    if upsert:
        hvost = ' on conflict (id) do update set ' + ', '.join(f'"{c}" = excluded."{c}"' for c in cols if c != 'id')
    for i in range(0, len(stroki), 300):
        dannye = json.dumps(stroki[i:i + 300], ensure_ascii=False, default=str)
        if '$demo$' in dannye:
            raise SystemExit('в данных встретился разделитель $demo$')
        api.query(api.DEV_REF, f'insert into public.{tablica} ({spisok}) select {spisok} '
                               f'from jsonb_populate_recordset(null::public.{tablica}, $demo${dannye}$demo$::jsonb){hvost}',
                  write=True)


def sbrosit_kesh(env: dict, ids: dict[str, str]):
    """Кэш unstable_cache у страниц не протухает сам — после пересборки сайт показал бы старые данные."""
    url, secret = env.get('DEMO_URL'), env.get('DEMO_CRON_SECRET')
    if not url or not secret:
        log('  DEMO_URL / DEMO_CRON_SECRET не заданы — кэш демо-сайта не сброшен')
        return
    tegi = ['projects', 'profiles', 'my-tasks', 'expenses', 'trash', 'articles', 'crm', 'crm-students']
    for p in demo_data.PROEKTY:
        pid = demo_data.project_id(p['key'])
        tegi += [f'tasks-{pid}', f'members-{pid}', f'sprints-{pid}']
    tegi += [f'analytics-{uid}' for uid in ids.values()]
    code, text = api.curl(['-X', 'POST', f'{url.rstrip("/")}/api/revalidate', '-H', f'Authorization: Bearer {secret}',
                           '-H', 'Content-Type: application/json', '--data-binary', '@-'],
                          body=json.dumps({'tags': tegi}))
    log(f'  кэш демо-сайта: HTTP {code} {text[:120]}')
    if code >= 300:
        raise RuntimeError(f'кэш демо-сайта не сброшен: HTTP {code}')


def ping(env: dict):
    code, _ = api.curl([f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/projects?select=id&limit=1",
                        '-H', f"apikey: {env['NEXT_PUBLIC_SUPABASE_ANON_KEY']}"], timeout=60)
    log(f'пинг демо-базы: HTTP {code}')


def peresobrat(env: dict):
    log('1/6 снимаю схему с боевой базы (только чтение)')
    sql, itogo = baseline.sobrat(api.PROD_REF)
    log(f'    таблиц {itogo["table"]}, функций {itogo["function"]}, политик {itogo["policy"]}')

    log('2/6 очищаю демо-базу и вложения')
    code, text = api.curl(['-X', 'POST', f"{env['NEXT_PUBLIC_SUPABASE_URL']}/storage/v1/bucket/task-attachments/empty",
                           '-H', f"apikey: {env['SUPABASE_SERVICE_ROLE_KEY']}",
                           '-H', f"Authorization: Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}"])
    if code >= 300 and 'not found' not in text.lower():
        log(f'    вложения не очищены: HTTP {code} {text[:120]}')
    api.query(api.DEV_REF, OCHISTKA, write=True)

    log('3/6 накатываю схему')
    api.query(api.DEV_REF, sql, write=True)

    log('4/6 учётки')
    ids = uchetki(env)
    log(f'    {len(ids)} учёток, пароль — DEMO_PASSWORD')

    log('5/6 заливаю данные')
    dannye = demo_data.build(ids, dt.date.today())
    # эпики раньше подзадач: внешний ключ parent_task_id проверяется по каждой пачке
    dannye['tasks'].sort(key=lambda t: t['type'] != 'epic')
    for n, z in enumerate(dannye['expense_requests'], 1):
        z['number'] = f'ER-{n:04d}'  # в бою номер «ЗР-…» ставит база; демо по-английски
    for t in TABLITSY:
        zalit(t, dannye[t], upsert=(t == 'profiles'))
    api.query(api.DEV_REF, f"select setval('public.expense_request_number_seq', {len(dannye['expense_requests'])})",
              write=True)
    api.query(api.DEV_REF, TOLKO_CHTENIE, write=True)

    log('6/6 проверяю')
    schet = api.query(api.DEV_REF, 'select ' + ', '.join(f'(select count(*) from public.{t}) as "{t}"' for t in TABLITSY))[0]
    oshibki = [f'{t}: {schet[t]} из {len(dannye[t])}' for t in TABLITSY if int(schet[t]) != len(dannye[t])]
    if oshibki:
        raise RuntimeError('строк меньше, чем сгенерировано: ' + '; '.join(oshibki))
    log('    ' + ', '.join(f'{t} {schet[t]}' for t in TABLITSY))
    sbrosit_kesh(env, ids)

    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps({'last_full': dt.date.today().isoformat()}), encoding='utf-8')
    log('готово')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--if-due', action='store_true')
    p.add_argument('--ping', action='store_true')
    args = p.parse_args()
    env = okruzhenie()

    if args.ping:
        return ping(env)
    if args.if_due and STATE.exists():
        last = dt.date.fromisoformat(json.loads(STATE.read_text())['last_full'])
        today = dt.date.today()
        if last >= today - dt.timedelta(days=today.weekday()):  # уже пересобирали с понедельника
            return ping(env)
    try:
        peresobrat(env)
    except BaseException as e:
        log(f'ОШИБКА: {e}')
        uvedomit(f'Пересборка демо не прошла: {e}')
        raise


if __name__ == '__main__':
    sys.exit(main())
