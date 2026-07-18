'use client'

import { useState, useTransition } from 'react'
import type { TrashTask } from '@/lib/queries/trash'
import { restoreTask } from '@/app/(dashboard)/trash/actions'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'неизвестно'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} дн назад`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ProjectDot({ color, name }: { color: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs truncate" style={{ color: 'var(--text2)', maxWidth: 120 }}>{name}</span>
    </div>
  )
}

function RestoreButton({ taskId, onRestore }: { taskId: string; onRestore: (id: string) => void }) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await restoreTask(taskId)
      onRestore(taskId)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
      style={{
        background: 'rgba(124,92,246,0.1)',
        color: 'var(--accent)',
        cursor: pending ? 'default' : 'pointer',
        border: '1px solid rgba(124,92,246,0.2)',
      }}
      onMouseEnter={e => { if (!pending) e.currentTarget.style.background = 'rgba(124,92,246,0.18)' }}
      onMouseLeave={e => { if (!pending) e.currentTarget.style.background = 'rgba(124,92,246,0.1)' }}
    >
      {pending ? (
        <span
          className="w-3 h-3 rounded-full border border-t-transparent animate-spin shrink-0"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1.5 6A4.5 4.5 0 106 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M1.5 3v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {pending ? 'Восстанавливаю…' : 'Восстановить'}
    </button>
  )
}

export default function TrashClient({ initialTasks }: { initialTasks: TrashTask[] }) {
  const [tasks, setTasks] = useState(initialTasks)

  function handleRestore(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="px-8 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(136,146,164,0.12)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 5h12M7 5V3.5A1.5 1.5 0 018.5 2h1A1.5 1.5 0 0111 3.5V5M5 5l.75 9.5A1.5 1.5 0 007.25 16h3.5a1.5 1.5 0 001.5-1.5L13 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text2)' }}/>
              <path d="M7.5 8.5v4M10.5 8.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ color: 'var(--text2)' }}/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Корзина</h1>
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              {tasks.length > 0 ? `${tasks.length} удалённых задач` : 'Пусто'}
            </p>
          </div>
        </div>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-auto px-8 py-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(136,146,164,0.08)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 6.5h16M8 6.5V4.5A2 2 0 0110 2.5h4a2 2 0 012 2v2M6 6.5l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text2)', opacity: 0.4 }}/>
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--text2)', opacity: 0.6 }}>Корзина пуста</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5" style={{ maxWidth: 760 }}>
            {tasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                }}
              >
                {/* Иконка типа */}
                <div className="shrink-0">
                  {task.type === 'epic' ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--yellow)' }}>
                      <path d="M8 1.5L3 7.5h4l-1 4 5-6H8l.5-4.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(247,192,79,0.15)"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text2)', opacity: 0.4 }}>
                      <rect x="1.5" y="1.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.2"/>
                    </svg>
                  )}
                </div>

                {/* Название */}
                <p
                  className="text-sm flex-1 min-w-0 truncate"
                  style={{ color: 'var(--text)' }}
                  title={task.title}
                >
                  {task.title}
                </p>

                {/* Проект */}
                <div className="hidden sm:flex shrink-0" style={{ width: 160 }}>
                  <ProjectDot color={task.project_color} name={task.project_name} />
                </div>

                {/* Кто удалил */}
                <div className="hidden md:block shrink-0" style={{ width: 120 }}>
                  {task.deleter_name ? (
                    <span className="text-xs truncate block" style={{ color: 'var(--text2)' }}>
                      {task.deleter_name}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text2)', opacity: 0.4 }}>—</span>
                  )}
                </div>

                {/* Когда удалено */}
                <div className="hidden md:block shrink-0" style={{ width: 100 }}>
                  <span className="text-xs" style={{ color: 'var(--text2)' }}>
                    {timeAgo(task.deleted_at)}
                  </span>
                </div>

                {/* Кнопка */}
                <RestoreButton taskId={task.id} onRestore={handleRestore} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
