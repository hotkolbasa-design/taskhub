'use client'

import { useState } from 'react'
import AdminUserDrawer, { type DrawerUser } from './admin-user-drawer'
import AdminInviteModal from './admin-invite-modal'

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

export default function AdminUsersClient({ users: initial, emailMap, currentUserId, superAdminId }: Props) {
  const [users, setUsers]         = useState(initial)
  const [drawerUser, setDrawerUser] = useState<DrawerUser | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const pending = users.filter(u => u.status === 'pending')
  const rest    = users.filter(u => u.status !== 'pending')

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
                onClick={() => openDrawer(u)} />
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
              onClick={() => openDrawer(u)} />
          ))}
        </div>
      </section>

      {drawerUser && (
        <AdminUserDrawer
          user={drawerUser}
          isSelf={drawerUser.id === currentUserId}
          isProtected={drawerUser.id === superAdminId}
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

function Row({ user, email, currentUserId, superAdminId, isLast, onClick }: {
  user: UserRow
  email: string | undefined
  currentUserId: string
  superAdminId: string | null
  isLast: boolean
  onClick: () => void
}) {
  const displayName = user.full_name || user.login
  const isSelf = user.id === currentUserId

  const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
    admin:    { color: '#7C5CF6', bg: 'rgba(124,92,246,0.15)' },
    employee: { color: '#8892A4', bg: 'rgba(136,146,164,0.15)' },
  }
  const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
    active:   { color: '#2DD4A0', bg: 'rgba(45,212,160,0.15)' },
    inactive: { color: '#F75C6E', bg: 'rgba(247,92,110,0.15)' },
    pending:  { color: '#F7C04F', bg: 'rgba(247,192,79,0.15)' },
  }
  const STATUS_LABEL: Record<string, string> = { active: 'Активен', inactive: 'Неактивен', pending: 'Ожидает' }
  const ROLE_LABEL: Record<string, string>   = { admin: 'Admin', employee: 'Employee' }

  const roleC   = ROLE_COLORS[user.role]   ?? ROLE_COLORS.employee
  const statusC = STATUS_COLORS[user.status] ?? STATUS_COLORS.inactive

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
        style={{ background: 'var(--accent)', color: '#fff' }}>
        {displayName[0].toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{displayName}</p>
        {user.position && (
          <p className="text-xs truncate" style={{ color: 'var(--accent)', opacity: 0.8 }}>{user.position}</p>
        )}
        <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>{email}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md"
          style={{ color: roleC.color, background: roleC.bg }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: roleC.color }} />
          {ROLE_LABEL[user.role] ?? user.role}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md"
          style={{ color: statusC.color, background: statusC.bg }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusC.color }} />
          {STATUS_LABEL[user.status] ?? user.status}
        </span>
        <span className="text-xs w-7 text-right" style={{ color: 'var(--text2)' }}>
          {isSelf ? 'вы' : ''}
        </span>
      </div>
    </button>
  )
}
