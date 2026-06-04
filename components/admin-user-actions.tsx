'use client'

import { useState } from 'react'
import { setRole, setStatus } from '@/app/(dashboard)/admin/actions'

type Props = {
  userId: string
  status: string
  role: string
  isSelf: boolean
  isSuperAdmin: boolean
}

const ROLES = [
  { value: 'employee', label: 'Employee', color: 'var(--text2)',  bg: 'rgba(136,146,164,0.15)' },
  { value: 'admin',    label: 'Admin',    color: 'var(--accent)', bg: 'rgba(79,142,247,0.15)'  },
]

const STATUSES = [
  { value: 'active',   label: 'Активен',   color: 'var(--green)',  bg: 'rgba(45,212,160,0.15)'  },
  { value: 'inactive', label: 'Неактивен', color: 'var(--red)',    bg: 'rgba(247,92,110,0.15)'  },
  { value: 'pending',  label: 'Ожидает',   color: 'var(--yellow)', bg: 'rgba(247,192,79,0.15)'  },
]

export default function AdminUserActions({ userId, status, role, isSelf, isSuperAdmin }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const [currentRole, setCurrentRole] = useState(role)
  const [loadingRole, setLoadingRole] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)

  // Суперадмин редактирует всех кроме себя. Обычный admin — только employee.
  const canEdit = !isSelf && (isSuperAdmin || currentRole !== 'admin')

  const roleInfo   = ROLES.find(r => r.value === currentRole)   ?? ROLES[0]
  const statusInfo = STATUSES.find(s => s.value === currentStatus) ?? STATUSES[0]

  async function handleRoleChange(next: string) {
    if (next === currentRole || loadingRole) return
    setLoadingRole(true)
    setCurrentRole(next)
    await setRole(userId, next as 'admin' | 'employee')
    setLoadingRole(false)
  }

  async function handleStatusChange(next: string) {
    if (next === currentStatus || loadingStatus) return
    setLoadingStatus(true)
    setCurrentStatus(next)
    await setStatus(userId, next as 'active' | 'inactive')
    setLoadingStatus(false)
  }

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2">
        <StaticBadge info={roleInfo} />
        <StaticBadge info={statusInfo} />
        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          {isSelf ? 'вы' : 'admin'}
        </span>
      </div>
    )
  }

  const selectableStatuses = currentStatus === 'pending'
    ? STATUSES
    : STATUSES.filter(s => s.value !== 'pending')

  return (
    <div className="flex items-center gap-2">
      <DropdownSelect
        options={ROLES}
        value={currentRole}
        loading={loadingRole}
        onChange={handleRoleChange}
      />
      <DropdownSelect
        options={selectableStatuses}
        value={currentStatus}
        loading={loadingStatus}
        onChange={handleStatusChange}
      />
    </div>
  )
}

function StaticBadge({ info }: { info: { label: string; color: string; bg: string } }) {
  return (
    <span
      className="text-xs px-2.5 py-1 rounded-md shrink-0 select-none"
      style={{ color: info.color, background: info.bg }}
    >
      {info.label}
    </span>
  )
}

function DropdownSelect({
  options,
  value,
  loading,
  onChange,
}: {
  options: { value: string; label: string; color: string; bg: string }[]
  value: string
  loading: boolean
  onChange: (val: string) => void
}) {
  const current = options.find(o => o.value === value) ?? options[0]

  return (
    <div
      className="relative inline-flex items-center rounded-md"
      style={{
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.15s',
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Цветная точка — индикатор текущего значения */}
      <span
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
        style={{ background: current.color }}
      />
      <select
        value={value}
        disabled={loading}
        onChange={e => onChange(e.target.value)}
        className="text-xs rounded-md cursor-pointer pl-6 pr-6 py-1"
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          color: 'var(--text)',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          minWidth: 90,
        }}
      >
        {options.map(o => (
          <option
            key={o.value}
            value={o.value}
            style={{ background: 'var(--surface2)', color: 'var(--text)' }}
          >
            {o.label}
          </option>
        ))}
      </select>
      {/* Стрелка вниз */}
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
        width="10" height="10" viewBox="0 0 10 10" fill="none"
      >
        <path d="M2 3.5L5 6.5L8 3.5" stroke="var(--text2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}
