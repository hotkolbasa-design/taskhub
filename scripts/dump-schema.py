#!/usr/bin/env python3
"""Собирает supabase/baseline.sql — полную схему базы, которую можно развернуть с нуля.

Запросы — в scripts/baseline.py. По умолчанию схема снимается с боевой базы через
read-only эндпоинт Management API: привязка CLI (`supabase link`) не нужна и не меняется.

Запуск:
    python3 /Users/marlen/taskhub/scripts/dump-schema.py
    python3 /Users/marlen/taskhub/scripts/dump-schema.py --ref <ref> --out <файл>
"""

import argparse
import pathlib

import baseline
import supabase_api

OUT = supabase_api.PROJECT / 'supabase' / 'baseline.sql'


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--ref', default=supabase_api.PROD_REF)
    p.add_argument('--out', type=pathlib.Path, default=OUT)
    args = p.parse_args()

    tekst, itogo = baseline.sobrat(args.ref)
    args.out.write_text(tekst, encoding='utf-8')
    print(f'{args.out}: {args.out.stat().st_size // 1024} КБ')
    for kluch, _ in baseline.PORYADOK:
        print(f'  {kluch:12} {itogo[kluch]}')


if __name__ == '__main__':
    main()
