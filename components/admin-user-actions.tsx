'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  isProtected: boolean
}

export default function AdminUserActions({ userId, status, role, isSelf, isProtected }: Props) {
  const [currentRole, setCurrentRole] = useState(role)
  const [currentStatus, setCurrentStatus] = useState(status)
  const [savingRole, setSavingRole] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)

  const canEdit = !isSelf && !isProtected

  const roleInfo   = ROLES.find(r => r.value === currentRole)   ?? ROLES[0]
  const statusInfo = STATUSES.find(s => s.value === currentStatus) ?? STATUSES[0]

  async function handleRoleChange(next: string) {
    if (next === currentRole) return
    setCurrentRole(next)
    setSavingRole(true)
    await setRole(userId, next as 'admin' | 'employee')
    setSavingRole(false)
  }

  async function handleStatusChange(next: string) {
    if (next === currentStatus) return
    setCurrentStatus(next)
    setSavingStatus(true)
    await setStatus(userId, next as 'active' | 'inactive')
    setSavingStatus(false)
  }

  const selectableStatuses = currentStatus === 'pending' ? STATUSES : STATUSES.filter(s => s.value !== 'pending')

  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 100 }}>
        {canEdit
          ? <Dropdown options={ROLES} value={currentRole} saving={savingRole} onChange={handleRoleChange} />
          : <StaticBadge info={roleInfo} />}
      </div>
      <div style={{ width: 108 }}>
        {canEdit
          ? <Dropdown options={selectableStatuses} value={currentStatus} saving={savingStatus} onChange={handleStatusChange} />
          : <StaticBadge info={statusInfo} />}
      </div>
      <span className="text-xs" style={{ width: 28, color: 'var(--text2)' }}>
        {isSelf ? 'вы' : ''}
      </span>
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
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value) ?? options[0]

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
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen(o => !o)
  }

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
        style={{ color: current.color, background: current.bg, cursor: 'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)' }}
      >
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

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="py-1 rounded-xl min-w-[120px]"
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
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
                cursor: 'pointer',
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
        </div>,
        document.body
      )}
    </div>
  )
}
