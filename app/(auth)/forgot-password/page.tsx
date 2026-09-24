'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const errorMessages: Record<string, string> = {
  link:    'Ссылка недействительна или устарела. Запросите новую.',
  expired: 'Срок действия ссылки истёк. Запросите новую.',
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  )
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const linkError = searchParams.get('error')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-4 text-center">Письмо отправлено</h1>
        <p className="text-sm text-gray-400 text-center leading-relaxed">
          Если аккаунт с адресом <span className="text-white">{email}</span> существует, на него ушло письмо
          со ссылкой для смены пароля. Ссылка действует час.
        </p>
        <p className="mt-4 text-sm text-gray-500 text-center leading-relaxed">
          Письма нет — проверьте папку «Спам» или{' '}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-[#7C5CF6] hover:underline cursor-pointer"
          >
            отправьте ещё раз
          </button>
          .
        </p>
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="text-[#7C5CF6] hover:underline">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold text-white mb-2 text-center">Восстановление пароля</h1>
      <p className="text-sm text-gray-500 mb-8 text-center">
        Укажите email — пришлём ссылку для смены пароля
      </p>

      {linkError && errorMessages[linkError] && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm text-center"
          style={{ background: 'rgba(247,192,79,0.12)', color: 'var(--yellow)', border: '1px solid rgba(247,192,79,0.2)' }}>
          {errorMessages[linkError]}
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

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg py-2.5 bg-[#7C5CF6] text-white text-sm font-medium hover:bg-[#6B4EE0] disabled:opacity-70 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
          )}
          {loading ? 'Отправка…' : 'Отправить ссылку'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Вспомнили пароль?{' '}
        <Link href="/login" className="text-[#7C5CF6] hover:underline">
          Войти
        </Link>
      </p>
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
