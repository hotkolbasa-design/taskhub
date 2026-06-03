'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  full_name: string | null
  login: string | null
  role: string | null
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
]

export default function SidebarNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()

  const initialName = profile?.full_name || profile?.login || 'Пользователь'
  const [displayName, setDisplayName] = useState(initialName)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(initialName)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  async function saveName() {
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === displayName) {
      setEditing(false)
      setEditValue(displayName)
      return
    }
    setDisplayName(trimmed)
    setEditing(false)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ full_name: trimmed }).eq('id', user.id)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') saveName()
    if (e.key === 'Escape') {
      setEditing(false)
      setEditValue(displayName)
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  return (
    <aside
      className="w-[220px] shrink-0 flex flex-col h-full"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Логотип */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          Task Hub
        </span>
      </div>

      {/* Навигация */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {[...navItems, ...(profile?.role === 'admin' ? [adminItem] : [])].map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text2)',
                background: isActive ? 'rgba(79,142,247,0.1)' : 'transparent',
              }}
            >
              {icon}
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Пользователь + выход */}
      <div className="px-3 pb-4 flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)' }}>
        <div
          className="flex items-center gap-2.5 px-3 py-3 rounded-lg cursor-pointer"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => { if (!editing) { setEditing(true); setEditValue(displayName) } }}
          style={{ background: hovered && !editing ? 'var(--surface2)' : 'transparent', transition: 'background 0.15s' }}
          title="Нажмите чтобы изменить имя"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {displayName[0].toUpperCase()}
          </div>

          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-sm bg-transparent outline-none min-w-0"
              style={{
                color: 'var(--text)',
                borderBottom: '1px solid var(--accent)',
              }}
            />
          ) : (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-sm truncate" style={{ color: 'var(--text)' }}>
                {displayName}
              </span>
              {hovered && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text2)', shrink: 0 }}>
                  <path d="M8.5 1.5l2 2L3 11H1v-2L8.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors"
          style={{ color: 'var(--text2)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text2)')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2.5H3A1.5 1.5 0 001.5 4v8A1.5 1.5 0 003 13.5h3M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Выйти
        </button>
      </div>
    </aside>
  )
}
