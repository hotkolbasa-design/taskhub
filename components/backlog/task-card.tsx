'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { deleteTask, moveToSprint } from '@/app/(dashboard)/projects/[id]/backlog/actions'
import { minutesToDisplay } from '@/lib/utils/time'
import type { BacklogTask } from '@/types'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function Avatar({ name, login, size = 24 }: { name: string | null; login: string; size?: number }) {
  const initial = (name || login)[0].toUpperCase()
  return (
    <span
      className="rounded-full flex items-center justify-center text-xs font-medium shrink-0"
      style={{ width: size, height: size, background: 'var(--accent)', color: '#fff', fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  )
}

const PRIORITY_OPTIONS = [
  { value: null,     label: 'Нет',     color: '#8892A4', bg: 'rgba(136,146,164,0.12)' },
  { value: 'medium', label: 'Средний', color: '#F7A84F', bg: 'rgba(247,168,79,0.14)'  },
  { value: 'high',   label: 'Высокий', color: '#F75C6E', bg: 'rgba(247,92,110,0.14)'  },
] as const

function PriorityBadgeDropdown({ priority, taskId, onChange }: {
  priority: 'medium' | 'high' | null
  taskId: string
  onChange: (id: string, priority: 'medium' | 'high' | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const current = PRIORITY_OPTIONS.find(o => o.value === priority) ?? PRIORITY_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom
        if (spaceBelow < 120) {
          setPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left })
        } else {
          setPos({ top: rect.bottom + 4, left: rect.left })
        }
      }
    }
    setOpen(o => !o)
  }

  if (priority === null) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}
        title="Приоритет"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2h6v4l-3 2-3-2V2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
        </svg>
        {open && createPortal(
          <div ref={dropRef} className="py-1 rounded-xl min-w-[130px]"
            style={{ position: 'fixed', ...pos, zIndex: 10000, background: 'var(--surface2)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out' }}>
            {PRIORITY_OPTIONS.map(opt => (
              <button key={String(opt.value)} type="button"
                onClick={e => { e.stopPropagation(); onChange(taskId, opt.value); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left"
                style={{ color: opt.value === priority ? opt.color : 'var(--text)', cursor: 'pointer' }}
                onMouseEnter={e => { if (opt.value !== priority) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (opt.value !== priority) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />
                {opt.label}
              </button>
            ))}
          </div>, document.body
        )}
      </button>
    )
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={handleOpen}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0"
      style={{ background: current.bg, color: current.color, cursor: 'pointer' }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: current.color }} />
      {current.label}
      {open && createPortal(
        <div ref={dropRef} className="py-1 rounded-xl min-w-[130px]"
          style={{ position: 'fixed', ...pos, zIndex: 10000, background: 'var(--surface2)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out' }}>
          {PRIORITY_OPTIONS.map(opt => (
            <button key={String(opt.value)} type="button"
              onClick={e => { e.stopPropagation(); onChange(taskId, opt.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left"
              style={{ color: opt.value === priority ? opt.color : 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => { if (opt.value !== priority) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (opt.value !== priority) e.currentTarget.style.background = 'transparent' }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />
              {opt.label}
            </button>
          ))}
        </div>, document.body
      )}
    </button>
  )
}

const WORKFLOW_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Новая',        color: '#8892A4', bg: 'rgba(136,146,164,0.12)' },
  in_progress: { label: 'В работе',     color: '#7C5CF6', bg: 'rgba(124,92,246,0.12)'  },
  review:      { label: 'На проверке',  color: '#F7C04F', bg: 'rgba(247,192,79,0.12)'  },
  done:        { label: 'Выполнена',    color: '#2DD4A0', bg: 'rgba(45,212,160,0.12)'  },
  cancelled:   { label: 'Отменена',     color: '#8892A4', bg: 'rgba(136,146,164,0.08)' },
}

function WorkflowBadge({ status }: { status: string }) {
  const cfg = WORKFLOW_CONFIG[status] ?? WORKFLOW_CONFIG.new
  return (
    <span
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function WorkflowBadgeDropdown({ status, taskId, onChange }: { status: string; taskId: string; onChange: (id: string, status: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const cfg = WORKFLOW_CONFIG[status] ?? WORKFLOW_CONFIG.new
  const DROP_HEIGHT = 200 // примерная высота дропдауна

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom
        if (spaceBelow < DROP_HEIGHT) {
          setPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left })
        } else {
          setPos({ top: rect.bottom + 4, left: rect.left })
        }
      }
    }
    setOpen(o => !o)
  }

  return (
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-all"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${open ? cfg.color : 'transparent'}` }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
        {cfg.label}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.6 }}>
          <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={dropRef}
          className="py-1 rounded-xl"
          style={{
            position: 'fixed',
            top: pos.top,
            bottom: pos.bottom,
            left: pos.left,
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
            minWidth: 150,
          }}
          onClick={e => e.stopPropagation()}
        >
          {Object.entries(WORKFLOW_CONFIG).map(([key, c]) => (
            <button key={key} type="button"
              onClick={e => { e.stopPropagation(); onChange(taskId, key); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left"
              style={{ color: key === status ? c.color : 'var(--text)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
              {c.label}
              {key === status && (
                <svg className="ml-auto" width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke={c.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

function DeadlineLabel({ deadline, isDone }: { deadline: string; isDone?: boolean }) {
  const date = new Date(deadline)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const isPast = !isDone && date < now
  const isToday = !isDone && date.getTime() === now.getTime()
  const formatted = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  return (
    <span
      className="text-xs flex items-center gap-1"
      style={{ color: isPast ? 'var(--red)' : isToday ? 'var(--yellow)' : 'var(--text2)' }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <rect x="1" y="1.5" width="8" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.1"/>
        <path d="M3 1v1M7 1v1M1 4h8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
      {formatted}
    </span>
  )
}

function DeadlinePickerInline({ deadline, taskId, onChange, isDone }: {
  deadline: string | null | undefined
  taskId: string
  onChange: (id: string, deadline: string | null) => void
  isDone?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const [viewDate, setViewDate] = useState(() => deadline ? new Date(deadline + 'T00:00:00') : new Date())
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const DROP_HEIGHT = 300

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  const date = deadline ? new Date(deadline + 'T00:00:00') : null
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const isPast = !isDone && (date ? date < now : false)
  const isToday = !isDone && (date ? date.getTime() === now.getTime() : false)
  const formatted = date ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : null

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  let startDow = new Date(year, month, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells: { day: number; month: number; year: number; current: boolean }[] = []
  for (let i = startDow - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, month: month - 1, year: month === 0 ? year - 1 : year, current: false })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, month, year, current: true })
  while (cells.length % 7 !== 0) {
    const d = cells.length - daysInMonth - startDow + 1
    cells.push({ day: d, month: month + 1, year: month === 11 ? year + 1 : year, current: false })
  }

  const selectedDate = deadline ? (() => { const d = new Date(deadline + 'T00:00:00'); d.setHours(0,0,0,0); return d })() : null
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) {
        const right = window.innerWidth - rect.right
        const spaceBelow = window.innerHeight - rect.bottom
        if (spaceBelow < DROP_HEIGHT) {
          setPos({ bottom: window.innerHeight - rect.top + 4, right })
        } else {
          setPos({ top: rect.bottom + 4, right })
        }
      }
    }
    setOpen(o => !o)
  }

  function selectDay(day: number, m: number, y: number) {
    const d = new Date(y, m, day)
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    onChange(taskId, iso)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs rounded px-1 py-0.5 transition-colors"
        style={{
          color: isPast ? 'var(--red)' : isToday ? 'var(--yellow)' : 'var(--text2)',
          background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect x="1" y="1.5" width="8" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M3 1v1M7 1v1M1 4h8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        <span style={{ opacity: formatted ? 1 : 0.4 }}>{formatted ?? '—'}</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={dropRef}
          className="rounded-2xl p-3"
          style={{
            position: 'fixed',
            top: pos.top,
            bottom: pos.bottom,
            right: pos.right,
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            animation: 'dropdownIn 0.12s ease-out',
            minWidth: 242,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Навигация */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="w-6 h-6 flex items-center justify-center rounded-lg"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 3L4 6l4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
              {MONTHS[month]} {year}
            </span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="w-6 h-6 flex items-center justify-center rounded-lg"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 3l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Дни недели */}
          <div className="grid grid-cols-7 mb-0.5">
            {WEEKDAYS.map(d => (
              <div key={d} className="flex items-center justify-center h-6" style={{ color: 'var(--text2)', fontSize: 10 }}>{d}</div>
            ))}
          </div>

          {/* Сетка */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              const cellDate = new Date(cell.year, cell.month, cell.day)
              cellDate.setHours(0, 0, 0, 0)
              const isSel = selectedDate && cellDate.getTime() === selectedDate.getTime()
              const isTod = cellDate.getTime() === todayDate.getTime()
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(cell.day, cell.month, cell.year)}
                  className="flex items-center justify-center rounded-lg h-7 w-full transition-colors"
                  style={{
                    fontSize: 11,
                    color: isSel ? '#fff' : !cell.current ? 'rgba(136,146,164,0.35)' : 'var(--text)',
                    background: isSel ? 'var(--accent)' : undefined,
                    border: isTod && !isSel ? '1px solid var(--accent)' : undefined,
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          {deadline && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                type="button"
                onClick={() => { onChange(taskId, null); setOpen(false) }}
                className="w-full text-xs py-1 rounded-lg transition-colors"
                style={{ color: 'var(--text2)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text2)'}
              >
                Очистить
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

function TimePickerInline({ minutes, taskId, onChange }: {
  minutes: number | null | undefined
  taskId: string
  onChange: (id: string, minutes: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const [hours, setHours] = useState('')
  const [mins, setMins] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const DROP_HEIGHT = 130

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  function openPicker(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) {
        const right = window.innerWidth - rect.right
        const spaceBelow = window.innerHeight - rect.bottom
        if (spaceBelow < DROP_HEIGHT) {
          setPos({ bottom: window.innerHeight - rect.top + 4, right })
        } else {
          setPos({ top: rect.bottom + 4, right })
        }
      }
      if (minutes != null) {
        setHours(String(Math.floor(minutes / 60)))
        setMins(String(minutes % 60))
      } else {
        setHours('')
        setMins('')
      }
    }
    setOpen(o => !o)
  }

  function handleSave() {
    const h = parseInt(hours) || 0
    const m = parseInt(mins) || 0
    const total = h * 60 + m
    onChange(taskId, total > 0 ? total : null)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        className="text-xs rounded px-1 py-0.5 transition-colors"
        style={{
          color: 'var(--text2)',
          fontFamily: 'var(--font-mono)',
          background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
          opacity: minutes != null ? 1 : 0.4,
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        {minutes != null ? minutesToDisplay(minutes) : '—'}
      </button>

      {open && pos && createPortal(
        <div
          ref={dropRef}
          className="rounded-xl p-3"
          style={{
            position: 'fixed',
            top: pos.top,
            bottom: pos.bottom,
            right: pos.right,
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
            width: 172,
          }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text2)' }}>Оценка времени</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg flex-1"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <input
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: 'var(--text)', minWidth: 0 }}
                placeholder="0"
                value={hours}
                onChange={e => setHours(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              <span className="text-xs shrink-0 select-none" style={{ color: 'var(--text2)' }}>ч</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg flex-1"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <input
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: 'var(--text)', minWidth: 0 }}
                placeholder="0"
                value={mins}
                onChange={e => setMins(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
              <span className="text-xs shrink-0 select-none" style={{ color: 'var(--text2)' }}>мин</span>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Сохранить
            </button>
            {minutes != null && (
              <button
                type="button"
                onClick={() => { onChange(taskId, null); setOpen(false) }}
                className="px-2.5 py-1.5 rounded-lg text-xs"
                style={{ color: 'var(--text2)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text2)'}
              >
                ×
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

type ExternalDragHandle = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: Record<string, any> | undefined
}

type Props = {
  task: BacklogTask
  projectId: string
  hasActiveSprint: boolean
  isOverlay?: boolean
  sortableDisabled?: boolean
  externalDragHandle?: ExternalDragHandle
  onOptimisticDelete: (id: string) => void
  onOptimisticMoveToSprint: (id: string) => void
  onMoveToBacklog?: (id: string) => void
  onRemoveFromEpic?: (id: string) => void
  onDuplicate?: (task: BacklogTask) => void
  onEdit?: (task: BacklogTask) => void
  onWorkflowChange?: (id: string, status: string) => void
  onPriorityChange?: (id: string, priority: 'medium' | 'high' | null) => void
  onDeadlineChange?: (id: string, deadline: string | null) => void
  onTimeChange?: (id: string, minutes: number | null) => void
  /** Слот в конце строки 1 — для эпиков: счётчик + прогресс-бар + стрелка */
  row1Suffix?: React.ReactNode
  /** Когда true — аватар и меню рендерятся в строке 2 (а не как отдельные элементы рядом) */
  avatarMenuInRow2?: boolean
}

export default function TaskCard({
  task,
  projectId,
  hasActiveSprint,
  isOverlay = false,
  sortableDisabled = false,
  externalDragHandle,
  onOptimisticDelete,
  onOptimisticMoveToSprint,
  onMoveToBacklog,
  onRemoveFromEpic,
  onDuplicate,
  onEdit,
  onWorkflowChange,
  onPriorityChange,
  onDeadlineChange,
  onTimeChange,
  row1Suffix,
  avatarMenuInRow2 = false,
}: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [moving, setMoving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const menuDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onOut = (e: MouseEvent) => {
      const inBtn = menuBtnRef.current?.contains(e.target as Node)
      const inDrop = menuDropRef.current?.contains(e.target as Node)
      if (!inBtn && !inDrop) {
        setMenuOpen(false)
        setDeleteConfirm(false)
      }
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [menuOpen])

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    if (!menuOpen) {
      const rect = menuBtnRef.current?.getBoundingClientRect()
      if (rect) setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setMenuOpen(o => !o)
    setDeleteConfirm(false)
  }

  const {
    attributes: ownAttributes,
    listeners: ownListeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isOverlay || sortableDisabled })

  const handleAttributes = externalDragHandle ? externalDragHandle.attributes : ownAttributes
  const handleListeners = externalDragHandle ? externalDragHandle.listeners : ownListeners

  const style = {
    transform: (isOverlay || sortableDisabled) ? undefined : CSS.Transform.toString(transform),
    transition: (isOverlay || sortableDisabled) ? undefined : transition,
    opacity: (isDragging && !isOverlay && !sortableDisabled) ? 0 : 1,
  }

  async function handleDelete() {
    setDeleting(true)
    setMenuOpen(false)
    onOptimisticDelete(task.id)
    try {
      await deleteTask(task.id, projectId)
    } catch {
      // сервер обновится при следующем refresh
    }
  }

  async function handleMoveToSprint() {
    setMoving(true)
    setMenuOpen(false)
    onOptimisticMoveToSprint(task.id)
    try {
      await moveToSprint(task.id, projectId)
      router.refresh()
    } catch {
      // сервер обновится
    } finally {
      setMoving(false)
    }
  }

  return (
    <div
      ref={(isOverlay || sortableDisabled) ? undefined : setNodeRef}
      style={style}
      className="group flex items-center gap-2 px-3 py-2.5 rounded-lg"
    >
      {/* Drag handle — centered */}
      <button
        {...handleAttributes}
        {...handleListeners}
        className="shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity"
        style={{ color: 'var(--text2)', cursor: 'grab', touchAction: 'none' }}
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/>
          <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
          <circle cx="3" cy="11" r="1.2"/><circle cx="7" cy="11" r="1.2"/>
        </svg>
      </button>

      {/* Две строки */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Строка 1: тип + заголовок + счётчик подзадач */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="shrink-0 w-5 h-5 rounded flex items-center justify-center"
            style={{
              background: task.type === 'epic' ? 'rgba(247,192,79,0.15)' : 'rgba(124,92,246,0.15)',
              color: task.type === 'epic' ? 'var(--yellow)' : 'var(--accent)',
            }}
            title={task.type === 'epic' ? 'Эпик' : 'Задача'}
          >
            {task.type === 'epic' ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 7L4 2L6.5 6L8 4L9 7H1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M3 5l1.5 1.5L7 3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <span
            className="flex-1 text-sm truncate"
            style={{ color: 'var(--text)', cursor: onEdit ? 'pointer' : 'default' }}
            onClick={() => onEdit?.(task)}
            onMouseEnter={e => { if (onEdit) e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text)' }}
          >
            {task.title}
          </span>
          {/* Дефолтный счётчик подзадач — скрывается когда есть row1Suffix */}
          {task.type === 'epic' && task.subtask_total > 0 && !row1Suffix && (
            <span className="text-xs shrink-0" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
              {task.subtask_done}/{task.subtask_total}
            </span>
          )}
          {row1Suffix}
        </div>

        {/* Строка 2: статус + приоритет + время + дедлайн [+ аватар+меню если avatarMenuInRow2] */}
        <div className="flex items-center gap-2">
          {onWorkflowChange
            ? <WorkflowBadgeDropdown status={task.workflow_status ?? 'new'} taskId={task.id} onChange={onWorkflowChange} />
            : <WorkflowBadge status={task.workflow_status ?? 'new'} />
          }
          {onPriorityChange && (
            <PriorityBadgeDropdown priority={task.priority ?? null} taskId={task.id} onChange={onPriorityChange} />
          )}
          {onTimeChange
            ? <TimePickerInline minutes={task.time_estimate} taskId={task.id} onChange={onTimeChange} />
            : task.time_estimate != null && (
              <span className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                {minutesToDisplay(task.time_estimate)}
              </span>
            )
          }
          {onDeadlineChange
            ? <DeadlinePickerInline deadline={task.deadline} taskId={task.id} onChange={onDeadlineChange} isDone={task.workflow_status === 'done'} />
            : task.deadline && <DeadlineLabel deadline={task.deadline} isDone={task.workflow_status === 'done'} />
          }
          {avatarMenuInRow2 && task.assignee && (
            <span className="ml-auto shrink-0">
              <Avatar name={task.assignee.full_name} login={task.assignee.login} />
            </span>
          )}
          {avatarMenuInRow2 && (
            <button
              ref={menuBtnRef}
              type="button"
              onClick={openMenu}
              className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-md transition-all"
              style={{
                color: 'var(--text2)',
                background: menuOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
                opacity: menuOpen ? 1 : undefined,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' } }}
              title="Действия"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <circle cx="7" cy="3" r="1.2"/>
                <circle cx="7" cy="7" r="1.2"/>
                <circle cx="7" cy="11" r="1.2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Аватар — только когда НЕ avatarMenuInRow2 */}
      {!avatarMenuInRow2 && task.assignee && (
        <Avatar name={task.assignee.full_name} login={task.assignee.login} />
      )}

      {/* Меню «...» — только когда НЕ avatarMenuInRow2 */}
      {!avatarMenuInRow2 && (
      <button
        ref={menuBtnRef}
        type="button"
        onClick={openMenu}
        className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-md transition-all"
        style={{
          color: 'var(--text2)',
          background: menuOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
          opacity: menuOpen ? 1 : undefined,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' } }}
        title="Действия"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="3" r="1.2"/>
          <circle cx="7" cy="7" r="1.2"/>
          <circle cx="7" cy="11" r="1.2"/>
        </svg>
      </button>
      )}

      {menuOpen && menuPos && createPortal(
        <div
          ref={menuDropRef}
          className="py-1 rounded-xl"
          style={{
            position: 'fixed',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            animation: 'dropdownIn 0.12s ease-out',
            minWidth: 168,
          }}
          onClick={e => e.stopPropagation()}
        >
          {hasActiveSprint && !onMoveToBacklog && (
            <button
              type="button"
              onClick={handleMoveToSprint}
              disabled={moving}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
              style={{ color: 'var(--accent)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {moving
                ? <span className="w-3.5 h-3.5 rounded-full border border-t-transparent animate-spin shrink-0" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                : <svg width="13" height="13" viewBox="0 0 10 10" fill="none" className="shrink-0">
                    <path d="M2 5h6M6 3l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
              }
              В спринт
            </button>
          )}

          {!!onMoveToBacklog && (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onMoveToBacklog(task.id) }}
              disabled={moving}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <svg width="13" height="13" viewBox="0 0 10 10" fill="none" className="shrink-0">
                <path d="M8 5H2M4 3L2 5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              В бэклог
            </button>
          )}

          {!!onRemoveFromEpic && !!task.parent_task_id && (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onRemoveFromEpic(task.id) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <rect x="1.5" y="4.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8.5 7h4M10.5 5l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Убрать из эпика
            </button>
          )}

          {!!onDuplicate && task.type === 'task' && (
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onDuplicate(task) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
              style={{ color: 'var(--text2)', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <rect x="1" y="4" width="8" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4 4V2.5A1.5 1.5 0 015.5 1H11a1.5 1.5 0 011.5 1.5V9A1.5 1.5 0 0111 10.5H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Дублировать
            </button>
          )}

          {((hasActiveSprint && !onMoveToBacklog) || !!onMoveToBacklog || (!!onRemoveFromEpic && !!task.parent_task_id) || (!!onDuplicate && task.type === 'task')) && (
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
          )}

          {deleteConfirm ? (
            <>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
                style={{ color: 'var(--red)', background: 'rgba(247,92,110,0.08)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(247,92,110,0.14)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(247,92,110,0.08)'}
              >
                {deleting
                  ? <span className="w-3.5 h-3.5 rounded-full border border-t-transparent animate-spin shrink-0" style={{ borderColor: 'var(--red)', borderTopColor: 'transparent' }} />
                  : <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0">
                      <path d="M1.75 3.5h10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M4.667 3.5V2.333A.583.583 0 015.25 1.75h3.5a.583.583 0 01.583.583V3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <rect x="2.333" y="3.5" width="9.333" height="8.75" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                }
                Точно удалить?
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
                style={{ color: 'var(--text2)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Отмена
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
              style={{ color: 'var(--red)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <path d="M1.75 3.5h10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M4.667 3.5V2.333A.583.583 0 015.25 1.75h3.5a.583.583 0 01.583.583V3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <rect x="2.333" y="3.5" width="9.333" height="8.75" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.25 6.417v3.5M8.75 6.417v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Удалить
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
