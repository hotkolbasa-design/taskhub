import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSprintData } from '@/lib/queries/sprints'
import { getProjectMembers } from '@/lib/queries/tasks'
import SprintBoard from '@/components/sprint/sprint-board'
import CreateSprintView from '@/components/sprint/create-sprint-view'

export default async function SprintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: project } = await admin
    .from('projects')
    .select('id, name, color')
    .eq('id', id)
    .maybeSingle()

  if (!project) redirect('/projects')

  const [sprintData, members, myMembership, myProfile] = await Promise.all([
    getSprintData(id),
    getProjectMembers(id),
    admin
      .from('project_members')
      .select('role')
      .eq('project_id', id)
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(r => r.data),
    admin
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(r => r.data),
  ])

  const canManage =
    myMembership?.role === 'owner' ||
    myMembership?.role === 'manager' ||
    myProfile?.role === 'admin'

  return (
    <div className="flex flex-col h-full">
      {/* Шапка страницы */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text2)' }}>
          <Link href="/projects" className="hover:underline" style={{ color: 'var(--text2)' }}>
            Проекты
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text)' }}>{project.name}</span>
          <span>/</span>
          <span style={{ color: 'var(--text)' }}>Спринт</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${id}/backlog`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3 4h6M3 6.5h4M3 9h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Бэклог
          </Link>
          <Link
            href={`/projects/${id}/sprints`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v2M6 9v2M1 6h2M9 6h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            История
          </Link>
          <Link
            href={`/projects/${id}/settings`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 1.5v.5M6 10v.5M1.5 6h.5M10 6h.5M2.9 2.9l.35.35M8.75 8.75l.35.35M8.75 2.9l-.35.35M3.25 8.75l-.35.35" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Настройки
          </Link>
        </div>
      </div>

      {sprintData ? (
        <SprintBoard
          projectId={id}
          sprint={sprintData.sprint}
          columns={sprintData.columns}
          initialTasks={sprintData.tasks}
          canManage={canManage}
          members={members}
        />
      ) : (
        <CreateSprintView projectId={id} canManage={canManage} />
      )}
    </div>
  )
}
