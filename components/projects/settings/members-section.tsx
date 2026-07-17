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
  { value: 'manager', label: 'Руководитель', color: '#7C5CF6', bg: 'rgba(124,92,246,0.15)' },
  { value: 'member',  label: 'Участник',     color: '#8892A4', bg: 'rgba(136,146,164,0.15)' },
  { value: 'viewer',  label: 'Наблюдатель',  color: '#F7C04F', bg: 'rgba(247,192,79,0.15)'  },
]

// ─── Мультиселект пользователей ───────────────────────────────────────────────

function MultiUserDropdown({
  selected,
  onChange,
  options,
}: {
  selected: string[]
  onChange: (ids: string[]) => void
  options: Profile[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) { setSearch(''); return }
    inputRef.current?.focus()
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const filtered = options.filter(o => {
    const q = search.toLowerCase()
    return (
      (o.full_name?.toLowerCase().includes(q) ?? false) ||
      o.login.toLowerCase().includes(q)
    )
  })

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  const selectedProfiles = selected.map(id => options.find(o => o.id === id)).filter(Boolean) as Profile[]

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      {/* Триггер */}
      <div
        onClick={() => setOpen(o => !o)}
        className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer min-h-[38px]"
        style={{
          background: 'var(--surface2)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          transition: 'border-color 0.15s',
        }}
      >
        {selectedProfiles.map(p => (
          <span
            key={p.id}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium shrink-0"
            style={{ background: 'rgba(124,92,246,0.15)', color: 'var(--accent)' }}
          >
            {p.full_name || p.login}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(p.id) }}
              style={{ color: 'var(--accent)', cursor: 'pointer', lineHeight: 1 }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          </span>
        ))}
        {selectedProfiles.length === 0 && (
          <span className="text-sm flex-1" style={{ color: 'var(--text2)' }}>
            Выбрать пользователей...
          </span>
        )}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          className="ml-auto shrink-0"
          style={{ opacity: 0.5, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Дропдаун */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1 rounded-xl z-50 w-full overflow-hidden"
          style={{
            background: 'var(--surface2)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          {/* Поиск */}
          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="w-full bg-transparent outline-none text-sm"
              style={{ color: 'var(--text)' }}
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Список */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm" style={{ color: 'var(--text2)' }}>Не найдено</p>
            ) : filtered.map(opt => {
              const isSelected = selected.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Чекбокс */}
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--text2)'}`,
                      transition: 'all 0.12s',
                    }}
                  >
                    {isSelected && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  {/* Аватар */}
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                    style={{ background: isSelected ? 'var(--accent)' : 'var(--surface)', color: '#fff' }}
                  >
                    {(opt.full_name || opt.login)[0].toUpperCase()}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{opt.full_name || opt.login}</span>
                    {opt.full_name && <span className="text-xs truncate" style={{ color: 'var(--text2)' }}>{opt.login}</span>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Футер: Выбрать всех / Снять всё */}
          {options.length > 1 && (
            <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => onChange(filtered.map(o => o.id))}
                className="text-xs"
                style={{ color: 'var(--accent)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                Выбрать всех
              </button>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs"
                  style={{ color: 'var(--text2)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                >
                  Снять всё
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── RoleDropdown ─────────────────────────────────────────────────────────────

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
  const current = ROLE_OPTIONS.find(o => o.value === value) ?? ROLE_OPTIONS[1]

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
        style={{ background: current.bg, color: current.color, cursor: disabled ? 'default' : 'pointer' }}
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
          className="absolute right-0 top-full mt-1 py-1 rounded-xl z-50 min-w-[140px]"
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
              style={{ color: opt.value === value ? opt.color : 'var(--text)', cursor: 'pointer' }}
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

// ─── MembersSection ───────────────────────────────────────────────────────────

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
  const [addingIds, setAddingIds] = useState<string[]>([])
  const [addingRole, setAddingRole] = useState<'manager' | 'member' | 'viewer'>('member')
  const [loadingAdd, setLoadingAdd] = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [optimisticMembers, setOptimisticMembers] = useState<Member[]>(members)
  const [optimisticRoles, setOptimisticRoles] = useState<Record<string, string>>(
    () => Object.fromEntries(members.map(m => [m.user_id, m.role]))
  )

  useEffect(() => {
    setOptimisticMembers(members)
    setOptimisticRoles(Object.fromEntries(members.map(m => [m.user_id, m.role])))
  }, [members])

  const memberIds = new Set(optimisticMembers.map(m => m.user_id))
  const notMembers = availableProfiles.filter(p => !memberIds.has(p.id))

  async function handleAdd() {
    if (addingIds.length === 0) return

    // Оптимистично добавляем всех
    const newMembers: Member[] = addingIds.map(id => {
      const profile = availableProfiles.find(p => p.id === id)!
      return { user_id: id, role: addingRole, profile: { full_name: profile.full_name, login: profile.login, avatar_url: null } }
    })
    setOptimisticMembers(prev => [...prev, ...newMembers])
    setOptimisticRoles(r => {
      const n = { ...r }
      addingIds.forEach(id => { n[id] = addingRole })
      return n
    })
    const idsToAdd = [...addingIds]
    setAddingIds([])

    setLoadingAdd(true)
    try {
      await Promise.all(idsToAdd.map(id => addMember(projectId, id, addingRole)))
      router.refresh()
    } catch {
      setOptimisticMembers(prev => prev.filter(m => !idsToAdd.includes(m.user_id)))
      setOptimisticRoles(r => {
        const n = { ...r }
        idsToAdd.forEach(id => delete n[id])
        return n
      })
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
    setOptimisticMembers(prev => prev.filter(m => m.user_id !== userId))
    setLoadingIds(s => new Set(s).add(userId))
    try {
      await removeMember(projectId, userId)
      router.refresh()
    } catch {
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
                <span className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(124,92,246,0.15)', color: 'var(--accent)' }}>
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
                  style={{ color: 'var(--text2)', cursor: 'pointer' }}
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

      {/* Добавить участников */}
      <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Добавить участников</p>

        {notMembers.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text2)', opacity: 0.5 }}>
            Все пользователи системы уже добавлены в проект
          </p>
        ) : (
          <div className="flex gap-2 items-start">
            <MultiUserDropdown
              selected={addingIds}
              onChange={setAddingIds}
              options={notMembers}
            />
            <RoleDropdown value={addingRole} onChange={setAddingRole} />
            <button
              onClick={handleAdd}
              disabled={addingIds.length === 0 || loadingAdd}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40 shrink-0"
              style={{ background: 'var(--accent)', color: '#fff', cursor: addingIds.length === 0 ? 'default' : 'pointer' }}
            >
              {loadingAdd
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              }
              {addingIds.length > 1 ? `Добавить (${addingIds.length})` : 'Добавить'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
