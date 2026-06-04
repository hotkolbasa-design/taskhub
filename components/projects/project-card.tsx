'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteProject } from '@/app/(dashboard)/projects/actions'
import type { ProjectWithMeta } from '@/types'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Владелец',
  member: 'Участник',
  viewer: 'Наблюдатель',
}

export default function ProjectCard({ project }: { project: ProjectWithMeta }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    await deleteProject(project.id)
    router.refresh()
  }

  return (
    <div
      className="group rounded-xl p-5 flex flex-col gap-4 transition-colors"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${project.color}`,
      }}
    >
      {/* Заголовок */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="font-semibold text-base truncate" style={{ color: 'var(--text)' }}>
            {project.name}
          </h3>
          {project.description && (
            <p className="text-xs line-clamp-2" style={{ color: 'var(--text2)' }}>
              {project.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs px-2 py-0.5 rounded-md"
            style={{ background: 'var(--surface2)', color: 'var(--text2)' }}
          >
            {ROLE_LABEL[project.my_role] ?? project.my_role}
          </span>
          {/* Кнопка удаления */}
          {confirming ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                style={{ background: 'rgba(247,92,110,0.15)', color: 'var(--red)' }}
              >
                {deleting
                  ? <span className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: 'var(--red)', borderTopColor: 'transparent' }} />
                  : 'Удалить'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="px-2 py-0.5 rounded-md text-xs"
                style={{ color: 'var(--text2)' }}
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
              title="Удалить проект"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1.75 3.5h10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M4.667 3.5V2.333A.583.583 0 015.25 1.75h3.5a.583.583 0 01.583.583V3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <rect x="2.333" y="3.5" width="9.333" height="8.75" rx="1" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.25 6.417v3.5M8.75 6.417v3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Метаданные */}
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          {project.member_count} {plural(project.member_count, 'участник', 'участника', 'участников')}
        </span>
      </div>

      {/* Кнопки переходов */}
      <div className="flex gap-2 mt-auto">
        <Link
          href={`/projects/${project.id}/backlog`}
          className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{ background: 'var(--surface2)', color: 'var(--text)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
        >
          Бэклог
        </Link>
        <Link
          href={`/projects/${project.id}/sprint`}
          className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{ background: project.color + '22', color: project.color }}
          onMouseEnter={e => (e.currentTarget.style.background = project.color + '44')}
          onMouseLeave={e => (e.currentTarget.style.background = project.color + '22')}
        >
          Спринт
        </Link>
      </div>
    </div>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
