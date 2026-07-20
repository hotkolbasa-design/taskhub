import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BacklogBoard from '@/components/backlog/backlog-board'
import { getBacklogTasks, getProjectMembers, getActiveSprintForProject } from '@/lib/queries/tasks'
import { getSprintData } from '@/lib/queries/sprints'

export default async function BacklogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: project } = await admin
    .from('projects')
    .select('id, name, color, default_assignee_mode, default_assignee_id')
    .eq('id', id)
    .maybeSingle()

  if (!project) redirect('/projects')

  const [tasks, members, activeSprint, sprintData, myProfile] = await Promise.all([
    getBacklogTasks(id).catch(() => []),
    getProjectMembers(id).catch(() => []),
    getActiveSprintForProject(id).catch(() => null),
    getSprintData(id).catch(() => null),
    Promise.resolve(admin.from('profiles').select('role').eq('id', session.user.id).maybeSingle()).then(r => r.data).catch(() => null),
  ])

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text2)' }}>
        <Link href="/projects" className="hover:underline" style={{ color: 'var(--text2)' }}>
          Проекты
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--text)' }}>{project.name}</span>
        <span>/</span>
        <span style={{ color: 'var(--text)' }}>Бэклог</span>
      </div>

      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: project.color }} />
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Бэклог</h1>
        </div>

        {/* Навигация по страницам проекта */}
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${id}/sprint`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text2)', background: 'var(--surface)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="6.5" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="1" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Спринт
          </Link>
          <Link
            href={`/projects/${id}/sprints`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text2)', background: 'var(--surface)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v2M6 9v2M1 6h2M9 6h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            История
          </Link>
          <Link
            href={`/projects/${id}/settings`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text2)', background: 'var(--surface)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 1.5v.5M6 10v.5M1.5 6h.5M10 6h.5M2.9 2.9l.35.35M8.75 8.75l.35.35M8.75 2.9l-.35.35M3.25 8.75l-.35.35" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Настройки
          </Link>
        </div>
      </div>


<BacklogBoard
        projectId={id}
        initialTasks={tasks}
        members={members}
        membersMap={Object.fromEntries(members.map((m: any) => [m.id, m.full_name || m.login]))}
        hasActiveSprint={!!activeSprint}
        currentUserId={session.user.id}
        defaultAssigneeMode={project.default_assignee_mode ?? 'manual'}
        defaultAssigneeId={project.default_assignee_id ?? null}
        sprintPanelData={sprintData}
        isAdmin={myProfile?.role === 'admin'}
      />
    </div>
  )
}
