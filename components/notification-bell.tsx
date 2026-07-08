'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { getNotifications, markAsRead, markAllAsRead, type AppNotification } from '@/app/(dashboard)/notifications/actions'

const TYPE_LABEL: Record<string, string> = {
  task_assigned:    'Вас назначили на задачу',
  assignee_changed: 'Изменён исполнитель',
  creator_changed:  'Изменён постановщик',
  status_changed:   'Изменён статус задачи',
  comment_added:    'Новый комментарий',
  deadline_soon:    'Дедлайн завтра',
  deadline_overdue: 'Дедлайн просрочен',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}

function TypeIcon({ type }: { type: string }) {
  if (type === 'comment_added') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--accent)' }}>
      <path d="M2 2.5h10a1 1 0 011 1v5a1 1 0 01-1 1H8.5L6 12V9.5H3a1 1 0 01-1-1v-5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'deadline_overdue') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--red)' }}>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7 4v3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="7" cy="9.5" r="0.6" fill="currentColor"/>
    </svg>
  )
  if (type === 'deadline_soon') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--yellow)' }}>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7 4v3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="7" cy="9.5" r="0.6" fill="currentColor"/>
    </svg>
  )
  if (type === 'task_assigned' || type === 'assignee_changed') return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--accent)' }}>
      <circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2 12c0-2.21 2.239-4 5-4s5 1.79 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text2)' }}>
      <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4 7l2 2 4-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [markingAll, setMarkingAll] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const unreadCount = notifications.filter(n => !n.is_read).length

  const load = useCallback(async () => {
    try {
      const data = await getNotifications()
      setNotifications(data)
    } catch {
      // ignore — таблица ещё не создана или нет сети
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, left: rect.left })
    }
    setOpen(o => !o)
  }

  async function handleClick(n: AppNotification) {
    if (!n.is_read) {
      await markAsRead(n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
    }
    setOpen(false)
    if (n.task && n.task_id) {
      const page = n.task.status === 'sprint' ? 'sprint' : 'backlog'
      router.push(`/projects/${n.task.project_id}/${page}`)
    }
  }

  async function handleMarkAll() {
    setMarkingAll(true)
    await markAllAsRead()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setMarkingAll(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="relative flex items-center justify-center w-7 h-7 rounded-lg transition-all shrink-0"
        style={{ color: 'var(--text)', cursor: 'pointer', background: 'rgba(255,255,255,0.06)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        title="Уведомления"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5A4.5 4.5 0 003.5 6v2.5l-1 2h11l-1-2V6A4.5 4.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-white font-bold rounded-full"
            style={{
              background: 'var(--red)',
              fontSize: 9,
              minWidth: 14,
              height: 14,
              padding: '0 3px',
              lineHeight: '14px',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="rounded-xl"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: 320,
            zIndex: 9999,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          {/* Заголовок */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Уведомления {unreadCount > 0 && <span style={{ color: 'var(--text2)' }}>· {unreadCount}</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="text-xs transition-colors disabled:opacity-50"
                style={{ color: 'var(--accent)', cursor: 'pointer' }}
              >
                {markingAll ? 'Отмечаю…' : 'Прочитать все'}
              </button>
            )}
          </div>

          {/* Список */}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text2)' }}>
                Нет уведомлений
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    background: n.is_read ? 'transparent' : 'rgba(79,142,247,0.06)',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(79,142,247,0.06)')}
                >
                  {/* Иконка типа */}
                  <div className="shrink-0 mt-0.5">
                    <TypeIcon type={n.type} />
                  </div>

                  {/* Текст */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text)' }}>
                        {TYPE_LABEL[n.type] ?? n.type}
                      </p>
                      {!n.is_read && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
                          style={{ background: 'var(--accent)' }}
                        />
                      )}
                    </div>
                    {n.task && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text2)' }}>
                        {n.task.title}
                      </p>
                    )}
                    {n.actor && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text2)', opacity: 0.7 }}>
                        {n.actor.full_name || n.actor.login}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--text2)', opacity: 0.5 }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
