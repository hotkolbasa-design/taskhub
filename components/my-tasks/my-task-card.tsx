'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { MyTask } from '@/lib/queries/my-tasks'
import type { WorkflowStatus } from '@/types'

const AVATAR_COLORS = ['#7C5CF6', '#A78BFA', '#2DD4A0', '#F7C04F', '#F75C6E', '#60C0E8']

function getAvatarColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export const WORKFLOW_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Новая',       color: '#8892A4', bg: 'rgba(136,146,164,0.12)' },
  in_progress: { label: 'В работе',    color: '#7C5CF6', bg: 'rgba(124,92,246,0.12)'  },
  review:      { label: 'На проверке', color: '#F7C04F', bg: 'rgba(247,192,79,0.12)'  },
  done:        { label: 'Выполнена',   color: '#2DD4A0', bg: 'rgba(45,212,160,0.12)'  },
  cancelled:   { label: 'Отменена',    color: '#8892A4', bg: 'rgba(136,146,164,0.08)' },
}

const WORKFLOW_ORDER: WorkflowStatus[] = ['new', 'in_progress', 'review', 'done', 'cancelled']

type Priority = 'medium' | 'high' | null

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  none:   { label: 'Нет',     color: '#8892A4', bg: 'rgba(136,146,164,0.08)' },
  medium: { label: 'Средний', color: '#F7A84F', bg: 'rgba(247,168,79,0.14)'  },
  high:   { label: 'Высокий', color: '#F75C6E', bg: 'rgba(247,92,110,0.14)'  },
}
const PRIORITY_ORDER: (Priority)[] = [null, 'medium', 'high']

