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
  const [loading, setLoading] = useState(false)

  async function handle(action: () => Promise<void>) {
    setLoading(true)
    try { await action() } finally { setLoading(false) }
  }

  if (isSelf) return <span className="text-xs" style={{ color: 'var(--text2)' }}>вы</span>

  return (
    <div className="flex items-center gap-2">
      {status === 'pending' && (
        <button
          disabled={loading}
          onClick={() => handle(() => approveUser(userId))}
          className="text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
          style={{ background: 'rgba(45,212,160,0.15)', color: 'var(--green)' }}
        >
          Подтвердить
        </button>
      )}
      {status === 'active' && (
        <button
          disabled={loading}
          onClick={() => handle(() => deactivateUser(userId))}
          className="text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
          style={{ background: 'rgba(247,92,110,0.12)', color: 'var(--red)' }}
        >
          Деактивировать
        </button>
      )}
      {status === 'inactive' && (
        <button
          disabled={loading}
          onClick={() => handle(() => approveUser(userId))}
          className="text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
          style={{ background: 'rgba(45,212,160,0.15)', color: 'var(--green)' }}
        >
          Активировать
        </button>
      )}
      {role === 'employee' && (
        <button
          disabled={loading}
          onClick={() => handle(() => setRole(userId, 'admin'))}
          className="text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
          style={{ background: 'rgba(79,142,247,0.12)', color: 'var(--accent)' }}
        >
          → Admin
        </button>
      )}
      {role === 'admin' && (
        <button
          disabled={loading}
          onClick={() => handle(() => setRole(userId, 'employee'))}
          className="text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
          style={{ background: 'rgba(136,146,164,0.12)', color: 'var(--text2)' }}
        >
          → Employee
        </button>
      )}
    </div>
  )
}
