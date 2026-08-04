'use client'

import { useState } from 'react'
import Link from 'next/link'
import BacklogBoard from './backlog-board'
import UserFilter from '@/components/common/user-filter'
import type { BacklogTask, Sprint, SprintTask } from '@/types'

type Member = { id: string; full_name: string | null; login: string; avatar_url: string | null }
type SprintPanelData = { sprint: Sprint; tasks: SprintTask[] }

type Props = {
  project: { id: string; name: string; color: string }
  initialTasks: BacklogTask[]
  members: Member[]
  membersMap: Record<string, string>
  hasActiveSprint: boolean
  currentUserId: string
  defaultAssigneeMode: 'manual' | 'creator' | 'specific'
  defaultAssigneeId: string | null
  sprintPanelData: SprintPanelData | null
  isAdmin: boolean
}

const navLink = {
  className: 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
  style: { color: 'var(--text2)', background: 'var(--surface)' } as const,
}

export default function BacklogView({ project, members, ...board }: Props) {
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([])

  return (
    <>
      {/* Заголовок + навигация */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: project.color }} />
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Бэклог</h1>
        </div>

        <div className="flex items-center gap-2">
          <UserFilter users={members} selected={assigneeFilter} onChange={setAssigneeFilter} />
          <Link href={`/projects/${project.id}/sprint`} className={navLink.className} style={navLink.style}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="6.5" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="1" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Спринт
          </Link>
          <Link href={`/projects/${project.id}/sprints`} className={navLink.className} style={navLink.style}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v2M6 9v2M1 6h2M9 6h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            История
          </Link>
          <Link href={`/projects/${project.id}/settings`} className={navLink.className} style={navLink.style}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 1.5v.5M6 10v.5M1.5 6h.5M10 6h.5M2.9 2.9l.35.35M8.75 8.75l.35.35M8.75 2.9l-.35.35M3.25 8.75l-.35.35" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Настройки
          </Link>
        </div>
      </div>

      <BacklogBoard
        projectId={project.id}
        members={members}
        assigneeFilter={assigneeFilter}
        {...board}
      />
    </>
  )
}
