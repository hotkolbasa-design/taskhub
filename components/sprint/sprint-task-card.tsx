'use client'

import type { SprintTask } from '@/types'
import { minutesToDisplay } from '@/lib/utils/time'

const AVATAR_COLORS = ['#7C5CF6', '#A78BFA', '#2DD4A0', '#F7C04F', '#F75C6E', '#60C0E8']

function getAvatarColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

type Props = {
  task: SprintTask
  isOverlay?: boolean
}

export default function SprintTaskCard({ task, isOverlay = false }: Props) {
  const isEpic = task.type === 'epic'

  const now = new Date(); now.setHours(0, 0, 0, 0)
  const isOverdue = task.deadline
    ? (() => { const d = new Date(task.deadline + 'T00:00:00'); d.setHours(0,0,0,0); return d < now })()
    : false

  const deadlineLabel = task.deadline
    ? new Date(task.deadline + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : null

  const assigneeName = task.assignee?.full_name || task.assignee?.login
  const initial = assigneeName?.[0]?.toUpperCase()
  const avatarColor = assigneeName ? getAvatarColor(assigneeName) : '#8892A4'

  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2.5 select-none"
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
        {/* Иконка типа */}
        {isEpic ? (
          <svg
            width="13" height="13" viewBox="0 0 13 13" fill="none"
            style={{ color: 'var(--yellow)', flexShrink: 0, marginTop: 1 }}
          >
            <path
              d="M7.5 1.5L2.5 7.5h4l-1 4 5-6H7l.5-4z"
              stroke="currentColor" strokeWidth="1.2"
              strokeLinecap="round" strokeLinejoin="round"
              fill="rgba(247,192,79,0.15)"
            />
          </svg>
        ) : (
          <svg
            width="13" height="13" viewBox="0 0 13 13" fill="none"
            style={{ color: 'var(--text2)', flexShrink: 0, marginTop: 1, opacity: 0.5 }}
          >
            <rect x="1.5" y="1.5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 6.5l2 2 3.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}

        <p className="text-sm leading-snug" style={{ color: 'var(--text)' }}>
          {task.title}
        </p>
      </div>

      {/* Мета */}
      <div className="flex items-center gap-2 justify-between">
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
