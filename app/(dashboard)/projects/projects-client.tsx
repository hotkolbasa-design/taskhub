'use client'

import { useState } from 'react'
import ProjectCard from '@/components/projects/project-card'
import CreateProjectModal from '@/components/projects/create-project-modal'
import type { ProjectWithMeta } from '@/types'

export default function ProjectsClient({ projects }: { projects: ProjectWithMeta[] }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="p-8 max-w-6xl">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
            Проекты
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
            Все проекты — {projects.length}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Новый проект
        </button>
      </div>

      {/* Список */}
      {projects.length === 0 ? (
        <div
          className="rounded-xl p-16 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--text2)', opacity: 0.4 }}>
            <rect x="4" y="8" width="32" height="26" rx="3" stroke="currentColor" strokeWidth="2"/>
            <path d="M4 14h32" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 20h6M12 26h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>
            Проектов пока нет
          </p>
          <p className="text-xs" style={{ color: 'var(--text2)', opacity: 0.6 }}>
            Создай первый проект чтобы начать работу
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Создать проект
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {showModal && <CreateProjectModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
