'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createTask } from '@/app/(dashboard)/projects/[id]/backlog/actions'
import { getAvatarColor } from '@/lib/utils/avatar'
import type { BacklogTask } from '@/types'

type Member = { id: string; full_name: string | null; login: string; avatar_url: string | null }

// ─── NumberStepper ───────────────────────────────────────────────────────────

function NumberStepper({ value, onChange, min = 0, max, suffix }: {
  value: string
  onChange: (v: string) => void
  min?: number
  max?: number
  suffix: string
}) {
  function step(dir: 1 | -1) {
    const n = parseInt(value) || 0
    const next = n + dir
    if (next < min) return
    if (max !== undefined && next > max) return
    onChange(String(next))
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center rounded-lg overflow-hidden flex-1"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '')
            if (max !== undefined && v !== '' && parseInt(v) > max) return
            onChange(v)
          }}
          placeholder="0"
          className="bg-transparent outline-none text-sm px-3 py-2 min-w-0"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', width: 44 }}
        />
        <div className="flex flex-col shrink-0" style={{ borderLeft: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => step(1)}
            className="flex items-center justify-center px-1.5"
            style={{ height: 18, color: 'var(--text2)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
          >
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 4.5L4 1.5L7 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            className="flex items-center justify-center px-1.5"
            style={{ height: 18, color: 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
          >
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 1.5L4 4.5L7 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <span className="text-xs shrink-0 select-none" style={{ color: 'var(--text2)' }}>{suffix}</span>
    </div>
  )
}

// ─── UserDropdown ────────────────────────────────────────────────────────────

function EpicDropdown({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: BacklogTask[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.id === value)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: selected ? 'var(--text)' : 'var(--text2)', cursor: 'pointer' }}
      >
        {selected ? (
          <span className="flex-1 truncate">{selected.title}</span>
        ) : <span className="flex-1">Без эпика</span>}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 py-1 rounded-xl z-50 w-full max-h-48 overflow-y-auto"
          style={{ background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out' }}>
          <button type="button" onClick={() => { onChange(''); setOpen(false) }}
            className="w-full flex items-center px-3 py-2 text-sm text-left"
            style={{ color: !value ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >Без эпика</button>
          {options.map(opt => (
            <button key={opt.id} type="button" onClick={() => { onChange(opt.id); setOpen(false) }}
              className="w-full flex items-center px-3 py-2 text-sm text-left"
              style={{ color: opt.id === value ? 'var(--accent)' : 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="truncate">{opt.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserDropdown({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Member[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.id === value)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setOpen(o => !o)
  }

  return (
    <div>
      <button ref={btnRef} type="button" onClick={handleOpen}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: selected ? 'var(--text)' : 'var(--text2)', cursor: 'pointer' }}
      >
        {selected ? (
          <>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ background: getAvatarColor(selected.full_name || selected.login), color: '#fff' }}>
              {(selected.full_name || selected.login)[0].toUpperCase()}
            </span>
            <span className="flex-1 truncate">{selected.full_name || selected.login}</span>
          </>
        ) : <span className="flex-1">Не назначено</span>}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={menuRef}
          className="py-1 rounded-xl overflow-y-auto"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: 192,
            zIndex: 9999,
            background: 'var(--surface2)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}>
          <button type="button" onClick={() => { onChange(''); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
            style={{ color: !value ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >Не назначено</button>
          {options.map(opt => (
            <button key={opt.id} type="button" onClick={() => { onChange(opt.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ color: opt.id === value ? 'var(--accent)' : 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{ background: getAvatarColor(opt.full_name || opt.login), color: '#fff' }}>
                {(opt.full_name || opt.login)[0].toUpperCase()}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="truncate font-medium">{opt.full_name || opt.login}</span>
                {opt.full_name && <span className="text-xs truncate" style={{ color: 'var(--text2)' }}>{opt.login}</span>}
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── DatePicker ───────────────────────────────────────────────────────────────

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => value ? new Date(value + 'T00:00:00') : new Date())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Строим сетку дней
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

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const selectedDate = value ? (() => { const d = new Date(value + 'T00:00:00'); d.setHours(0,0,0,0); return d })() : null

  function selectDay(day: number, m: number, y: number) {
    const d = new Date(y, m, day)
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    onChange(iso); setOpen(false)
  }

  function setToday() {
    const now = new Date()
    const iso = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    onChange(iso); setViewDate(now); setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors"
        style={{ background: 'var(--surface2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, color: value ? 'var(--text)' : 'var(--text2)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text2)', flexShrink: 0 }}>
          <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 1v2M10 1v2M1 5.5h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span className="flex-1">{displayValue || 'Выберите дату'}</span>
        {value && (
          <span onClick={e => { e.stopPropagation(); onChange('') }}
            className="p-0.5 rounded transition-colors"
            style={{ color: 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1 rounded-2xl z-50 p-4"
          style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)', animation: 'dropdownIn 0.12s ease-out', minWidth: 268 }}>
          {/* Навигация по месяцу */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {MONTHS[month]} {year}
            </span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Дни недели */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="flex items-center justify-center h-7 text-xs font-medium" style={{ color: 'var(--text2)' }}>{d}</div>
            ))}
          </div>

          {/* Сетка дней */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              const cellDate = new Date(cell.year, cell.month, cell.day)
              cellDate.setHours(0, 0, 0, 0)
              const isToday = cellDate.getTime() === today.getTime()
              const isSelected = selectedDate != null && cellDate.getTime() === selectedDate.getTime()

              return (
                <button key={i} type="button" onClick={() => selectDay(cell.day, cell.month, cell.year)}
                  className="flex items-center justify-center rounded-lg text-xs transition-colors"
                  style={{
                    height: 32,
                    background: isSelected ? 'var(--accent)' : isToday ? 'rgba(124,92,246,0.15)' : 'transparent',
                    color: isSelected ? '#fff' : !cell.current ? 'var(--text2)' : 'var(--text)',
                    opacity: !cell.current ? 0.35 : 1,
                    fontWeight: isToday || isSelected ? 600 : 400,
                    border: isToday && !isSelected ? '1px solid rgba(124,92,246,0.4)' : '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? 'rgba(124,92,246,0.15)' : 'transparent' }}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          {/* Футер */}
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs px-2 py-1 rounded-md transition-colors"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >Очистить</button>
            <button type="button" onClick={setToday}
              className="text-xs px-2 py-1 rounded-md transition-colors"
              style={{ color: 'var(--accent)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,92,246,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >Сегодня</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type Props = {
  projectId: string
  members: Member[]
  epics: BacklogTask[]
  defaultAssigneeId?: string
  onClose: () => void
  onCreated: (task: BacklogTask) => void
  skipCreate?: boolean
}

export default function CreateTaskModal({ projectId, members, epics, defaultAssigneeId = '', onClose, onCreated, skipCreate = false }: Props) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'task' | 'epic'>('task')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId)
  const [deadline, setDeadline] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [parentId, setParentId] = useState('')
  const [priority, setPriority] = useState<'medium' | 'high' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Введите название'); return }
    setLoading(true); setError('')
    try {
      const h = parseInt(hours) || 0
      const m = parseInt(minutes) || 0
      const time_estimate = h * 60 + m || null

      if (!skipCreate) {
        await createTask(projectId, {
          title: title.trim(), type,
          description: description.trim() || null,
          assignee_id: assigneeId || null,
          deadline: deadline || null,
          time_estimate,
          parent_task_id: type === 'task' && parentId ? parentId : null,
          priority: priority || null,
        })
      }

      const member = members.find(m => m.id === assigneeId)
      const optimistic: BacklogTask = {
        id: crypto.randomUUID(),
        project_id: projectId,
        title: title.trim(), type,
        status: 'backlog',
        assignee_id: assigneeId || null,
        creator_id: '',
        deadline: deadline || null,
        time_estimate: h * 60 + m || null,
        parent_task_id: type === 'task' && parentId ? parentId : null,
        sprint_id: null, column_id: null, column_order: null, backlog_order: 9999,
        workflow_status: 'new' as const,
        priority: priority || null,
        is_recurring: false, tags: null, description: description.trim() || null,
        deleted_at: null, deleted_by: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        assignee: member ? { full_name: member.full_name, login: member.login, avatar_url: member.avatar_url } : null,
        subtasks: [], subtask_total: 0, subtask_done: 0,
      }
      onCreated(optimistic)
      onClose()
    } catch (e: any) {
      setError(e.message || 'Ошибка при создании')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div className="w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Новая задача</h2>
          <button onClick={onClose} className="p-1.5 rounded-md" style={{ color: 'var(--text2)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Тип */}
          <div className="flex gap-2">
            {(['task', 'epic'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: type === t ? (t === 'epic' ? 'rgba(247,192,79,0.15)' : 'rgba(124,92,246,0.15)') : 'var(--surface2)',
                  color: type === t ? (t === 'epic' ? 'var(--yellow)' : 'var(--accent)') : 'var(--text2)',
                  border: `1px solid ${type === t ? 'transparent' : 'var(--border)'}`,
                }}
              >
                {t === 'epic' ? 'Эпик' : 'Задача'}
              </button>
            ))}
          </div>

          {/* Название */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Название *</label>
            <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Введите название задачи"
              className="px-3 py-2 rounded-lg text-sm outline-none transition-colors"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Описание */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Добавьте описание..."
              className="px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Исполнитель */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Исполнитель</label>
            <UserDropdown value={assigneeId} onChange={setAssigneeId} options={members} />
          </div>

          {/* Дедлайн + время */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Дедлайн</label>
              <DatePicker value={deadline} onChange={setDeadline} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Оценка времени</label>
              <div className="flex gap-3">
                <NumberStepper value={hours} onChange={setHours} min={0} suffix="ч" />
                <NumberStepper value={minutes} onChange={setMinutes} min={0} max={59} suffix="мин" />
              </div>
            </div>
          </div>

          {/* Приоритет */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Приоритет</label>
            <div className="flex gap-2">
              {([
                { value: null,     label: 'Нет',     color: 'var(--text2)',  bg: 'var(--surface2)',            border: 'var(--border)' },
                { value: 'medium', label: 'Средний', color: '#F7A84F',       bg: 'rgba(247,168,79,0.14)',      border: 'rgba(247,168,79,0.4)' },
                { value: 'high',   label: 'Высокий', color: '#F75C6E',       bg: 'rgba(247,92,110,0.14)',      border: 'rgba(247,92,110,0.4)' },
              ] as const).map(opt => {
                const isSelected = priority === opt.value
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setPriority(isSelected && opt.value !== null ? null : opt.value)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: isSelected ? opt.bg : 'var(--surface2)',
                      color: isSelected ? opt.color : 'var(--text2)',
                      border: `1px solid ${isSelected ? opt.border : 'var(--border)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.value && (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isSelected ? opt.color : 'var(--text2)' }} />
                    )}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Родительский эпик */}
          {type === 'task' && epics.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Эпик (необязательно)</label>
              <EpicDropdown value={parentId} onChange={setParentId} options={epics} />
            </div>
          )}

          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >Отмена</button>
            <button type="submit" disabled={loading || !title.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
