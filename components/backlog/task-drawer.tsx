'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateTask } from '@/app/(dashboard)/projects/[id]/backlog/actions'
import { minutesToDisplay } from '@/lib/utils/time'
import CommentsSection from './comments-section'
import type { BacklogTask, WorkflowStatus } from '@/types'

const WORKFLOW_OPTIONS: { value: WorkflowStatus; label: string; color: string; bg: string }[] = [
  { value: 'new',         label: 'Новая',       color: '#8892A4', bg: 'rgba(136,146,164,0.12)' },
  { value: 'in_progress', label: 'В работе',    color: '#7C5CF6', bg: 'rgba(124,92,246,0.12)'  },
  { value: 'review',      label: 'На проверке', color: '#F7C04F', bg: 'rgba(247,192,79,0.12)'  },
  { value: 'done',        label: 'Выполнена',   color: '#2DD4A0', bg: 'rgba(45,212,160,0.12)'  },
  { value: 'cancelled',   label: 'Отменена',    color: '#8892A4', bg: 'rgba(136,146,164,0.08)' },
]

const PRIORITY_OPTIONS = [
  { value: null,     label: 'Без приоритета', color: '#8892A4', bg: 'rgba(136,146,164,0.12)' },
  { value: 'medium', label: 'Средний',        color: '#F7A84F', bg: 'rgba(247,168,79,0.14)'  },
  { value: 'high',   label: 'Высокий',        color: '#F75C6E', bg: 'rgba(247,92,110,0.14)'  },
] as const

