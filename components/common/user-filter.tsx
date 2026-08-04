'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getAvatarColor } from '@/lib/utils/avatar'

export type FilterUser = { id: string; full_name: string | null; login: string; avatar_url?: string | null }

function Avatar({ user, size = 22 }: { user: FilterUser; size?: number }) {
  const name = user.full_name || user.login
  return (
    <span className="rounded-full flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, background: getAvatarColor(user.id), color: '#fff', fontSize: size * 0.42, border: '1.5px solid var(--surface)' }}>
      {name[0]?.toUpperCase()}
    </span>
  )
}

/**
 * Мультиселект по людям для фильтрации задач (общий для «Мои задачи» / бэклога / спринта).
 * Пустой выбор = показывать всех.
 */
export default function UserFilter({
  users,
  selected,
  onChange,
  placeholder = 'Все сотрудники',
}: {
  users: FilterUser[]
  selected: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  function handleOpen() {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) {
      const width = 250
      setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) })
    }
    setOpen(o => !o)
  }

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  const active = selected.length > 0
  const selectedUsers = users.filter(u => selected.includes(u.id))

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
        style={{
          background: active ? 'var(--surface2)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open || active ? 'var(--accent)' : 'var(--border)'}`,
          color: 'var(--text)',
          cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.7, flexShrink: 0 }}>
          <circle cx="6" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 13c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M11 4.2a2.2 2.2 0 0 1 0 4.1M12.5 12.8c0-1.6-.9-2.8-2.2-3.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {active ? (
          <span className="flex items-center" style={{ paddingLeft: 4 }}>
            {selectedUsers.slice(0, 3).map((u, i) => (
              <span key={u.id} style={{ marginLeft: i === 0 ? -4 : -8 }}><Avatar user={u} size={20} /></span>
            ))}
            {selectedUsers.length > 3 && (
              <span className="text-xs font-medium ml-1" style={{ color: 'var(--text2)' }}>+{selectedUsers.length - 3}</span>
            )}
          </span>
        ) : (
          <span style={{ color: 'var(--text2)' }}>{placeholder}</span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropRef}
          className="rounded-xl py-1"
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: 250, maxHeight: 340, overflowY: 'auto', zIndex: 9999,
            background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          <div className="flex items-center justify-between px-3 py-1.5 mb-1" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text2)' }}>По исполнителю</span>
            {active && (
              <button onClick={() => onChange([])} className="text-xs" style={{ color: 'var(--accent)', cursor: 'pointer' }}>
                Сбросить
              </button>
            )}
          </div>
          {users.map(u => {
            const checked = selected.includes(u.id)
            return (
              <button
                key={u.id}
                onClick={() => toggle(u.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
                style={{ color: 'var(--text)', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <span
                  className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                  style={{ border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, background: checked ? 'var(--accent)' : 'transparent' }}
                >
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.2L4 7.2L8 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <Avatar user={u} size={22} />
                <span className="flex-1 truncate">{u.full_name || u.login}</span>
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
