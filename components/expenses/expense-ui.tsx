'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ExpenseCategory, ExpenseRequest, ExpenseStatus } from '@/types'

export const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'equipment', label: 'Оборудование' },
  { value: 'software',  label: 'ПО и подписки' },
  { value: 'services',  label: 'Услуги' },
  { value: 'office',    label: 'Хознужды' },
  { value: 'marketing', label: 'Маркетинг' },
  { value: 'other',     label: 'Прочее' },
]

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

export const STATUS_META: Record<ExpenseStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'На рассмотрении', color: '#F7C04F', bg: 'rgba(247,192,79,0.15)' },
  approved:  { label: 'Одобрено',        color: '#2DD4A0', bg: 'rgba(45,212,160,0.15)' },
  rejected:  { label: 'Отклонено',       color: '#F75C6E', bg: 'rgba(247,92,110,0.15)' },
  needs_info:{ label: 'На доработку',    color: '#4F8EF7', bg: 'rgba(79,142,247,0.15)' },
  cancelled: { label: 'Отозвано',        color: '#8892A4', bg: 'rgba(136,146,164,0.15)' },
}

export const PAID_META = { label: 'Оплачено', color: '#7C5CF6', bg: 'rgba(124,92,246,0.15)' }

export function money(value: number, currency = 'KZT'): string {
  const sign = currency === 'KZT' ? '₸' : currency
  return `${Math.round(value).toLocaleString('ru-RU').replace(/,/g, ' ')} ${sign}`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export function personName(p: { full_name: string | null; login: string } | null): string {
  if (!p) return '—'
  return p.full_name || p.login
}

/** Заявка показывается как «Оплачено», хотя статус остаётся «Одобрено» — оплата отдельный шаг. */
export function StatusBadge({ request }: { request: ExpenseRequest }) {
  const meta = request.paid_at ? PAID_META : STATUS_META[request.status] ?? STATUS_META.pending
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md whitespace-nowrap"
      style={{ color: meta.color, background: meta.bg }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

/** Нативный select в проекте запрещён — это его замена. */
export function Dropdown<T extends string>({ value, options, onChange, disabled, placeholder }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const current = options.find(o => o.value === value)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          const r = btnRef.current?.getBoundingClientRect()
          if (r) setPos({ top: r.bottom + 4, left: r.left, width: r.width })
          setOpen(o => !o)
        }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
        style={{
          background: 'var(--surface2)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: current ? 'var(--text)' : 'var(--text2)',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <span className="truncate">{current?.label ?? placeholder ?? 'Выберите'}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && pos && createPortal(
        <div ref={menuRef} className="py-1 rounded-xl"
          style={{
            position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 10000,
            background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out',
          }}>
          {options.map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ color: o.value === value ? 'var(--accent)' : 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span className="truncate">{o.label}</span>
              {o.value === value && (
                <svg className="ml-auto shrink-0" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startDow = (first.getDay() + 6) % 7
  const cells: { day: number; month: number; year: number; current: boolean }[] = []
  const prevDays = new Date(year, month, 0).getDate()
  const prevMon = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  for (let i = startDow - 1; i >= 0; i--) cells.push({ day: prevDays - i, month: prevMon, year: prevYear, current: false })
  const days = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= days; d++) cells.push({ day: d, month, year, current: true })
  const nextMon = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year
  let next = 1
  while (cells.length % 7 !== 0) cells.push({ day: next++, month: nextMon, year: nextYear, current: false })
  return cells
}

/**
 * input type="date" в проекте запрещён — свой календарь.
 * Рендерится порталом с position: fixed, иначе его срезает край модалки с overflow.
 */
export function DatePicker({ value, onChange, placeholder = 'Не указана' }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const [calYear, setCalYear] = useState(value ? parseInt(value.slice(0, 4)) : today.getFullYear())
  const [calMonth, setCalMonth] = useState(value ? parseInt(value.slice(5, 7)) - 1 : today.getMonth())

  const cells = buildCalendar(calYear, calMonth)
  const selected = value ? (() => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d })() : null

  useEffect(() => {
    if (!open) return
    function onOut(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  function toggle() {
    if (open) { setOpen(false); return }
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) {
      const CAL_HEIGHT = 330  // высота с кнопкой «Очистить» ≈305, берём с запасом
      const spaceBelow = window.innerHeight - r.bottom - 12
      // Не хватает места снизу — раскрываем вверх, чтобы календарь не уезжал за экран
      if (spaceBelow >= CAL_HEIGHT) setPos({ top: r.bottom + 4, left: r.left, width: r.width })
      else setPos({ bottom: window.innerHeight - r.top + 4, left: r.left, width: r.width })
    }
    setOpen(true)
  }

  function pick(day: number, month: number, year: number) {
    onChange(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    setOpen(false)
  }

  const display = value ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : placeholder

  return (
    <>
      <button ref={triggerRef} type="button" onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: value ? 'var(--text)' : 'var(--text2)', cursor: 'pointer' }}>
        {display}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4.5 1.5v2M9.5 1.5v2M1.5 5.5h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {open && pos && createPortal(
        <div ref={popRef} className="rounded-xl p-3"
          style={{
            position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left,
            minWidth: Math.max(pos.width, 250), zIndex: 10001,
            background: 'var(--surface2)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
              className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'var(--text2)', cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{MONTHS[calMonth]} {calYear}</span>
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
              const d = new Date(cell.year, cell.month, cell.day); d.setHours(0, 0, 0, 0)
              const isSel = selected?.getTime() === d.getTime()
              return (
                <button key={i} type="button" onClick={() => pick(cell.day, cell.month, cell.year)}
                  className="flex items-center justify-center rounded text-xs"
                  style={{ height: 26, background: isSel ? 'var(--accent)' : 'transparent', color: isSel ? '#fff' : cell.current ? 'var(--text)' : 'var(--text2)', opacity: cell.current ? 1 : 0.3, cursor: 'pointer' }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                  {cell.day}
                </button>
              )
            })}
          </div>
          {value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="w-full mt-2 pt-2 text-xs text-left"
              style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}>
              Очистить
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span className="rounded-full border-2 animate-spin inline-block"
      style={{ width: size, height: size, borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#fff' }} />
  )
}
