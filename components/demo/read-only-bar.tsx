'use client'

import { useEffect, useRef, useState } from 'react'
import { DEMO_BLOCKED_COOKIE, DEMO_BLOCKED_EVENT, DEMO_READ_ONLY_MESSAGE } from '@/lib/demo/read-only'

// Плашка демо-сайта и подсказка на каждую попытку что-то изменить. Устройство запрета —
// lib/demo/read-only.ts. Рисуется только при isDemoReadOnly() (app/(dashboard)/layout.tsx).

function isServerAction(input: RequestInfo | URL, init?: RequestInit): boolean {
  const h = init?.headers ?? (input instanceof Request ? input.headers : undefined)
  if (!h) return false
  if (h instanceof Headers) return h.has('next-action')
  if (Array.isArray(h)) return h.some(([k]) => k.toLowerCase() === 'next-action')
  return Object.keys(h).some((k) => k.toLowerCase() === 'next-action')
}

function takeBlockedCookie(): boolean {
  if (!document.cookie.split('; ').some((c) => c.startsWith(DEMO_BLOCKED_COOKIE + '='))) return false
  document.cookie = `${DEMO_BLOCKED_COOKIE}=; Max-Age=0; path=/`
  return true
}

export default function DemoReadOnlyBar() {
  const [notice, setNotice] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const show = () => {
      setNotice(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setNotice(false), 4000)
    }

    // Ответы server actions смотрим на лету. Упавшее действие в продакшене приходит без текста
    // ошибки (Next его прячет), и окна показали бы «An error occurred in the Server Components
    // render» — подменяем ответ текстом демо, его Next отдаёт в catch как есть. Действия,
    // которые результат записи не проверяют, отвечают «успех» — о них говорит кука с сервера.
    const original = window.fetch
    const guarded: typeof fetch = async (input, init) => {
      const res = await original.call(window, input, init)
      try {
        if (isServerAction(input, init) && res.status >= 500) {
          takeBlockedCookie()
          show()
          res.body?.cancel().catch(() => {})
          return new Response(DEMO_READ_ONLY_MESSAGE, { status: 403, headers: { 'Content-Type': 'text/plain' } })
        }
        if (takeBlockedCookie() || res.headers.get('x-demo-read-only') === '1') show()
      } catch {
        // подсказка не должна ломать запрос
      }
      return res
    }
    window.fetch = guarded
    window.addEventListener(DEMO_BLOCKED_EVENT, show)
    return () => {
      if (window.fetch === guarded) window.fetch = original
      window.removeEventListener(DEMO_BLOCKED_EVENT, show)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <>
      <div
        role="status"
        className="flex items-center justify-center gap-2 px-4 py-2 text-xs shrink-0"
        style={{ background: 'var(--surface2)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx="8" cy="8" r="2" stroke="var(--accent)" strokeWidth="1.4" />
        </svg>
        <span>
          <span className="font-semibold">Демо-режим: только просмотр</span>
          <span style={{ color: 'var(--text2)' }}> — изменения не сохраняются</span>
        </span>
      </div>
      {notice && (
        <div
          role="alert"
          className="fixed left-1/2 bottom-6 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm shadow-lg"
          style={{ background: 'var(--text)', color: 'var(--surface)', zIndex: 10001, animation: 'dropdownIn 0.15s ease' }}
        >
          {DEMO_READ_ONLY_MESSAGE}
        </div>
      )}
    </>
  )
}
