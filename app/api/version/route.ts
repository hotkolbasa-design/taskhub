import { NextResponse } from 'next/server'
import { isDemo } from '@/lib/demo/mode'

// Какой коммит сейчас на этом деплое — проверка «доехало ли» без входа и без угадывания по
// содержимому страниц. Репозиторий публичный, хэш коммита ничего не раскрывает.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    env: process.env.VERCEL_ENV ?? 'local',
    demo: isDemo(),
  })
}
