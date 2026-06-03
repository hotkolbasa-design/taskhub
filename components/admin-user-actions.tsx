'use client'

import { useState } from 'react'
import { approveUser, deactivateUser, setRole } from '@/app/(dashboard)/admin/actions'

type Props = {
  userId: string
  status: string
  role: string
  isSelf: boolean
}

export default function AdminUserActions({ userId, status, role, isSelf }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const [currentRole, setCurrentRole] = useState(role)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loadingRole, setLoadingRole] = useState(false)

  async function toggleStatus() {
    if (loadingStatus) return
    setLoadingStatus(true)
    if (currentStatus === 'active') {
      setCurrentStatus('inactive')
      await deactivateUser(userId)
    } else {
      setCurrentStatus('active')
      await approveUser(userId)
    }
    setLoadingStatus(false)
  }

  async function toggleRole() {
    if (loadingRole) return
    setLoadingRole(true)
    const next = currentRole === 'admin' ? 'employee' : 'admin'
    setCurrentRole(next)
    await setRole(userId, next)
    setLoadingRole(false)
  }

  const statusConfig = {
    active:   { label: 'Активен',   color: 'var(--green)',  bg: 'rgba(45,212,160,0.12)' },
    inactive: { label: 'Неактивен', color: 'var(--red)',    bg: 'rgba(247,92,110,0.12)' },
    pending:  { label: 'Ожидает',   color: 'var(--yellow)', bg: 'rgba(247,192,79,0.12)' },
  }

  const roleConfig = {
    admin:    { label: 'Admin',    color: 'var(--accent)', bg: 'rgba(79,142,247,0.12)' },
    employee: { label: 'Employee', color: 'var(--text2)',  bg: 'rgba(136,146,164,0.12)' },
  }

  const s = statusConfig[currentStatus as keyof typeof statusConfig] ?? statusConfig.inactive
  const r = roleConfig[currentRole as keyof typeof roleConfig] ?? roleConfig.employee

  const isProtected = isSelf || currentRole === 'admin'

  if (isProtected) {
    return (
      <div className="flex items-center gap-2">
        <Badge label={r.label} color={r.color} bg={r.bg} />
        <Badge label={s.label} color={s.color} bg={s.bg} />
        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          {isSelf ? 'вы' : 'admin'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleRole}
        disabled={loadingRole}
        title="Нажмите чтобы сменить роль"
        className="transition-opacity disabled:opacity-50"
      >
        <Badge label={r.label} color={r.color} bg={r.bg} clickable />
      </button>

      <button
        onClick={toggleStatus}
        disabled={loadingStatus || currentStatus === 'pending'}
        title={
          currentStatus === 'pending'
            ? 'Нажмите «Активировать» чтобы подтвердить'
            : currentStatus === 'active'
            ? 'Нажмите чтобы деактивировать'
            : 'Нажмите чтобы активировать'
        }
        className="transition-opacity disabled:opacity-50"
      >
        <Badge label={s.label} color={s.color} bg={s.bg} clickable={currentStatus !== 'pending'} />
      </button>

      {currentStatus === 'pending' && (
        <button
          disabled={loadingStatus}
          onClick={toggleStatus}
          className="text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
          style={{ background: 'rgba(45,212,160,0.15)', color: 'var(--green)' }}
        >
          Активировать
        </button>
      )}
    </div>
  )
}

function Badge({
  label, color, bg, clickable,
}: {
  label: string; color: string; bg: string; clickable?: boolean
}) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-md shrink-0 select-none"
      style={{
        color,
        background: bg,
        cursor: clickable ? 'pointer' : 'default',
        outline: clickable ? `1px solid transparent` : 'none',
        transition: 'outline 0.15s',
      }}
      onMouseEnter={(e) => { if (clickable) (e.currentTarget as HTMLElement).style.outline = `1px solid ${color}` }}
      onMouseLeave={(e) => { if (clickable) (e.currentTarget as HTMLElement).style.outline = '1px solid transparent' }}
    >
      {label}
    </span>
  )
}
