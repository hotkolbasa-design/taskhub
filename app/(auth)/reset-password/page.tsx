'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const MIN_LENGTH = 8

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Сессию из ссылки клиент подхватывает асинхронно — первая проверка может прийти раньше неё
  useEffect(() => {
    const supabase = createClient()
    let settled = false

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        settled = true
        setAllowed(true)
        setChecking(false)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true
        setAllowed(true)
        setChecking(false)
      } else {
        setTimeout(() => { if (!settled) setChecking(false) }, 1200)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_LENGTH) {
      setError(`Пароль должен быть не короче ${MIN_LENGTH} символов`)
      return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="w-full max-w-sm flex justify-center">
        <span className="w-6 h-6 rounded-full border-2 border-white/20 border-t-[#7C5CF6] animate-spin inline-block" />
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-4 text-center">Ссылка не действует</h1>
        <p className="text-sm text-gray-400 text-center leading-relaxed">
          Ссылка для смены пароля устарела или уже была использована. Запросите новую — она придёт на почту.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 w-full rounded-lg py-2.5 bg-[#7C5CF6] text-white text-sm font-medium hover:bg-[#6B4EE0] transition-colors cursor-pointer flex items-center justify-center"
        >
          Запросить новую ссылку
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-4 text-center">Пароль изменён</h1>
        <p className="text-sm text-gray-400 text-center leading-relaxed">
          Новый пароль сохранён. Им же входите в следующий раз.
        </p>
        <button
          type="button"
          onClick={() => { window.location.href = '/dashboard' }}
          className="mt-6 w-full rounded-lg py-2.5 bg-[#7C5CF6] text-white text-sm font-medium hover:bg-[#6B4EE0] transition-colors cursor-pointer"
        >
          Перейти в TaskHub
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold text-white mb-2 text-center">Новый пароль</h1>
      <p className="text-sm text-gray-500 mb-8 text-center">Придумайте пароль от {MIN_LENGTH} символов</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Новый пароль">
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Повторите пароль">
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
          />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg py-2.5 bg-[#7C5CF6] text-white text-sm font-medium hover:bg-[#6B4EE0] disabled:opacity-70 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
          )}
          {loading ? 'Сохранение…' : 'Сохранить пароль'}
        </button>
      </form>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg px-3 py-2.5 bg-[#16132A] border border-[#2D2550] text-white text-sm outline-none focus:border-[#7C5CF6] transition-colors placeholder-gray-600'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-gray-400">{label}</label>
      {children}
    </div>
  )
}
