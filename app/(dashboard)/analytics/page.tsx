import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getAnalyticsProjects, getProjectAnalytics, type ProjectAnalytics } from '@/lib/queries/analytics'
import AnalyticsView from '@/components/analytics/analytics-view'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'

  // Доступные проекты: админ («я») — все; остальные — только свои.
  const projectList = await getAnalyticsProjects(session.user.id, isAdmin).catch(() => [])
  if (!projectList.length) redirect('/dashboard')

  const loaded = await Promise.all(
    projectList.map(p => getProjectAnalytics(p.id).catch(() => null))
  )
  const projects = loaded.filter((p): p is ProjectAnalytics => !!p && p.users.length > 0)

  if (!projects.length) redirect('/dashboard')

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {/* Заголовок */}
      <div className="flex items-center gap-3 shrink-0">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--accent)' }}>
          <path d="M3 14l4-4 3 3 4-5 3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="1.5" y="1.5" width="17" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Аналитика эффективности</h1>
      </div>

      <div className="flex-1 overflow-hidden">
        <AnalyticsView
          projects={projects}
          isAdmin={isAdmin}
          currentUserId={session.user.id}
        />
      </div>
    </div>
  )
}
