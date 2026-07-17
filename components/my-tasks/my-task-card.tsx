'use client'

import type { MyTask } from '@/lib/queries/my-tasks'

const AVATAR_COLORS = ['#7C5CF6', '#A78BFA', '#2DD4A0', '#F7C04F', '#F75C6E', '#60C0E8']

function getAvatarColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const WORKFLOW_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Новая',       color: '#8892A4', bg: 'rgba(136,146,164,0.12)' },
  in_progress: { label: 'В работе',    color: '#7C5CF6', bg: 'rgba(124,92,246,0.12)'  },
  review:      { label: 'На проверке', color: '#F7C04F', bg: 'rgba(247,192,79,0.12)'  },
  done:        { label: 'Выполнена',   color: '#2DD4A0', bg: 'rgba(45,212,160,0.12)'  },
  cancelled:   { label: 'Отменена',    color: '#8892A4', bg: 'rgba(136,146,164,0.08)' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  medium: { label: 'Средний', color: '#F7A84F', bg: 'rgba(247,168,79,0.14)' },
  high:   { label: 'Высокий', color: '#F75C6E', bg: 'rgba(247,92,110,0.14)' },
}

type Props = {
  task: MyTask
  currentUserId: string
  onClick: () => void
}

export default function MyTaskCard({ task, currentUserId, onClick }: Props) {
  const isEpic = task.type === 'epic'
  const wf = WORKFLOW_CONFIG[task.workflow_status] ?? WORKFLOW_CONFIG.new
  const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null
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
        borderLeft: isEpic ? '3px solid var(--yellow)' : `1px solid var(--border)`,
        cursor: 'pointer',
        opacity: isDone ? 0.6 : 1,
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
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: task.project_color }}
        />
        <span className="text-xs truncate" style={{ color: 'var(--text2)' }}>
          {task.project_name}
        </span>
        {isEpic && (
          <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(247,192,79,0.12)', color: 'var(--yellow)' }}>
            Эпик
          </span>
        )}
      </div>

      {/* Заголовок */}
      <p className="text-sm leading-snug" style={{ color: isDone ? 'var(--text2)' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>
        {task.title}
      </p>

      {/* Статус + приоритет */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
          style={{ background: wf.bg, color: wf.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wf.color }} />
          {wf.label}
        </span>
        {priority && (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
            style={{ background: priority.bg, color: priority.color }}
          >
            <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
              <path d="M3.5 1v2.5M3.5 5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {priority.label}
          </span>
        )}
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
          {/* Метка роли текущего пользователя */}
          <span className="ml-1.5 text-xs" style={{ color: 'var(--text2)', opacity: 0.7 }}>
            {isAssignee && isCreator ? 'я' : isAssignee ? 'исп.' : isCreator ? 'пост.' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
