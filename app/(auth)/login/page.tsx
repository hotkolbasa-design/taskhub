'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const reasonMessages: Record<string, string> = {
  inactive: 'Ваш аккаунт деактивирован. Обратитесь к администратору.',
  pending:  'Ваш аккаунт ожидает подтверждения администратора.',
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold text-white mb-8 text-center">Вход</h1>

      {reason && reasonMessages[reason] && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm text-center"
          style={{ background: 'rgba(247,192,79,0.12)', color: 'var(--yellow)', border: '1px solid rgba(247,192,79,0.2)' }}>
          {reasonMessages[reason]}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email">
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field
          label="Пароль"
          action={
            <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-[#7C5CF6] transition-colors">
              Забыли пароль?
            </Link>
          }
        >
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? 'Вход…' : 'Войти'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Нет аккаунта?{' '}
        <Link href="/register" className="text-[#7C5CF6] hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  )
}


const inputCls =
  'w-full rounded-lg px-3 py-2.5 bg-[#16132A] border border-[#2D2550] text-white text-sm outline-none focus:border-[#7C5CF6] transition-colors placeholder-gray-600'

function Field({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-400">{label}</label>
        {action}
      </div>
      {children}
    </div>
  )
}
