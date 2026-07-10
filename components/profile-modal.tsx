'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getMyProfile, updateMyProfile } from '@/app/(dashboard)/profile/actions'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
const ROLE_LABEL: Record<string, string> = { admin: 'Admin', employee: 'Employee' }

function buildCalendar(year: number, month: number) {
  const first    = new Date(year, month, 1)
  const startDow = (first.getDay() + 6) % 7
  const cells: { day: number; month: number; year: number; current: boolean }[] = []
  const prevDays = new Date(year, month, 0).getDate()
  const prevMon  = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  for (let i = startDow - 1; i >= 0; i--) cells.push({ day: prevDays - i, month: prevMon, year: prevYear, current: false })
  const days = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= days; d++) cells.push({ day: d, month, year, current: true })
  const nextMon  = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year
  let next = 1
  while (cells.length % 7 !== 0) cells.push({ day: next++, month: nextMon, year: nextYear, current: false })
  return cells
}

type Props = { onClose: () => void; displayName: string }

export default function ProfileModal({ onClose, displayName }: Props) {
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [email, setEmail]         = useState<string | null>(null)
  const [role, setRole]           = useState('')
  const [name, setName]           = useState('')
  const [position, setPosition]   = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [calOpen, setCalOpen]     = useState(false)

  const initYear  = birthDate ? parseInt(birthDate.slice(0, 4)) : new Date().getFullYear() - 25
  const initMonth = birthDate ? parseInt(birthDate.slice(5, 7)) - 1 : 5
  const [calYear, setCalYear]   = useState(initYear)
  const [calMonth, setCalMonth] = useState(initMonth)

  useEffect(() => {
    getMyProfile().then(p => {
      if (p) {
        setName(p.full_name ?? '')
        setEmail(p.email)
        setRole(p.role ?? '')
        setPosition(p.position ?? '')
        setBirthDate(p.birth_date ?? '')
        if (p.birth_date) {
          setCalYear(parseInt(p.birth_date.slice(0, 4)))
          setCalMonth(parseInt(p.birth_date.slice(5, 7)) - 1)
        }
      }
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    await updateMyProfile({
      full_name: name.trim() || undefined,
      position:  position.trim() || null,
      birth_date: birthDate || null,
    })
    setSaving(false)
    onClose()
  }

  const cells = buildCalendar(calYear, calMonth)
  const selectedDate = birthDate ? (() => { const d = new Date(birthDate); d.setHours(0,0,0,0); return d })() : null

  function selectDay(day: number, month: number, year: number) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    setBirthDate(`${year}-${mm}-${dd}`)
    setCalOpen(false)
  }

  const formatBirth = (d: string) => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}.${m}.${y}`
  }

  const initials = (name || displayName)[0]?.toUpperCase() ?? '?'

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>Мой профиль</span>
          <button onClick={onClose} style={{ color: 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
            </div>
          ) : (
            <>
              {/* Avatar + role */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold shrink-0"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{name || displayName}</p>
                  {role && (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md mt-1"
                      style={{ background: role === 'admin' ? 'rgba(124,92,246,0.15)' : 'rgba(136,146,164,0.15)', color: role === 'admin' ? '#7C5CF6' : '#8892A4' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: role === 'admin' ? '#7C5CF6' : '#8892A4' }} />
                      {ROLE_LABEL[role] ?? role}
                    </span>
                  )}
                </div>
              </div>

              {/* Email */}
              <Field label="Email">
                <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                  {email ?? '—'}
                </div>
              </Field>

              {/* Имя */}
              <Field label="Полное имя">
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Иванов Иван"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </Field>

              {/* Должность */}
              <Field label="Должность">
                <input value={position} onChange={e => setPosition(e.target.value)}
                  placeholder="Менеджер проектов"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </Field>

              {/* Дата рождения */}
              <Field label="Дата рождения">
                <div className="relative">
                  <button type="button" onClick={() => setCalOpen(o => !o)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: birthDate ? 'var(--text)' : 'var(--text2)', cursor: 'pointer' }}
                  >
                    {birthDate ? formatBirth(birthDate) : 'Не указана'}
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4.5 1.5v2M9.5 1.5v2M1.5 5.5h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </button>

                  {calOpen && (
                    <div className="absolute top-full left-0 mt-1 rounded-xl p-3 z-10"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', width: '100%' }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <button type="button" onClick={() => setCalYear(y => y - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'var(--text2)', cursor: 'pointer' }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{calYear}</span>
                        <button type="button" onClick={() => setCalYear(y => y + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'var(--text2)', cursor: 'pointer' }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <button type="button" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
                          className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'var(--text2)', cursor: 'pointer' }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        <span className="text-xs" style={{ color: 'var(--text2)' }}>{MONTHS[calMonth]}</span>
                        <button type="button" onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
                          className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'var(--text2)', cursor: 'pointer' }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-7 mb-1">
                        {WEEKDAYS.map(d => <div key={d} className="flex items-center justify-center h-6 text-xs" style={{ color: 'var(--text2)' }}>{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-0.5">
                        {cells.map((cell, i) => {
                          const d = new Date(cell.year, cell.month, cell.day); d.setHours(0,0,0,0)
                          const isSel = selectedDate?.getTime() === d.getTime()
                          return (
                            <button key={i} type="button" onClick={() => selectDay(cell.day, cell.month, cell.year)}
                              className="flex items-center justify-center rounded text-xs"
                              style={{ height: 28, background: isSel ? 'var(--accent)' : 'transparent', color: isSel ? '#fff' : cell.current ? 'var(--text)' : 'var(--text2)', opacity: cell.current ? 1 : 0.3, cursor: 'pointer' }}
                              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                            >{cell.day}</button>
                          )
                        })}
                      </div>
                      {birthDate && (
                        <button type="button" onClick={() => { setBirthDate(''); setCalOpen(false) }}
                          className="w-full mt-2 pt-2 text-xs text-left" style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                        >Очистить</button>
                      )}
                    </div>
                  )}
                </div>
              </Field>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex gap-2 px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}
            >Отмена</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
            >
              {saving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>
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