function PriorityDropdown({
  value,
  onChange,
}: {
  value: Priority
  onChange: (v: Priority) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const cfg = PRIORITY_CONFIG[value ?? 'none']

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onOut)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onOut)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
    setOpen(o => !o)
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-all shrink-0"
        style={{
          background: cfg.bg,
          color: cfg.color,
          cursor: 'pointer',
          border: `1px solid ${open ? cfg.color : 'transparent'}`,
        }}
        title="Сменить приоритет"
      >
        <svg width="8" height="9" viewBox="0 0 8 9" fill="none">
          <path d="M4 1v4M4 6.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {cfg.label}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.6 }}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropRef}
          className="rounded-xl py-1"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: 150,
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          {PRIORITY_ORDER.map(p => {
            const key = p ?? 'none'
            const c = PRIORITY_CONFIG[key]
            const isSelected = p === value
            return (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); onChange(p); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left"
                style={{ color: isSelected ? c.color : 'var(--text)', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <svg width="8" height="9" viewBox="0 0 8 9" fill="none">
                  <path d="M4 1v4M4 6.5v.5" stroke={c.color} strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {c.label}
                {isSelected && (
                  <svg className="ml-auto" width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5.5L4 7.5L8 3" stroke={c.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}

function StatusDropdown({
  value,
  onChange,
}: {
  value: WorkflowStatus
  onChange: (v: WorkflowStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const wf = WORKFLOW_CONFIG[value] ?? WORKFLOW_CONFIG.new

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onOut)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onOut)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
    setOpen(o => !o)
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-all shrink-0"
        style={{
          background: wf.bg,
          color: wf.color,
          cursor: 'pointer',
          border: `1px solid ${open ? wf.color : 'transparent'}`,
        }}
        title="Сменить статус"
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wf.color }} />
        {wf.label}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.6 }}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropRef}
          className="rounded-xl py-1"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: 170,
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          {WORKFLOW_ORDER.map(status => {
            const cfg = WORKFLOW_CONFIG[status]
            return (
              <button
                key={status}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(status)
                  setOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left"
                style={{ color: status === value ? cfg.color : 'var(--text)', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                {cfg.label}
                {status === value && (
                  <svg className="ml-auto" width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5.5L4 7.5L8 3" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}

type Props = {
  task: MyTask
  currentUserId: string
  onClick: () => void
  onStatusChange: (taskId: string, newStatus: WorkflowStatus) => void
  onPriorityChange: (taskId: string, priority: Priority) => void
}

export default function MyTaskCard({ task, currentUserId, onClick, onStatusChange, onPriorityChange }: Props) {
  const isEpic = task.type === 'epic'
  const isDone = task.workflow_status === 'done' || task.workflow_status === 'cancelled'

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isOverdue = task.deadline && !isDone
    ? (() => { const d = new Date(task.deadline + 'T00:00:00'); d.setHours(0,0,0,0); return d < today })()
    : false

  const deadlineLabel = task.deadline
    ? new Date(task.deadline + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : null

  const assigneeName = task.assignee?.full_name || task.assignee?.login
  const creatorName = task.creator?.full_name || task.creator?.login
  const assigneeInitial = assigneeName?.[0]?.toUpperCase()
  const creatorInitial = creatorName?.[0]?.toUpperCase()
  const assigneeColor = assigneeName ? getAvatarColor(assigneeName) : '#8892A4'
  const creatorColor = creatorName ? getAvatarColor(creatorName) : '#8892A4'

  const isAssignee = task.assignee_id === currentUserId
  const isCreator = task.creator_id === currentUserId

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-3 flex flex-col gap-2.5 select-none"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: isEpic ? '3px solid var(--yellow)' : '1px solid var(--border)',
        cursor: 'pointer',
        opacity: isDone ? 0.65 : 1,
        transition: 'border-color 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(79,142,247,0.4)'
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.2)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isEpic ? 'var(--yellow)' : 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Проект */}
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: task.project_color }} />
        <span className="text-xs truncate flex-1" style={{ color: 'var(--text2)' }}>
          {task.project_name}
        </span>
        {isEpic && (
          <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(247,192,79,0.12)', color: 'var(--yellow)' }}>
            Эпик
          </span>
        )}
      </div>

      {/* Заголовок */}
      <p
        className="text-sm leading-snug"
        style={{
          color: isDone ? 'var(--text2)' : 'var(--text)',
          textDecoration: isDone ? 'line-through' : 'none',
        }}
      >
        {task.title}
      </p>

      {/* Статус (кликабельный) + приоритет */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusDropdown
          value={task.workflow_status as WorkflowStatus}
          onChange={(v) => onStatusChange(task.id, v)}
        />
        <PriorityDropdown
          value={task.priority as Priority}
          onChange={(v) => onPriorityChange(task.id, v)}
        />
        {task.is_recurring && (
          <span className="text-xs" style={{ color: 'var(--text2)' }} title="Повторяющаяся">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M9 5.5a3.5 3.5 0 11-1-2.449M9 1.5v2h-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        )}
      </div>

      {/* Мета: дедлайн, комментарии, аватары */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {deadlineLabel && (
            <span
              className="text-xs flex items-center gap-1"
              style={{ color: isOverdue ? 'var(--red)' : 'var(--text2)', fontFamily: 'var(--font-mono)' }}
            >
              {isOverdue ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 3v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <circle cx="5" cy="7" r="0.5" fill="currentColor"/>
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="1.5" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M3.5 1v2M6.5 1v2M1.5 5h7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                </svg>
              )}
              {deadlineLabel}
            </span>
          )}
          {task.comment_count > 0 && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text2)' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 2a1 1 0 011-1h6a1 1 0 011 1v4a1 1 0 01-1 1H5.5L3 9V7H2a1 1 0 01-1-1V2z" stroke="currentColor" strokeWidth="1.1"/>
              </svg>
              {task.comment_count}
            </span>
          )}
        </div>

        {/* Аватары: постановщик → исполнитель */}
        <div className="flex items-center">
          {task.creator && (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{
                background: task.creator.avatar_url ? 'transparent' : creatorColor,
                color: '#fff',
                outline: '2px solid var(--surface)',
              }}
              title={`Постановщик: ${creatorName}`}
            >
              {task.creator.avatar_url
                ? <img src={task.creator.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                : creatorInitial
              }
            </div>
          )}
          {task.assignee && task.assignee_id !== task.creator_id && (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 -ml-1.5"
              style={{
                background: task.assignee.avatar_url ? 'transparent' : assigneeColor,
                color: '#fff',
                outline: '2px solid var(--surface)',
              }}
              title={`Исполнитель: ${assigneeName}`}
            >
              {task.assignee.avatar_url
                ? <img src={task.assignee.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                : assigneeInitial
              }
            </div>
          )}
          <span className="ml-1.5 text-xs" style={{ color: 'var(--text2)', opacity: 0.7 }}>
            {isAssignee && isCreator ? 'я' : isAssignee ? 'исп.' : isCreator ? 'пост.' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
