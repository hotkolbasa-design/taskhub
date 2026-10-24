// Серверная часть «демо только для чтения» (устройство — lib/demo/read-only.ts).
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  DEMO_BLOCKED_COOKIE,
  DEMO_READ_ONLY_CODE,
  DEMO_READ_ONLY_MESSAGE,
  isDemoReadOnly,
  readOnlyFetch,
} from './read-only'

// Половина действий не проверяет результат записи и отвечает «успех» — без сигнала посетитель
// решил бы, что изменение прошло. Кука уходит с ответом server action, плашка демо её читает.
async function markBlocked() {
  try {
    ;(await cookies()).set(DEMO_BLOCKED_COOKIE, '1', { path: '/', maxAge: 30, sameSite: 'lax' })
  } catch {
    // вне server action и route handler куку не поставить — там подсказка и не нужна
  }
}

/** Добавка к опциям клиентов Supabase: на демо-сайте запись отбивается, на проде — пустой объект. */
export function demoReadOnlyOptions(): { global?: { fetch: typeof fetch } } {
  return isDemoReadOnly() ? { global: { fetch: readOnlyFetch(markBlocked) } } : {}
}

/** Ответ маршрута API на попытку записи в демо. */
export function demoReadOnlyResponse() {
  return NextResponse.json(
    { error: DEMO_READ_ONLY_MESSAGE, code: DEMO_READ_ONLY_CODE },
    { status: 403, headers: { 'X-Demo-Read-Only': '1' } },
  )
}
