'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import AdminUserDrawer, { type DrawerUser } from './admin-user-drawer'
import AdminInviteModal from './admin-invite-modal'
import { setRole, setStatus } from '@/app/(dashboard)/admin/actions'
import { getAvatarColor } from '@/lib/utils/avatar'

type UserRow = {
  id: string
  full_name: string | null
  login: string
  role: string
  status: string
  position: string | null
  department: string | null
  birth_date: string | null
}

type Props = {
  users: UserRow[]
  emailMap: Record<string, string | undefined>
  currentUserId: string
  superAdminId: string | null
}

const ROLES = [
  { value: 'employee', label: 'Employee', color: '#8892A4', bg: 'rgba(136,146,164,0.15)' },
  { value: 'admin',    label: 'Admin',    color: '#7C5CF6', bg: 'rgba(124,92,246,0.15)'  },
]
const STATUSES = [
  { value: 'active',   label: 'Активен',   color: '#2DD4A0', bg: 'rgba(45,212,160,0.15)'  },
  { value: 'inactive', label: 'Неактивен', color: '#F75C6E', bg: 'rgba(247,92,110,0.15)'  },
  { value: 'pending',  label: 'Ожидает',   color: '#F7C04F', bg: 'rgba(247,192,79,0.15)'  },
]

export default function AdminUsersClient({ users: initial, emailMap, currentUserId, superAdminId }: Props) {
  const [users, setUsers]           = useState(initial)
  const [drawerUser, setDrawerUser] = useState<DrawerUser | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const pending = users.filter(u => u.status === 'pending')
  const rest    = users.filter(u => u.status !== 'pending')

  // Список отделов = уникальные значения по всем пользователям (для дропдауна в профиле)
  const departments = [...new Set(users.map(u => u.department).filter((d): d is string => !!d && d.trim() !== ''))]
    .sort((a, b) => a.localeCompare(b))

  function openDrawer(u: UserRow) {
    setDrawerUser({
      id:         u.id,
      full_name:  u.full_name,
      login:      u.login,
      email:      emailMap[u.id],
      role:       u.role,
      status:     u.status,
      position:   u.position,
      department: u.department,
      birth_date: u.birth_date,
    })
  }

  function handleUpdated(userId: string, patch: Partial<DrawerUser>) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u))
    setDrawerUser(prev => prev && prev.id === userId ? { ...prev, ...patch } : prev)
  }

  function handleInviteDone() {
    setInviteOpen(false)
    window.location.reload()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Пользователи</h1>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Добавить пользователя
        </button>
      </div>

      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text2)' }}>
            Ожидают подтверждения — {pending.length}
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            {pending.map((u, i) => (
              <Row key={u.id} user={u} email={emailMap[u.id]} currentUserId={currentUserId}
                superAdminId={superAdminId} isLast={i === pending.length - 1}
                onClick={() => openDrawer(u)}
                onUpdated={patch => handleUpdated(u.id, patch)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text2)' }}>
          Все пользователи — {users.length}
        </h2>
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          {rest.length === 0 && <p className="px-5 py-4 text-sm" style={{ color: 'var(--text2)' }}>Пусто</p>}
          {rest.map((u, i) => (
            <Row key={u.id} user={u} email={emailMap[u.id]} currentUserId={currentUserId}
              superAdminId={superAdminId} isLast={i === rest.length - 1}
              onClick={() => openDrawer(u)}
              onUpdated={patch => handleUpdated(u.id, patch)} />
          ))}
        </div>
      </section>

      {drawerUser && (
        <AdminUserDrawer
          user={drawerUser}
          isSelf={drawerUser.id === currentUserId}
          isProtected={drawerUser.id === superAdminId}
          departments={departments}
          onClose={() => setDrawerUser(null)}
          onUpdated={handleUpdated}
        />
      )}

      {inviteOpen && (
        <AdminInviteModal onClose={() => setInviteOpen(false)} onDone={handleInviteDone} />
      )}
    </>
  )
}

function Row({ user, email, currentUserId, superAdminId, isLast, onClick, onUpdated }: {
  user: UserRow
  email: string | undefined
  currentUserId: string
  superAdminId: string | null
  isLast: boolean
  onClick: () => void
  onUpdated: (patch: Partial<UserRow>) => void
}) {
  const displayName = user.full_name || user.login
  const isSelf      = user.id === currentUserId
  const isProtected = user.id === superAdminId
  const canEdit     = !isSelf && !isProtected

  const roleOpt   = ROLES.find(r => r.value === user.role)   ?? ROLES[0]
  const statusOpt = STATUSES.find(s => s.value === user.status) ?? STATUSES[0]
  const STATUS_LABEL: Record<string, string> = { active: 'Активен', inactive: 'Неактивен', pending: 'Ожидает' }

  async function handleRoleChange(next: string) {
    onUpdated({ role: next })
    await setRole(user.id, next as 'admin' | 'employee')
  }

  async function handleStatusChange(next: string) {
    const wasPending = user.status === 'pending'
    onUpdated({ status: next })
    await setStatus(user.id, next as 'active' | 'inactive')
    // Обновляем бейдж «ожидают подтверждения» в сайдбаре
    if (wasPending) window.dispatchEvent(new Event('pending-users-changed'))
  }

  const selectableStatuses = user.status === 'pending'
    ? STATUSES
    : STATUSES.filter(s => s.value !== 'pending')

  return (
    <div
      className="w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
        style={{ background: getAvatarColor(displayName), color: '#fff' }}>
        {displayName[0].toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{displayName}</p>
        {user.position && (
          <p className="text-xs truncate" style={{ color: 'var(--accent)', opacity: 0.8 }}>{user.position}</p>
        )}
        <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>{email}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
        {canEdit ? (
          <>
            <BadgeDropdown
              options={ROLES}
              value={user.role}
              onChange={handleRoleChange}
            />
            <BadgeDropdown
              options={selectableStatuses}
              value={user.status}
              onChange={handleStatusChange}
            />
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md"
              style={{ color: roleOpt.color, background: roleOpt.bg }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: roleOpt.color }} />
              {roleOpt.label}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md"
              style={{ color: statusOpt.color, background: statusOpt.bg }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusOpt.color }} />
              {STATUS_LABEL[user.status] ?? user.status}
            </span>
          </>
        )}
        <span className="text-xs w-7 text-right" style={{ color: 'var(--text2)' }}>
          {isSelf ? 'вы' : ''}
        </span>
      </div>
    </div>
  )
}

function BadgeDropdown({ options, value, onChange }: {
  options: { value: string; label: string; color: string; bg: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const btnRef  = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function onOut(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={e => {
          e.stopPropagation()
          if (btnRef.current) {
            const r = btnRef.current.getBoundingClientRect()
            setPos({ top: r.bottom + 4, left: r.left })
          }
          setOpen(o => !o)
        }}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md"
        style={{ color: current.color, background: current.bg, cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
        onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: current.color }} />
        {current.label}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.6 }}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="py-1 rounded-xl min-w-[130px]"
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 10000,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={e => {
                e.stopPropagation()
                onChange(opt.value)
                setOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left"
              style={{
                color: opt.value === value ? opt.color : 'var(--text)',
                background: opt.value === value ? opt.bg : 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent' }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
