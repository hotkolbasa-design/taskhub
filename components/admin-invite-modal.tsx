'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { inviteUser } from '@/app/(dashboard)/admin/actions'

const ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'admin',    label: 'Admin' },
]

type Props = { onClose: () => void; onDone: () => void }

export default function AdminInviteModal({ onClose, onDone }: Props) {
  const [email, setEmail]       = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole]         = useState<'employee' | 'admin'>('employee')
  const [position, setPosition] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [roleOpen, setRoleOpen] = useState(false)
  const roleBtnRef = useRef<HTMLButtonElement>(null)
  const roleMenuRef = useRef<HTMLDivElement>(null)
  const [rolePos, setRolePos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (!roleOpen) return
    function onOutside(e: MouseEvent) {
      const t = e.target as Node
      if (roleBtnRef.current?.contains(t) || roleMenuRef.current?.contains(t)) return
      setRoleOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [roleOpen])

  function openRole() {
    if (roleBtnRef.current) {
      const r = roleBtnRef.current.getBoundingClientRect()
      setRolePos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setRoleOpen(o => !o)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Укажите email'); return }
    setError('')
    setLoading(true)
    try {
      await inviteUser({ email: email.trim(), full_name: fullName.trim(), role, position: position.trim() })
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка при отправке приглашения')
    } finally {
      setLoading(false)
    }
  }

  const currentRole = ROLES.find(r => r.value === role)!

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Пригласить пользователя</h2>
          <button onClick={onClose} style={{ color: 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <Field label="Email *">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@company.com"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </Field>

          <Field label="Полное имя">
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Иванов Иван"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </Field>

          <Field label="Должность">
            <input
              type="text"
              value={position}
              onChange={e => setPosition(e.target.value)}
              placeholder="Менеджер проектов"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </Field>

          <Field label="Роль">
            <button
              ref={roleBtnRef}
              type="button"
              onClick={openRole}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
            >
              {currentRole.label}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 5.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </Field>

          {error && (
            <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}
            >Отмена</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
            >
              {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              {loading ? 'Отправка…' : 'Отправить приглашение'}
            </button>
          </div>
        </form>
      </div>

      {roleOpen && createPortal(
        <div
          ref={roleMenuRef}
          className="py-1 rounded-xl"
          style={{
            position: 'fixed', top: rolePos.top, left: rolePos.left, width: rolePos.width,
            zIndex: 10000, background: 'var(--surface2)', border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          {ROLES.map(r => (
            <button key={r.value} type="button"
              onClick={() => { setRole(r.value as 'employee' | 'admin'); setRoleOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-left"
              style={{ color: r.value === role ? 'var(--accent)' : 'var(--text)', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {r.label}
              {r.value === role && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>,
    document.body
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>{label}</label>
      {children}
    </div>
  )
}
