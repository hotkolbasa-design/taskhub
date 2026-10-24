"""SQL к базам TaskHub через Management API Supabase — без привязки CLI.

Зачем не `supabase db query --linked`: CLI привязан к одному проекту за раз, и другие
сессии переключают привязку. Запрос, ушедший не в ту базу, уже стоил нам «пропавших»
данных. Здесь проект указывается явно в каждом вызове.

Боевая база читается только через эндпоинт read-only: он выполняет запрос от
supabase_read_only_user в read-only транзакции, так что записать в бой этим модулем
нельзя даже по ошибке в SQL.
"""

import base64
import json
import pathlib
import re
import subprocess

PROD_REF = 'zsmhyuvxldwedshjmvjg'
DEV_REF = 'jvjvugitvnowwfibrplp'
PROJECT = pathlib.Path('/Users/marlen/taskhub')

API = 'https://api.supabase.com/v1/projects'


def token() -> str:
    """Токен Management API из связки ключей — тот же, которым пользуется supabase CLI."""
    raw = subprocess.run(['security', 'find-generic-password', '-s', 'Supabase CLI', '-w'],
                         capture_output=True, text=True).stdout.strip()
    if not raw:
        raise SystemExit('Нет токена Supabase в связке ключей (запись «Supabase CLI»): выполнить supabase login')
    if raw.startswith('go-keyring-base64:'):
        return base64.b64decode(raw.split(':', 1)[1]).decode()
    return raw


def curl(args: list[str], body: str | None = None, timeout: int = 180) -> tuple[int, str]:
    """HTTP через curl: у python.org-сборки на этой машине нет корневых сертификатов."""
    proc = subprocess.run(['curl', '-sS', '-m', str(timeout), '-w', '\n%{http_code}', *args],
                          input=body, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f'curl: {proc.stderr.strip()[:300]}')
    text, _, code = proc.stdout.rpartition('\n')
    return int(code or 0), text


def query(ref: str, sql: str, *, write: bool = False) -> list[dict]:
    """Выполняет SQL и возвращает строки результата последнего оператора."""
    if write and ref == PROD_REF:
        raise SystemExit('Запись в боевую базу через этот модуль запрещена')
    url = f'{API}/{ref}/database/query' + ('' if write else '/read-only')
    code, text = curl(['-X', 'POST', url, '-H', f'Authorization: Bearer {token()}',
                       '-H', 'Content-Type: application/json', '--data-binary', '@-'],
                      body=json.dumps({'query': sql}))
    if code >= 300:
        raise RuntimeError(f'{ref}: HTTP {code}: {text[:600]}')
    data = json.loads(text or '[]')
    return data if isinstance(data, list) else []


def read_env(path: pathlib.Path) -> dict[str, str]:
    env = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        m = re.match(r'^([A-Z0-9_]+)=(.*)$', line)
        if m:
            env[m.group(1)] = m.group(2).strip()
    return env
