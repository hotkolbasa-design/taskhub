'use client'

import type { SprintTask } from '@/types'
import { minutesToDisplay } from '@/lib/utils/time'

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
  task: SprintTask
  isOverlay?: boolean
}

export default function SprintTaskCard({ task, isOverlay = false }: Props) {
  const isEpic = task.type === 'epic'

  const now = new Date(); now.setHours(0, 0, 0, 0)
  const isOverdue = task.deadline && task.workflow_status !== 'done'
    ? (() => { const d = new Date(task.deadline + 'T00:00:00'); d.setHours(0,0,0,0); return d < now })()
    : false

  const deadlineLabel = task.deadline
    ? new Date(task.deadline + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : null

  const assigneeName = task.assignee?.full_name || task.assignee?.login
  const initial = assigneeName?.[0]?.toUpperCase()
  const avatarColor = assigneeName ? getAvatarColor(assigneeName) : '#8892A4'

  const wf = WORKFLOW_CONFIG[task.workflow_status ?? 'new'] ?? WORKFLOW_CONFIG.new
  const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2 select-none"
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderLeft: isEpic ? '3px solid var(--yellow)' : '1px solid var(--border)',
        boxShadow: isOverlay ? '0 8px 32px rgba(0,0,0,0.5)' : undefined,
        transition: 'border-color 0.12s',
      }}
    >
      {/* Тип + заголовок */}
      <div className="flex items-start gap-1.5">
        {isEpic ? (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
            style={{ color: 'var(--yellow)', flexShrink: 0, marginTop: 1 }}>
            <path d="M7.5 1.5L2.5 7.5h4l-1 4 5-6H7l.5-4z"
              stroke="currentColor" strokeWidth="1.2"
              strokeLinecap="round" strokeLinejoin="round"
              fill="rgba(247,192,79,0.15)" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
            style={{ color: 'var(--text2)', flexShrink: 0, marginTop: 1, opacity: 0.5 }}>
            <rect x="1.5" y="1.5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 6.5l2 2 3.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        <p className="text-sm leading-snug" style={{ color: 'var(--text)' }}>
          {task.title}
        </p>
      </div>

      {/* Статус + приоритет */}
      <div className="flex items-center gap-1.5">
        <span
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0"
          style={{ background: wf.bg, color: wf.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wf.color }} />
          {wf.label}
        </span>
        {priority && (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium shrink-0"
            style={{ background: priority.bg, color: priority.color }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M4 1v3.5M4 6.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            {priority.label}
          </span>
        )}
      </div>

      {/* Мета: дедлайн, время, аватар */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {deadlineLabel && (
            <span
              className="text-xs font-mono flex items-center gap-1"
              style={{ color: isOverdue ? 'var(--red)' : 'var(--text2)' }}
            >
              {isOverdue && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 3v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  <circle cx="5" cy="7" r="0.5" fill="currentColor"/>
                </svg>
              )}
              {deadlineLabel}
            </span>
          )}
          {task.time_estimate != null && task.time_estimate > 0 && (
            <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>
              {minutesToDisplay(task.time_estimate)}
            </span>
          )}
        </div>
        {task.assignee && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: avatarColor, color: '#fff' }}
            title={assigneeName}
          >
            {initial}
          </div>
        )}
      </div>
    </div>
  )
}
