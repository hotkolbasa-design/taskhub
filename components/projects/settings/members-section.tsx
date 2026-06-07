'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addMember, updateMemberRole, removeMember } from '@/app/(dashboard)/projects/[id]/settings/actions'

type Member = {
  user_id: string
  role: string
  profile: { full_name: string | null; login: string; avatar_url: string | null } | null
}

type Profile = {
  id: string
  full_name: string | null
  login: string
}

const ROLE_OPTIONS = [
  { value: 'manager', label: 'Руководитель', color: '#4F8EF7', bg: 'rgba(79,142,247,0.15)' },
  { value: 'member', label: 'Участник', color: '#8892A4', bg: 'rgba(136,146,164,0.15)' },
  { value: 'viewer', label: 'Наблюдатель', color: '#F7C04F', bg: 'rgba(247,192,79,0.15)' },
]

function UserDropdown({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Profile[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.id === value)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  return (
    <div ref={ref} className="relative flex-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left"
        style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          color: selected ? 'var(--text)' : 'var(--text2)',
        }}
      >
        {selected ? (
          <>
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {(selected.full_name || selected.login)[0].toUpperCase()}
            </span>
            <span className="flex-1 truncate">{selected.full_name || selected.login}</span>
          </>
        ) : (
          <span className="flex-1">Выбрать пользователя...</span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 py-1 rounded-xl z-50 w-full"
          style={{
            background: 'var(--surface2)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          {options.map(opt => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ color: opt.id === value ? 'var(--accent)' : 'var(--text)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{ background: opt.id === value ? 'var(--accent)' : 'var(--surface)', color: '#fff' }}
              >
                {(opt.full_name || opt.login)[0].toUpperCase()}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="truncate font-medium">{opt.full_name || opt.login}</span>
                {opt.full_name && <span className="text-xs truncate" style={{ color: 'var(--text2)' }}>{opt.login}</span>}
              </div>
              {opt.id === value && (
                <svg className="ml-auto shrink-0" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RoleDropdown({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: 'manager' | 'member' | 'viewer') => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = ROLE_OPTIONS.find(o => o.value === value) ?? ROLE_OPTIONS[0]

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
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
        style={{ background: current.bg, color: current.color }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.2)' }}
        onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: current.color }} />
        {current.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.6 }}>
          <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 py-1 rounded-xl z-50 min-w-[140px]"
          style={{
            background: 'var(--surface2)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value as 'manager' | 'member' | 'viewer'); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left"
              style={{ color: opt.value === value ? opt.color : 'var(--text)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />
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

export default function MembersSection({
  projectId,
  members,
  availableProfiles,
  currentUserId,
}: {
  projectId: string
  members: Member[]
  availableProfiles: Profile[]
  currentUserId: string
}) {
  const router = useRouter()
  const [addingId, setAddingId] = useState('')
  const [addingRole, setAddingRole] = useState<'manager' | 'member' | 'viewer'>('member')
  const [loadingAdd, setLoadingAdd] = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [optimisticMembers, setOptimisticMembers] = useState<Member[]>(members)
  const [optimisticRoles, setOptimisticRoles] = useState<Record<string, string>>(
    () => Object.fromEntries(members.map(m => [m.user_id, m.role]))
  )

  // Синхронизируем с сервером после router.refresh()
  useEffect(() => {
    setOptimisticMembers(members)
    setOptimisticRoles(Object.fromEntries(members.map(m => [m.user_id, m.role])))
  }, [members])

  const memberIds = new Set(optimisticMembers.map(m => m.user_id))
  const notMembers = availableProfiles.filter(p => !memberIds.has(p.id))

  async function handleAdd() {
    if (!addingId) return
    const profile = availableProfiles.find(p => p.id === addingId)
    if (!profile) return

    // Мгновенно добавляем в UI
    const newMember: Member = {
      user_id: addingId,
      role: addingRole,
      profile: { full_name: profile.full_name, login: profile.login, avatar_url: null },
    }
    setOptimisticMembers(prev => [...prev, newMember])
    setOptimisticRoles(r => ({ ...r, [addingId]: addingRole }))
    setAddingId('')

    // Сервер фоном
    setLoadingAdd(true)
    try {
      await addMember(projectId, addingId, addingRole)
      router.refresh()
    } catch {
      // Rollback при ошибке
      setOptimisticMembers(prev => prev.filter(m => m.user_id !== addingId))
      setOptimisticRoles(r => { const n = { ...r }; delete n[addingId]; return n })
    } finally {
      setLoadingAdd(false)
    }
  }

  async function handleRoleChange(userId: string, role: 'manager' | 'member' | 'viewer') {
    setOptimisticRoles(r => ({ ...r, [userId]: role }))
    await updateMemberRole(projectId, userId, role)
    router.refresh()
  }

  async function handleRemove(userId: string) {
    // Мгновенно убираем из UI
    setOptimisticMembers(prev => prev.filter(m => m.user_id !== userId))
    setLoadingIds(s => new Set(s).add(userId))
    try {
      await removeMember(projectId, userId)
      router.refresh()
    } catch {
      // Rollback при ошибке
      setOptimisticMembers(members)
    } finally {
      setLoadingIds(s => { const n = new Set(s); n.delete(userId); return n })
    }
  }

  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
        Участники — {optimisticMembers.length}
      </h2>

      {/* Список участников */}
      <div className="flex flex-col gap-1.5">
        {optimisticMembers.map(m => {
          const name = m.profile?.full_name || m.profile?.login || 'Неизвестный'
          const isOwner = m.role === 'owner'
          const isSelf = m.user_id === currentUserId
          const loading = loadingIds.has(m.user_id)

          return (
            <div
              key={m.user_id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--surface2)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {name[0].toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {name}{' '}
                  {isSelf && <span style={{ color: 'var(--text2)', fontWeight: 400 }}>(вы)</span>}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>
                  {m.profile?.login}
                </p>
              </div>

              {isOwner ? (
                <span className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(79,142,247,0.15)', color: 'var(--accent)' }}>
                  Владелец
                </span>
              ) : (
                <RoleDropdown
                  value={optimisticRoles[m.user_id] ?? m.role}
                  onChange={role => handleRoleChange(m.user_id, role)}
                  disabled={loading}
                />
              )}

              {!isOwner && (
                <button
                  onClick={() => handleRemove(m.user_id)}
                  disabled={loading}
                  className="p-1.5 rounded-md transition-colors disabled:opacity-40"
                  style={{ color: 'var(--text2)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                  title="Удалить участника"
                >
                  {loading
                    ? <span className="w-3.5 h-3.5 rounded-full border border-t-transparent animate-spin block" style={{ borderColor: 'var(--text2)', borderTopColor: 'transparent' }} />
                    : <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1.75 3.5h10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        <path d="M4.667 3.5V2.333A.583.583 0 015.25 1.75h3.5a.583.583 0 01.583.583V3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        <rect x="2.333" y="3.5" width="9.333" height="8.75" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M5.25 6.417v3.5M8.75 6.417v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                  }
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Добавить участника */}
      <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Добавить участника</p>

        {notMembers.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text2)', opacity: 0.5 }}>
            Все пользователи системы уже добавлены в проект
          </p>
        ) : (
          <div className="flex gap-2">
            <UserDropdown
              value={addingId}
              onChange={setAddingId}
              options={notMembers}
            />

            <RoleDropdown
              value={addingRole}
              onChange={setAddingRole}
            />

            <button
              onClick={handleAdd}
              disabled={!addingId || loadingAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loadingAdd
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              }
              Добавить
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
