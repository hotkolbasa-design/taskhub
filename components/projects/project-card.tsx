'use client'

import Link from 'next/link'
import type { ProjectWithMeta } from '@/types'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Владелец',
  member: 'Участник',
  viewer: 'Наблюдатель',
}

export default function ProjectCard({ project }: { project: ProjectWithMeta }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 transition-colors"
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
        <span
          className="text-xs px-2 py-0.5 rounded-md shrink-0"
          style={{ background: 'var(--surface2)', color: 'var(--text2)' }}
        >
          {ROLE_LABEL[project.my_role] ?? project.my_role}
        </span>
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
