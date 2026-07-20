import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getVisibleUsers, getUserSprintHistory } from '@/lib/queries/analytics'
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

  const users = await getVisibleUsers(session.user.id, profile?.role ?? 'employee').catch(() => [])

  if (!users.length) redirect('/dashboard')

  // Загружаем данные для всех видимых пользователей
  const sprintsByUser: Record<string, Awaited<ReturnType<typeof getUserSprintHistory>>> = {}
  await Promise.all(
    users.map(async user => {
      sprintsByUser[user.id] = await getUserSprintHistory(user.id).catch(() => [])
    })
  )

  // По умолчанию — текущий пользователь или первый в списке
  const defaultUserId = users.find(u => u.id === session.user.id)?.id ?? users[0].id

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
          users={users}
          initialUserId={defaultUserId}
          sprintsByUser={sprintsByUser}
        />
      </div>
    </div>
  )
}
