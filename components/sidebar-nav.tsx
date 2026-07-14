'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createPortal } from 'react-dom'
import { getNotifications, markAsRead, markAllAsRead, type AppNotification } from '@/app/(dashboard)/notifications/actions'
import ProfileModal from '@/components/profile-modal'

type Profile = {
  full_name: string | null
  login: string | null
  role: string | null
  position: string | null
}

const adminItem = {
  href: '/admin',
  label: 'Пользователи',
  icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 13.5c0-2.485 2.686-4.5 6-4.5s6 2.015 6 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
}

const crmItem = {
  href: '/crm',
  label: 'CRM',
  icon: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 11.5l3-4 2.5 3 3.5-5.5 2.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
}

const navItems = [
  {
    href: '/dashboard',
    label: 'Дашборд',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: '/my-tasks',
    label: 'Мои задачи',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/projects',
    label: 'Проекты',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1.5 5.5h13M1.5 5.5V12a1.5 1.5 0 001.5 1.5h10A1.5 1.5 0 0014.5 12V5.5M1.5 5.5V4A1.5 1.5 0 013 2.5h2.586a1 1 0 01.707.293L7 3.5h6A1.5 1.5 0 0114.5 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Аналитика',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 11l3.5-4 3 3 4-5.5 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч`
  return `${Math.floor(h / 24)} дн`
}

const TYPE_LABEL: Record<string, string> = {
  task_assigned:    'Назначили на задачу',
  assignee_changed: 'Изменён исполнитель',
  creator_changed:  'Изменён постановщик',
  status_changed:   'Изменён статус',
  comment_added:    'Новый комментарий',
  deadline_soon:    'Дедлайн завтра',
  deadline_overdue: 'Дедлайн просрочен',
}

export default function SidebarNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()

  const displayName = profile?.full_name || profile?.login || 'Пользователь'
  const [signingOut, setSigningOut] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifPos, setNotifPos] = useState({ top: 0, left: 0 })
  const [markingAll, setMarkingAll] = useState(false)
  const notifBtnRef = useRef<HTMLButtonElement>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getNotifications()
      setNotifications(data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  useEffect(() => {
    if (!notifOpen) return
    function onOutside(e: MouseEvent) {
      const t = e.target as Node
      if (
        notifBtnRef.current && !notifBtnRef.current.contains(t) &&
        notifMenuRef.current && !notifMenuRef.current.contains(t)
      ) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [notifOpen])

  function handleNotifOpen() {
    if (notifBtnRef.current) {
      const rect = notifBtnRef.current.getBoundingClientRect()
      setNotifPos({ top: rect.top, left: rect.right + 8 })
    }
    setNotifOpen(o => !o)
  }

  async function handleNotifClick(n: AppNotification) {
    if (!n.is_read) {
      await markAsRead(n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
    }
    setNotifOpen(false)
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

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside
      className="w-[220px] shrink-0 flex flex-col h-full"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Логотип */}
      <div className="px-5 pt-5 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
            <span style={{ color: 'white', fontSize: 14, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>g</span>
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            globalos
          </span>
        </div>
      </div>

      {/* Навигация */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {(() => {
          const isAdmin = profile?.role === 'admin'
          const isMarketer = profile?.position?.toLowerCase() === 'маркетолог'
          const extra = isAdmin ? [crmItem, adminItem] : isMarketer ? [crmItem] : []
          return [...navItems, ...extra]
        })().map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text2)',
                background: isActive ? 'rgba(124,92,246,0.1)' : 'transparent',
              }}
            >
              {icon}
              {label}
            </Link>
          )
        })}

        {/* Уведомления */}
        <button
          ref={notifBtnRef}
          onClick={handleNotifOpen}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left"
          style={{
            color: notifOpen ? 'var(--accent)' : 'var(--text2)',
            background: notifOpen ? 'rgba(124,92,246,0.1)' : 'transparent',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { if (!notifOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.background = 'transparent' }}
        >
          <span className="relative shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5A4.5 4.5 0 003.5 6v2.5l-1 2h11l-1-2V6A4.5 4.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
                style={{ background: 'var(--red)', fontSize: 8, minWidth: 13, height: 13, padding: '0 2px', lineHeight: '13px' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
          Уведомления
          {unreadCount > 0 && (
            <span
              className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--red)', color: '#fff', fontSize: 10 }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </nav>

      {/* Пользователь + выход */}
      <div className="px-3 pb-4 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2.5 px-3 py-3 rounded-lg w-full text-left transition-colors"
          style={{ cursor: 'pointer', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {displayName[0].toUpperCase()}
          </div>
          <span className="text-sm truncate" style={{ color: 'var(--text)' }}>
            {displayName}
          </span>
        </button>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors disabled:opacity-60"
          style={{ color: 'var(--text2)', cursor: 'pointer' }}
          onMouseEnter={(e) => { if (!signingOut) e.currentTarget.style.color = 'var(--red)' }}
          onMouseLeave={(e) => { if (!signingOut) e.currentTarget.style.color = 'var(--text2)' }}
        >
          {signingOut ? (
            <span className="w-4 h-4 rounded-full border border-t-transparent animate-spin shrink-0"
              style={{ borderColor: 'var(--text2)', borderTopColor: 'transparent' }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2.5H3A1.5 1.5 0 001.5 4v8A1.5 1.5 0 003 13.5h3M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {signingOut ? 'Выход…' : 'Выйти'}
        </button>
      </div>

      {/* Дропдаун уведомлений */}
      {notifOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={notifMenuRef}
          className="rounded-xl"
          style={{
            position: 'fixed',
            top: notifPos.top,
            left: notifPos.left,
            width: 320,
            zIndex: 9999,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Уведомления {unreadCount > 0 && <span style={{ color: 'var(--text2)' }}>· {unreadCount}</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="text-xs disabled:opacity-50"
                style={{ color: 'var(--accent)', cursor: 'pointer' }}
              >
                {markingAll ? 'Отмечаю…' : 'Прочитать все'}
              </button>
            )}
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text2)' }}>
                Нет уведомлений
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left"
                  style={{
                    background: n.is_read ? 'transparent' : 'rgba(124,92,246,0.06)',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(124,92,246,0.06)')}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text)' }}>
                        {TYPE_LABEL[n.type] ?? n.type}
                      </p>
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: 'var(--accent)' }} />
                      )}
                    </div>
                    {n.task && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text2)' }}>{n.task.title}</p>
                    )}
                    {n.actor && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text2)', opacity: 0.7 }}>
                        {n.actor.full_name || n.actor.login}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--text2)', opacity: 0.5 }}>{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}

      {profileOpen && (
        <ProfileModal displayName={displayName} onClose={() => setProfileOpen(false)} />
      )}
    </aside>
  )
}
