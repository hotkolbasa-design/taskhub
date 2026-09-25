'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { setRole, setStatus, updateUserProfile, resetUserPassword, setCanApproveExpenses } from '@/app/(dashboard)/admin/actions'
import { getAvatarColor } from '@/lib/utils/avatar'

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
  can_approve_expenses: boolean
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

// Кастомный combobox отдела: выбрать существующий или вписать новый («Добавить …»)
function DepartmentCombobox({ value, options, disabled, onChange }: {
  value: string
  options: string[]
  disabled: boolean
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxH: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onScroll = (e: Event) => {
      // скролл внутри самого меню не закрывает его — только скролл страницы/панели
      if (dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    window.addEventListener('scroll', onScroll, true)
    return () => { document.removeEventListener('mousedown', onOut); window.removeEventListener('scroll', onScroll, true) }
  }, [open])

  function openMenu() {
    if (disabled) return
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) {
      const margin = 12
      const spaceBelow = window.innerHeight - r.bottom - margin
      const spaceAbove = r.top - margin
      // Открываем вниз, если снизу достаточно места; иначе вверх. Высоту подгоняем под экран.
      if (spaceBelow >= 220 || spaceBelow >= spaceAbove) {
        setPos({ top: r.bottom + 4, left: r.left, width: r.width, maxH: Math.min(360, spaceBelow) })
      } else {
        setPos({ bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width, maxH: Math.min(360, spaceAbove) })
      }
    }
    setQuery('')
    setOpen(true)
  }

  function select(v: string) { onChange(v); setOpen(false) }

  const q = query.trim()
  const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()))
  const canAdd = q.length > 0 && !options.some(o => o.toLowerCase() === q.toLowerCase())

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm disabled:opacity-50"
        style={{ background: 'var(--surface2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, color: value ? 'var(--text)' : 'var(--text2)', cursor: disabled ? 'default' : 'pointer' }}
      >
        <span className="truncate">{value || 'Не указан'}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={dropRef}
          className="rounded-xl py-1"
          style={{
            position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width,
            maxHeight: pos.maxH, overflowY: 'auto', zIndex: 10000,
            background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          <div className="px-2 pt-1 pb-2">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canAdd) { e.preventDefault(); select(q) } }}
              placeholder="Поиск или новый отдел…"
              className="w-full px-2.5 py-1.5 rounded-md text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <button type="button" onClick={() => select('')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
            style={{ color: 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Не указан
            {!value && <svg className="ml-auto" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>

          {filtered.map(o => (
            <button key={o} type="button" onClick={() => select(o)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ color: o === value ? 'var(--accent)' : 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span className="truncate">{o}</span>
              {o === value && <svg className="ml-auto shrink-0" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}

          {canAdd && (
            <button type="button" onClick={() => select(q)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ color: 'var(--accent)', cursor: 'pointer', borderTop: filtered.length > 0 ? '1px solid var(--border)' : undefined }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,92,246,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              Добавить «{q}»
            </button>
          )}

          {filtered.length === 0 && !canAdd && (
            <div className="px-3 py-2 text-sm" style={{ color: 'var(--text2)' }}>Ничего не найдено</div>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}

type Props = {
  user: DrawerUser
  isSelf: boolean
  isProtected: boolean
  departments: string[]
  onClose: () => void
  onUpdated: (userId: string, patch: Partial<DrawerUser>) => void
}

export default function AdminUserDrawer({ user, isSelf, isProtected, departments, onClose, onUpdated }: Props) {
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
  const [canApprove, setCanApprove] = useState(user.can_approve_expenses)
  const [approveSaving, setApproveSaving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [pwStage, setPwStage] = useState<'idle' | 'confirm' | 'loading' | 'done'>('idle')
  const [newPassword, setNewPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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

  async function handleApproveToggle(next: boolean) {
    setCanApprove(next)
    setApproveSaving(true)
    setApproveError(null)
    try {
      await setCanApproveExpenses(user.id, next)
      onUpdated(user.id, { can_approve_expenses: next })
    } catch (e) {
      setCanApprove(!next)
      setApproveError(e instanceof Error ? e.message : 'Не удалось изменить право')
    }
    setApproveSaving(false)
  }

  async function handleResetPassword() {
    setPwStage('loading')
    setPwError(null)
    try {
      const password = await resetUserPassword(user.id)
      setNewPassword(password)
      setPwStage('done')
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Не удалось сбросить пароль')
      setPwStage('idle')
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(newPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setPwError('Скопируйте пароль вручную')
    }
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
              style={{ background: getAvatarColor(displayName), color: '#fff' }}>
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
            <DepartmentCombobox
              value={department}
              options={departments}
              disabled={!canEditProfile}
              onChange={setDepartment}
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

          {/* Право решать по расходам — отдельно от роли: учредителю нужен только этот раздел */}
          <Field label="Заявки на расходы">
            <button type="button" onClick={() => handleApproveToggle(!canApprove)} disabled={approveSaving}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm disabled:opacity-60"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
              <span>Может одобрять расходы</span>
              <span className="flex items-center rounded-full transition-colors"
                style={{ width: 34, height: 20, padding: 2, background: canApprove ? 'var(--accent)' : 'rgba(255,255,255,0.15)' }}>
                <span className="rounded-full bg-white transition-transform"
                  style={{ width: 16, height: 16, transform: canApprove ? 'translateX(14px)' : 'translateX(0)' }} />
              </span>
            </button>
            {approveError && <span className="text-xs" style={{ color: 'var(--red)' }}>{approveError}</span>}
          </Field>

          {/* Пароль — запасной путь, когда человек не получает письма */}
          {canEditRoleStatus && (
            <Field label="Пароль">
              {pwStage === 'done' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 px-3 py-2 rounded-lg text-sm select-all"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                      {newPassword}
                    </span>
                    <button type="button" onClick={copyPassword}
                      className="px-3 py-2 rounded-lg text-xs shrink-0"
                      style={{ background: copied ? 'rgba(45,212,160,0.15)' : 'var(--surface2)', border: '1px solid var(--border)', color: copied ? 'var(--green)' : 'var(--text2)', cursor: 'pointer' }}>
                      {copied ? 'Скопировано' : 'Копировать'}
                    </button>
                  </div>
                  <span className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                    Передайте пароль лично — второй раз он не покажется. Войдя, человек сменит его на свой через «Забыли пароль?».
                  </span>
                </div>
              ) : pwStage === 'confirm' ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                    Старый пароль перестанет работать. Сбросить?
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleResetPassword}
                      className="flex-1 py-2 rounded-lg text-sm"
                      style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                      Да, сбросить
                    </button>
                    <button type="button" onClick={() => setPwStage('idle')}
                      className="flex-1 py-2 rounded-lg text-sm"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}>
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setPwStage('confirm')} disabled={pwStage === 'loading'}
                  className="w-full py-2 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
                  {pwStage === 'loading' && <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--accent)' }} />}
                  {pwStage === 'loading' ? 'Сброс…' : 'Сбросить пароль'}
                </button>
              )}
              {pwError && <span className="text-xs" style={{ color: 'var(--red)' }}>{pwError}</span>}
            </Field>
          )}
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
