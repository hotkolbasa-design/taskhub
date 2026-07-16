'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Form = { fullName: string; email: string; password: string }

export default function RegisterPage() {
  const [form, setForm] = useState<Form>({ fullName: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName, login: form.email.split('@')[0].toLowerCase() },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="rounded-xl p-8 bg-[#16132A] border border-[#2D2550]">
          <div className="w-12 h-12 rounded-full bg-[#7C5CF6]/15 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#7C5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Регистрация завершена</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Ваш аккаунт ожидает подтверждения администратора
          </p>
        </div>
        <p className="mt-6 text-sm text-gray-500">
          <Link href="/login" className="text-[#7C5CF6] hover:underline">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold text-white mb-8 text-center">Регистрация</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Имя">
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            autoComplete="name"
            value={form.fullName}
            onChange={handleChange}
            className={inputCls}
          />
        </Field>

        <Field label="Email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            className={inputCls}
          />
        </Field>

        <Field label="Пароль">
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            className={inputCls}
          />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-lg py-2.5 bg-[#7C5CF6] text-white text-sm font-medium hover:bg-[#6B4EE0] disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading ? 'Регистрация…' : 'Зарегистрироваться'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Уже есть аккаунт?{' '}
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
