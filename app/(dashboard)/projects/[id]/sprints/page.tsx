import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProjectSprintHistory } from '@/lib/queries/analytics'
import SprintHistoryView from '@/components/sprints/sprint-history-view'

export default async function ProjectSprintsPage({ params }: { params: Promise<{ id: string }> }) {
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

  const [sprints, myProfile] = await Promise.all([
    getProjectSprintHistory(id),
    admin.from('profiles').select('role').eq('id', session.user.id).maybeSingle().then(r => r.data),
  ])

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      {/* Хлебные крошки */}
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text2)' }}>
        <Link href="/projects" style={{ color: 'var(--text2)' }} className="hover:underline">Проекты</Link>
        <span>/</span>
        <span style={{ color: 'var(--text)' }}>{project.name}</span>
        <span>/</span>
        <span style={{ color: 'var(--text)' }}>История спринтов</span>
      </div>

      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: project.color }} />
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>История спринтов</h1>
          <span className="text-sm font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
            {sprints.length}
          </span>
        </div>

        {/* Навигация по страницам проекта */}
        <div className="flex items-center gap-2">
          <Link href={`/projects/${id}/backlog`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ color: 'var(--text2)', background: 'var(--surface)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 3.5h9M1.5 6h9M1.5 8.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Бэклог
          </Link>
          <Link href={`/projects/${id}/sprint`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ color: 'var(--text2)', background: 'var(--surface)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="6.5" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="1" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            Спринт
          </Link>
          <Link href={`/projects/${id}/sprints`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ color: 'var(--accent)', background: 'rgba(124,92,246,0.1)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v2M6 9v2M1 6h2M9 6h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            История
          </Link>
          <Link href={`/projects/${id}/settings`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{ color: 'var(--text2)', background: 'var(--surface)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 1.5v.5M6 10v.5M1.5 6h.5M10 6h.5M2.9 2.9l.35.35M8.75 8.75l.35.35M8.75 2.9l-.35.35M3.25 8.75l-.35.35" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Настройки
          </Link>
        </div>
      </div>

      <SprintHistoryView sprints={sprints} isAdmin={myProfile?.role === 'admin'} />
    </div>
  )
}
