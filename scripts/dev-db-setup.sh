#!/bin/bash
# Поднимает новый проект Supabase под демо-копию TaskHub и складывает его ключи в .env.local.dev.
# Схему, учётки и данные потом наливает scripts/demo-sync.py.
#
# Зачем: демо для показа работодателям и песочница не должны касаться боевой базы.
#
# Условие: в организации нужен свободный слот. Бесплатный тариф даёт два активных
# проекта, поэтому shop-platform стоит на паузе.
#
# Запуск: bash /Users/marlen/taskhub/scripts/dev-db-setup.sh

set -euo pipefail

SUPABASE=/opt/homebrew/bin/supabase
PROJECT_DIR=/Users/marlen/taskhub
ORG_ID=chxnofxmucxevmifltfc
REGION=ap-northeast-2          # Сеул, как у боевого проекта
NAME=taskhub-dev
ENV_FILE="$PROJECT_DIR/.env.local.dev"

# пароль генерируем питоном: конвейер tr | head даёт SIGPIPE и валит скрипт под pipefail
DB_PASSWORD=$(python3 -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32)))")

echo "1/3 Создаю проект ${NAME}"
"$SUPABASE" projects create "$NAME" --org-id "$ORG_ID" --region "$REGION" --db-password "$DB_PASSWORD"
REF=$("$SUPABASE" projects list -o json | python3 -c "
import json, sys
print(next(p['id'] for p in json.load(sys.stdin) if p['name'] == '$NAME'))")
echo "    ref: $REF"

echo "2/3 Жду, пока база поднимется"
until "$SUPABASE" projects list -o json | python3 -c "
import json, sys
print(next((p['status'] for p in json.load(sys.stdin) if p['id'] == '$REF'), 'PENDING'))" | grep -q ACTIVE_HEALTHY; do
  sleep 10
done

echo "3/3 Сохраняю ключи в ${ENV_FILE}"
python3 - "$REF" "$DB_PASSWORD" <<'PY'
import io, json, re, subprocess, sys
ref, db_password = sys.argv[1], sys.argv[2]
keys = json.loads(subprocess.run(
    ['/opt/homebrew/bin/supabase', 'projects', 'api-keys', '--project-ref', ref, '-o', 'json'],
    capture_output=True, text=True).stdout)
def key(name):
    return next((k['api_key'] for k in keys if k.get('name') == name), '')
prod = io.open('/Users/marlen/taskhub/.env.local.prod', encoding='utf-8').read()
# переменные, не относящиеся к Supabase, переносим из боевого файла
hvost = [l for l in prod.split('\n')
         if l.strip() and not l.startswith('NEXT_PUBLIC_SUPABASE')
         and not l.startswith('SUPABASE_SERVICE_ROLE_KEY')]
io.open('/Users/marlen/taskhub/.env.local.dev', 'w', encoding='utf-8').write('\n'.join([
  f'# Ключи dev-базы TaskHub (проект {ref}).',
  '# Переключение: cp .env.local.dev .env.local  — работать на dev',
  '#               cp .env.local.prod .env.local — вернуться на боевую',
  f'NEXT_PUBLIC_SUPABASE_URL=https://{ref}.supabase.co',
  f'NEXT_PUBLIC_SUPABASE_ANON_KEY={key("anon")}',
  f'SUPABASE_SERVICE_ROLE_KEY={key("service_role")}',
  f'DEV_DB_PASSWORD={db_password}',
  '',
] + hvost) + '\n')
PY
chmod 600 "$ENV_FILE"

echo
echo "Готово. Ключи: $ENV_FILE"
echo "Дальше: вписать ref $REF в DEV_REF (scripts/supabase_api.py) и запустить"
echo "  python3 $PROJECT_DIR/scripts/demo-sync.py"
echo "— он накатит схему с боя, заведёт демо-учётки и зальёт вымышленные данные."
