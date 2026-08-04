import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BacklogView from '@/components/backlog/backlog-view'
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

      <BacklogView
        project={{ id, name: project.name, color: project.color }}
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
