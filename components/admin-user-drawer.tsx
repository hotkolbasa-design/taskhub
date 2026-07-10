'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { setRole, setStatus, updateUserProfile } from '@/app/(dashboard)/admin/actions'

const ROLES = [
  { value: 'employee', label: 'Employee', color: '#8892A4', bg: 'rgba(136,146,164,0.15)' },
  { value: 'admin',    label: 'Admin',    color: '#7C5CF6', bg: 'rgba(124,92,246,0.15)'  },
]
const STATUSES = [
  { value: 'active',   label: 'Активен',   color: '#2DD4A0', bg: 'rgba(45,212,160,0.15)'  },
  { value: 'inactive', label: 'Неактивен', color: '#F75C6E', bg: 'rgba(247,92,110,0.15)'  },
  { value: 'pending',  label: 'Ожидает',   color: '#F7C04F', bg: 'rgba(247,192,79,0.15)'  },
]
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

export type DrawerUser = {
  id: string
  full_name: string | null
  login: string
  email: string | undefined
  role: string
  status: string
  position: string | null
  department: string | null
  birth_date: string | null
}

function buildCalendar(year: number, month: number) {
  const first   = new Date(year, month, 1)
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

type Props = {
  user: DrawerUser
  isSelf: boolean
  isProtected: boolean
  onClose: () => void
  onUpdated: (userId: string, patch: Partial<DrawerUser>) => void
}

export default function AdminUserDrawer({ user, isSelf, isProtected, onClose, onUpdated }: Props) {
  const canEditRoleStatus = !isSelf && !isProtected
  const canEditProfile    = !isProtected || isSelf

  const [name, setName]             = useState(user.full_name ?? '')
  const [position, setPosition]     = useState(user.position ?? '')
  const [department, setDepartment] = useState(user.department ?? '')
  const [birthDate, setBirthDate]   = useState(user.birth_date ?? '')
  const [currentRole, setCurrentRole]     = useState(user.role)
  const [currentStatus, setCurrentStatus] = useState(user.status)
  const [saving, setSaving] = useState(false)
  const [calOpen, setCalOpen] = useState(false)

  const initYear  = birthDate ? parseInt(birthDate.slice(0, 4)) : new Date().getFullYear() - 25
  const initMonth = birthDate ? parseInt(birthDate.slice(5, 7)) - 1 : 5
  const [calYear, setCalYear]   = useState(initYear)
  const [calMonth, setCalMonth] = useState(initMonth)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    await updateUserProfile(user.id, {
      full_name:  name.trim() || undefined,
      position:   position.trim() || null,
      department: department.trim() || null,
      birth_date: birthDate || null,
    })
    onUpdated(user.id, {
      full_name:  name.trim() || null,
      position:   position.trim() || null,
      department: department.trim() || null,
      birth_date: birthDate || null,
    })
    setSaving(false)
  }

  async function handleRoleChange(next: string) {
    if (next === currentRole || !canEditRoleStatus) return
    setCurrentRole(next)
    onUpdated(user.id, { role: next })
    await setRole(user.id, next as 'admin' | 'employee')
  }

  async function handleStatusChange(next: string) {
    if (next === currentStatus || !canEditRoleStatus) return
    setCurrentStatus(next)
    onUpdated(user.id, { status: next })
    await setStatus(user.id, next as 'active' | 'inactive')
  }

  const cells = buildCalendar(calYear, calMonth)
  const selectedDate = birthDate ? (() => { const d = new Date(birthDate); d.setHours(0,0,0,0); return d })() : null

  function selectDay(day: number, month: number, year: number) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    setBirthDate(`${year}-${mm}-${dd}`)
    setCalOpen(false)
  }

  const displayName = user.full_name || user.login
  const selectableStatuses = currentStatus === 'pending' ? STATUSES : STATUSES.filter(s => s.value !== 'pending')

  const formatBirth = (d: string) => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}.${m}.${y}`
  }

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9990 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="absolute right-0 top-0 h-full flex flex-col"
        style={{ width: 380, background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-16px 0 48px rgba(0,0,0,0.4)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Профиль пользователя</span>
          <button onClick={onClose} style={{ color: 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {/* Avatar + badges */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold shrink-0"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {displayName[0].toUpperCase()}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-1.5 flex-wrap">
                <BadgeDropdown options={ROLES} value={currentRole} disabled={!canEditRoleStatus} onChange={handleRoleChange} />
                <BadgeDropdown options={selectableStatuses} value={currentStatus} disabled={!canEditRoleStatus} onChange={handleStatusChange} />
              </div>
              {isSelf && <span className="text-xs" style={{ color: 'var(--text2)' }}>Это вы</span>}
              {isProtected && !isSelf && <span className="text-xs" style={{ color: 'var(--text2)' }}>Суперадмин</span>}
            </div>
          </div>

          {/* Email */}
          <Field label="Email">
            <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
              {user.email ?? '—'}
            </div>
          </Field>

          {/* Имя */}
          <Field label="Полное имя">
            <input value={name} onChange={e => setName(e.target.value)} disabled={!canEditProfile}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => { if (canEditProfile) e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </Field>

          {/* Должность */}
          <Field label="Должность">
            <input value={position} onChange={e => setPosition(e.target.value)} disabled={!canEditProfile}
              placeholder="Менеджер проектов"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => { if (canEditProfile) e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </Field>

          {/* Отдел */}
          <Field label="Отдел">
            <input value={department} onChange={e => setDepartment(e.target.value)} disabled={!canEditProfile}
              placeholder="Маркетинг"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-50"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => { if (canEditProfile) e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </Field>

          {/* Дата рождения */}
          <Field label="Дата рождения">
            <div className="relative">
              <button type="button" onClick={() => canEditProfile && setCalOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: birthDate ? 'var(--text)' : 'var(--text2)', cursor: canEditProfile ? 'pointer' : 'default', opacity: canEditProfile ? 1 : 0.5 }}
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
                  {/* Year navigation */}
                  <div className="flex items-center justify-between mb-2">
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
                  {/* Month navigation */}
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
                          style={{ height: 26, background: isSel ? 'var(--accent)' : 'transparent', color: isSel ? '#fff' : cell.current ? 'var(--text)' : 'var(--text2)', opacity: cell.current ? 1 : 0.3, cursor: 'pointer' }}
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
        </div>

        {/* Footer */}
        {canEditProfile && (
          <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={handleSave} disabled={saving}
              className="w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
            >
              {saving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              {saving ? 'Сохранение…' : 'Сохранить изменения'}
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

function BadgeDropdown({ options, value, disabled, onChange }: {
  options: { value: string; label: string; color: string; bg: string }[]
  value: string
  disabled: boolean
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function onOut(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md"
        style={{ color: current.color, background: current.bg }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: current.color }} />
        {current.label}
      </span>
    )
  }

  return (
    <>
      <button ref={btnRef} type="button"
        onClick={() => {
          if (btnRef.current) {
            const r = btnRef.current.getBoundingClientRect()
            setPos({ top: r.bottom + 4, left: r.left })
          }
          setOpen(o => !o)
        }}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md"
        style={{ color: current.color, background: current.bg, cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
        onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: current.color }} />
        {current.label}
      </button>

      {open && createPortal(
        <div ref={menuRef} className="py-1 rounded-xl min-w-[130px]"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 10000, background: 'var(--surface2)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out' }}
        >
          {options.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left"
              style={{ color: opt.value === value ? opt.color : 'var(--text)', background: opt.value === value ? opt.bg : 'transparent', cursor: 'pointer' }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent' }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
