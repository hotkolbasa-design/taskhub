'use client'

import { useState, useRef, useEffect } from 'react'
import { setRole, setStatus } from '@/app/(dashboard)/admin/actions'

type Option = { value: string; label: string; color: string; bg: string }

const ROLES: Option[] = [
  { value: 'employee', label: 'Employee', color: '#8892A4', bg: 'rgba(136,146,164,0.15)' },
  { value: 'admin',    label: 'Admin',    color: '#4F8EF7', bg: 'rgba(79,142,247,0.15)'  },
]

const STATUSES: Option[] = [
  { value: 'active',   label: 'Активен',   color: '#2DD4A0', bg: 'rgba(45,212,160,0.15)'  },
  { value: 'inactive', label: 'Неактивен', color: '#F75C6E', bg: 'rgba(247,92,110,0.15)'  },
  { value: 'pending',  label: 'Ожидает',   color: '#F7C04F', bg: 'rgba(247,192,79,0.15)'  },
]

type Props = {
  userId: string
  status: string
  role: string
  isSelf: boolean
  isSuperAdmin: boolean
}

export default function AdminUserActions({ userId, status, role, isSelf, isSuperAdmin }: Props) {
  const [currentRole, setCurrentRole] = useState(role)
  const [currentStatus, setCurrentStatus] = useState(status)
  const [savingRole, setSavingRole] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  const canEdit = !isSelf && (isSuperAdmin || currentRole !== 'admin')

  const roleInfo   = ROLES.find(r => r.value === currentRole)   ?? ROLES[0]
  const statusInfo = STATUSES.find(s => s.value === currentStatus) ?? STATUSES[0]

  async function handleRoleChange(next: string) {
    if (next === currentRole) return
    setCurrentRole(next)   // мгновенно
    setSavingRole(true)
    await setRole(userId, next as 'admin' | 'employee')
    setSavingRole(false)
  }

  async function handleStatusChange(next: string) {
    if (next === currentStatus) return
    setCurrentStatus(next) // мгновенно
    setSavingStatus(true)
    await setStatus(userId, next as 'active' | 'inactive')
    setSavingStatus(false)
  }

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2">
        <div style={{ width: 100 }}>
          <StaticBadge info={roleInfo} />
        </div>
        <div style={{ width: 108 }}>
          <StaticBadge info={statusInfo} />
        </div>
        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          {isSelf ? 'вы' : 'admin'}
        </span>
      </div>
    )
  }

  const selectableStatuses = currentStatus === 'pending' ? STATUSES : STATUSES.filter(s => s.value !== 'pending')

  return (
    <div className="flex items-center gap-2">
      <div style={{ width: 100 }}>
        <Dropdown
          options={ROLES}
          value={currentRole}
          saving={savingRole}
          onChange={handleRoleChange}
        />
      </div>
      <div style={{ width: 108 }}>
        <Dropdown
          options={selectableStatuses}
          value={currentStatus}
          saving={savingStatus}
          onChange={handleStatusChange}
        />
      </div>
    </div>
  )
}

function StaticBadge({ info }: { info: Option }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md select-none"
      style={{ color: info.color, background: info.bg }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: info.color }}
      />
      {info.label}
    </span>
  )
}

function Dropdown({ options, value, saving, onChange }: {
  options: Option[]
  value: string
  saving: boolean
  onChange: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  return (
    <div ref={ref} className="relative">
      {/* Кнопка */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
        style={{
          color: current.color,
          background: current.bg,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)' }}
      >
        {/* Индикатор сохранения */}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: current.color,
            opacity: saving ? 0.4 : 1,
            transition: 'opacity 0.3s',
            boxShadow: saving ? `0 0 0 2px ${current.color}40` : 'none',
            animation: saving ? 'pulse 1s ease-in-out infinite' : 'none',
          }}
        />
        {current.label}
      </button>

      {/* Список */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 py-1 rounded-xl z-50 min-w-[120px]"
          style={{
            background: 'var(--surface2)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
              style={{
                color: opt.value === value ? opt.color : 'var(--text)',
                background: opt.value === value ? opt.bg : 'transparent',
              }}
              onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (opt.value !== value) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: opt.color }}
              />
              {opt.label}
              {opt.value === value && (
                <svg className="ml-auto" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke={opt.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
