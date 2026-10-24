// Демо-сайт для работодателей — только для просмотра (решение Марлена 24.10.2026).
//
// Запись режется в HTTP-клиенте Supabase, а не правами базы: большинство server actions пишет
// сервисным ключом (createAdminClient), и отзыв прав их бы не остановил. Любой запрос, который
// меняет данные, — REST insert/update/upsert/delete и rpc, загрузка, перенос и удаление файлов,
// auth.admin, регистрация, смена пароля, письма — получает ответ 403 DEMO_READ_ONLY, не уходя
// в сеть. Библиотеки Supabase превращают его в обычный { error }, как отказ самой базы, поэтому
// код действий менять не пришлось. Чтение (GET) идёт как обычно.
//
// Файл общий для сервера и браузера: next/* здесь не импортировать.
import { isDemo } from './mode'

export const DEMO_READ_ONLY_CODE = 'DEMO_READ_ONLY'
export const DEMO_READ_ONLY_MESSAGE = 'Демо-режим: только просмотр, изменения не сохраняются'
/** Кука-сигнал из server action: запись отбита — плашка демо показывает подсказку. */
export const DEMO_BLOCKED_COOKIE = 'taskhub_demo_blocked'
/** То же в браузере: отбитый запрос браузерного клиента Supabase. */
export const DEMO_BLOCKED_EVENT = 'taskhub:demo-blocked'

/** Сервер. DEMO_WRITABLE=1 снимает запрет — только для локальной разработки, на Vercel не ставить. */
export function isDemoReadOnly(): boolean {
  return isDemo() && process.env.DEMO_WRITABLE !== '1'
}

/** Браузер: тот же признак, вшитый при сборке (next.config.ts → env). На проде — false. */
export const DEMO_READ_ONLY_BROWSER = process.env.TASKHUB_DEMO_READ_ONLY === '1'

export class DemoReadOnlyError extends Error {
  code = DEMO_READ_ONLY_CODE
  constructor() {
    super(DEMO_READ_ONLY_MESSAGE)
  }
}

/** Для записи мимо Supabase (листы CRM в памяти демо). */
export function assertDemoWritable(): void {
  if (isDemoReadOnly()) throw new DemoReadOnlyError()
}

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// POST, которые данные не меняют или без которых в демо не войти: вход и обновление токена,
// подтверждение ссылки из письма, подписанные ссылки на скачивание и список файлов.
// Читающую rpc вызывать с { get: true } — POST к /rest/v1/rpc здесь отбивается целиком.
const ALLOWED_WRITE_PATHS = ['/auth/v1/token', '/auth/v1/verify', '/storage/v1/object/sign/', '/storage/v1/object/list/']

function blockedResponse(): Response {
  // code — для PostgREST, error_code — для auth-js, message читают все три клиента
  const body = { code: DEMO_READ_ONLY_CODE, error_code: DEMO_READ_ONLY_CODE, message: DEMO_READ_ONLY_MESSAGE, details: null, hint: null }
  return new Response(JSON.stringify(body), {
    status: 403,
    statusText: 'Forbidden',
    headers: { 'Content-Type': 'application/json' },
  })
}

/** fetch для клиентов Supabase на демо-сайте: чтение пропускает, запись отбивает. */
export function readOnlyFetch(onBlocked?: () => unknown): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (READ_METHODS.has(method)) return fetch(input, init)

    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = new URL(href).pathname
    if (ALLOWED_WRITE_PATHS.some((p) => path.startsWith(p))) return fetch(input, init)

    // Учётка демо общая: выход со scope=global отозвал бы сессии всех, кто сейчас смотрит.
    // Отвечаем «готово», не трогая сервер, — локальную сессию auth-js стирает сам.
    if (path === '/auth/v1/logout') return new Response(null, { status: 204 })

    try {
      await onBlocked?.()
    } catch {
      // подсказка — дело второе, отказ всё равно вернётся
    }
    return blockedResponse()
  }
}

export function notifyDemoBlocked(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DEMO_BLOCKED_EVENT))
}