function PriorityDropdown({ value, onChange }: { value: 'medium' | 'high' | null; onChange: (v: 'medium' | 'high' | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = PRIORITY_OPTIONS.find(o => o.value === value) ?? PRIORITY_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all"
        style={{ background: current.bg, color: current.color, border: `1px solid ${open ? current.color : 'transparent'}`, cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
        onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: current.color }} />
        {current.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.6 }}>
          <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 py-1 rounded-xl z-50 min-w-[170px]"
          style={{ background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out' }}>
          {PRIORITY_OPTIONS.map(opt => (
            <button key={String(opt.value)} type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ color: opt.value === value ? opt.color : 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />
              {opt.label}
              {opt.value === value && (
                <svg className="ml-auto" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke={opt.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WorkflowDropdown({ value, onChange }: { value: WorkflowStatus; onChange: (v: WorkflowStatus) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = WORKFLOW_OPTIONS.find(o => o.value === value) ?? WORKFLOW_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all"
        style={{ background: current.bg, color: current.color, border: `1px solid ${open ? current.color : 'transparent'}` }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
        onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: current.color }} />
        {current.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.6 }}>
          <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 py-1 rounded-xl z-50 min-w-[160px]"
          style={{ background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out' }}>
          {WORKFLOW_OPTIONS.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ color: opt.value === value ? opt.color : 'var(--text)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />
              {opt.label}
              {opt.value === value && (
                <svg className="ml-auto" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke={opt.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Member = { id: string; full_name: string | null; login: string; avatar_url: string | null }

function UserDropdown({ value, onChange, members }: { value: string; onChange: (v: string) => void; members: Member[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = members.find(m => m.id === value)

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
        style={{ background: 'var(--surface2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, color: selected ? 'var(--text)' : 'var(--text2)' }}
      >
        {selected ? (
          <>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>
              {(selected.full_name || selected.login)[0].toUpperCase()}
            </span>
            <span className="flex-1 truncate">{selected.full_name || selected.login}</span>
          </>
        ) : <span className="flex-1 text-sm" style={{ color: 'var(--text2)' }}>Не назначено</span>}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 py-1 rounded-xl z-50 w-full"
          style={{ background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out' }}>
          <button type="button" onClick={() => { onChange(''); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
            style={{ color: !value ? 'var(--accent)' : 'var(--text2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >Не назначено</button>
          {members.map(m => (
            <button key={m.id} type="button" onClick={() => { onChange(m.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ color: m.id === value ? 'var(--accent)' : 'var(--text)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{ background: m.id === value ? 'var(--accent)' : 'var(--surface)', color: '#fff' }}>
                {(m.full_name || m.login)[0].toUpperCase()}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="truncate font-medium">{m.full_name || m.login}</span>
                {m.full_name && <span className="text-xs truncate" style={{ color: 'var(--text2)' }}>{m.login}</span>}
              </div>
              {m.id === value && (
                <svg className="ml-auto shrink-0" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
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
    cells.push({ day: cells.length - daysInMonth - startDow + 1, month: month + 1, year: month === 11 ? year + 1 : year, current: false })
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
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left"
        style={{ background: 'var(--surface2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, color: value ? 'var(--text)' : 'var(--text2)' }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text2)', flexShrink: 0 }}>
          <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 1v2M10 1v2M1 5.5h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span className="flex-1">{displayValue || 'Выберите дату'}</span>
        {value && (
          <span onClick={e => { e.stopPropagation(); onChange('') }} style={{ color: 'var(--text2)', cursor: 'pointer' }}
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
        <div className="absolute left-0 top-full mt-1 rounded-2xl z-50 p-4"
          style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)', animation: 'dropdownIn 0.12s ease-out', minWidth: 268 }}>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: 'var(--text2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: 'var(--text2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => <div key={d} className="flex items-center justify-center h-7 text-xs font-medium" style={{ color: 'var(--text2)' }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              const cellDate = new Date(cell.year, cell.month, cell.day); cellDate.setHours(0,0,0,0)
              const isToday = cellDate.getTime() === today.getTime()
              const isSelected = selectedDate != null && cellDate.getTime() === selectedDate.getTime()
              return (
                <button key={i} type="button" onClick={() => selectDay(cell.day, cell.month, cell.year)}
                  className="flex items-center justify-center rounded-lg text-xs transition-colors"
                  style={{ height: 32, background: isSelected ? 'var(--accent)' : isToday ? 'rgba(124,92,246,0.15)' : 'transparent', color: isSelected ? '#fff' : !cell.current ? 'var(--text2)' : 'var(--text)', opacity: !cell.current ? 0.35 : 1, fontWeight: isToday || isSelected ? 600 : 400, border: isToday && !isSelected ? '1px solid rgba(124,92,246,0.4)' : '1px solid transparent' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? 'rgba(124,92,246,0.15)' : 'transparent' }}
                >{cell.day}</button>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="text-xs px-2 py-1 rounded-md" style={{ color: 'var(--text2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >Очистить</button>
            <button type="button" onClick={setToday} className="text-xs px-2 py-1 rounded-md" style={{ color: 'var(--accent)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,92,246,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >Сегодня</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

type Props = {
  task: BacklogTask
  projectId: string
  members: Member[]
  epics: BacklogTask[]
  initialComments?: unknown[]
  onClose: () => void
  onUpdated: (updated: Partial<BacklogTask> & { id: string }) => void
}

export default function TaskDrawer({ task, projectId, members, epics, initialComments, onClose, onUpdated }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(task.workflow_status ?? 'new')
  const [priority, setPriority] = useState<'medium' | 'high' | null>(task.priority ?? null)
  const [creatorId, setCreatorId] = useState(task.creator_id ?? '')
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '')
  const [deadline, setDeadline] = useState(task.deadline ?? '')
  const [hours, setHours] = useState(() => task.time_estimate != null ? String(Math.floor(task.time_estimate / 60)) : '')
  const [minutes, setMinutes] = useState(() => task.time_estimate != null ? String(task.time_estimate % 60) : '')
  const [parentId, setParentId] = useState(task.parent_task_id ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Отслеживаем последние сохранённые значения для текстовых полей
  const savedTitle = useRef(task.title)
  const savedDescription = useRef(task.description ?? '')
  const savedTimeEstimate = useRef(task.time_estimate)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  async function save(data: Parameters<typeof updateTask>[2]) {
    setSaveStatus('saving')
    try {
      await updateTask(task.id, projectId, data)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
      router.refresh()
    } catch {
      setSaveStatus('idle')
    }
  }

  async function handleTitleBlur() {
    const val = title.trim()
    if (!val || val === savedTitle.current) return
    savedTitle.current = val
    onUpdated({ id: task.id, title: val })
    await save({ title: val })
  }

  async function handleDescriptionBlur() {
    const val = description || null
    if (val === savedDescription.current) return
    savedDescription.current = description
    onUpdated({ id: task.id, description: val })
    await save({ description: val })
  }

  async function handleWorkflowChange(v: WorkflowStatus) {
    setWorkflowStatus(v)
    onUpdated({ id: task.id, workflow_status: v })
    await save({ workflow_status: v })
  }

  async function handlePriorityChange(v: 'medium' | 'high' | null) {
    setPriority(v)
    onUpdated({ id: task.id, priority: v })
    await save({ priority: v })
  }

  async function handleCreatorChange(v: string) {
    setCreatorId(v)
    onUpdated({ id: task.id, creator_id: v || task.creator_id })
    await save({ creator_id: v || null })
  }

  async function handleAssigneeChange(v: string) {
    setAssigneeId(v)
    const member = members.find(m => m.id === v)
    onUpdated({
      id: task.id,
      assignee_id: v || null,
      assignee: v && member ? { full_name: member.full_name, login: member.login, avatar_url: member.avatar_url } : null,
    })
    await save({ assignee_id: v || null })
  }

  async function handleDeadlineChange(v: string) {
    setDeadline(v)
    onUpdated({ id: task.id, deadline: v || null })
    await save({ deadline: v || null })
  }

  async function handleTimeBlur() {
    const h = parseInt(hours) || 0
    const m = parseInt(minutes) || 0
    const time_estimate = h * 60 + m || null
    if (time_estimate === savedTimeEstimate.current) return
    savedTimeEstimate.current = time_estimate
    onUpdated({ id: task.id, time_estimate })
    await save({ time_estimate })
  }

  async function handleParentChange(v: string) {
    setParentId(v)
    onUpdated({ id: task.id, parent_task_id: v || null })
    await save({ parent_task_id: v || null })
  }

  const availableEpics = epics.filter(e => e.id !== task.id)
  const currentTimeEstimate = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0) || null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)', opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease' }}
        onClick={handleClose}
      />

      {/* Дравер */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: 480,
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.4)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
              {task.type === 'epic' ? 'Эпик' : 'Задача'}
            </span>
            <WorkflowDropdown value={workflowStatus} onChange={handleWorkflowChange} />
            <PriorityDropdown value={priority} onChange={handlePriorityChange} />
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md" style={{ color: 'var(--text2)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Заголовок — вне скролла, всегда виден */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            rows={2}
            className="w-full bg-transparent outline-none resize-none text-lg font-semibold"
            style={{ color: 'var(--text)', lineHeight: 1.6 }}
            placeholder="Название задачи"
          />
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-5">

          {/* Описание */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              rows={4}
              placeholder="Добавьте описание..."
              className="px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            />
          </div>

          {/* Постановщик */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Постановщик</label>
            <UserDropdown value={creatorId} onChange={handleCreatorChange} members={members} />
          </div>

          {/* Исполнитель */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Исполнитель</label>
            <UserDropdown value={assigneeId} onChange={handleAssigneeChange} members={members} />
          </div>

          {/* Дедлайн */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Дедлайн</label>
            <DatePicker value={deadline} onChange={handleDeadlineChange} />
          </div>

          {/* Дата создания */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Дата создания</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text2)', flexShrink: 0 }}>
                <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 1v2M10 1v2M1 5.5h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                {new Date(task.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Оценка времени */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Оценка времени</label>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 flex-1 px-3 py-2 rounded-lg"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <input type="number" value={hours} onChange={e => setHours(e.target.value)}
                  onBlur={handleTimeBlur}
                  placeholder="0" min="0"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                />
                <span className="text-xs shrink-0 select-none" style={{ color: 'var(--text2)' }}>ч</span>
              </div>
              <div className="flex items-center gap-1.5 flex-1 px-3 py-2 rounded-lg"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <input type="number" value={minutes} onChange={e => setMinutes(e.target.value)}
                  onBlur={handleTimeBlur}
                  placeholder="0" min="0" max="59"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                />
                <span className="text-xs shrink-0 select-none" style={{ color: 'var(--text2)' }}>мин</span>
              </div>
            </div>
          </div>

          {/* Родительский эпик (только для задач) */}
          {task.type === 'task' && availableEpics.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Эпик</label>
              <select value={parentId} onChange={e => handleParentChange(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: parentId ? 'var(--text)' : 'var(--text2)', colorScheme: 'dark' }}>
                <option value="">Без эпика</option>
                {availableEpics.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Комментарии */}
        <CommentsSection taskId={task.id} projectId={projectId} initialComments={initialComments} />

        {/* Футер */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
          {saveStatus === 'saving' ? (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text2)' }}>
              <span className="w-3 h-3 rounded-full border-2 animate-spin shrink-0"
                style={{ borderColor: 'rgba(136,146,164,0.3)', borderTopColor: 'var(--text2)' }} />
              Сохранение...
            </span>
          ) : saveStatus === 'saved' ? (
            <span className="text-xs" style={{ color: 'var(--green)' }}>Сохранено ✓</span>
          ) : (
            <span />
          )}
          <button onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--surface2)', color: 'var(--text)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
          >Закрыть</button>
        </div>
      </div>
    </>
  )
}
