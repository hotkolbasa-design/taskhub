'use client'

import { useState } from 'react'
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

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  member: 'Участник',
  viewer: 'Наблюдатель',
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
  const [addingRole, setAddingRole] = useState<'member' | 'viewer'>('member')
  const [loadingAdd, setLoadingAdd] = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())

  const memberIds = new Set(members.map(m => m.user_id))
  const notMembers = availableProfiles.filter(p => !memberIds.has(p.id))

  async function handleAdd() {
    if (!addingId) return
    setLoadingAdd(true)
    try {
      await addMember(projectId, addingId, addingRole)
      setAddingId('')
      router.refresh()
    } finally {
      setLoadingAdd(false)
    }
  }

  async function handleRoleChange(userId: string, role: 'member' | 'viewer') {
    setLoadingIds(s => new Set(s).add(userId))
    try {
      await updateMemberRole(projectId, userId, role)
      router.refresh()
    } finally {
      setLoadingIds(s => { const n = new Set(s); n.delete(userId); return n })
    }
  }

  async function handleRemove(userId: string) {
    setLoadingIds(s => new Set(s).add(userId))
    try {
      await removeMember(projectId, userId)
      router.refresh()
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
        Участники — {members.length}
      </h2>

      {/* Список участников */}
      <div className="flex flex-col gap-1">
        {members.map(m => {
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
              {/* Аватар */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {name[0].toUpperCase()}
              </div>

              {/* Имя */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {name} {isSelf && <span style={{ color: 'var(--text2)', fontWeight: 400 }}>(вы)</span>}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>
                  {m.profile?.login}
                </p>
              </div>

              {/* Роль */}
              {isOwner ? (
                <span className="text-xs px-2.5 py-1 rounded-md" style={{ background: 'rgba(79,142,247,0.15)', color: 'var(--accent)' }}>
                  Владелец
                </span>
              ) : (
                <select
                  value={m.role}
                  disabled={loading}
                  onChange={e => handleRoleChange(m.user_id, e.target.value as 'member' | 'viewer')}
                  className="text-xs px-2 py-1 rounded-md outline-none cursor-pointer"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <option value="member">Участник</option>
                  <option value="viewer">Наблюдатель</option>
                </select>
              )}

              {/* Удалить */}
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
      {notMembers.length > 0 && (
        <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Добавить участника</p>
          <div className="flex gap-2">
            <select
              value={addingId}
              onChange={e => setAddingId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: addingId ? 'var(--text)' : 'var(--text2)' }}
            >
              <option value="">Выбрать пользователя...</option>
              {notMembers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.login}
                </option>
              ))}
            </select>

            <select
              value={addingRole}
              onChange={e => setAddingRole(e.target.value as 'member' | 'viewer')}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <option value="member">Участник</option>
              <option value="viewer">Наблюдатель</option>
            </select>

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
        </div>
      )}
    </div>
  )
}
