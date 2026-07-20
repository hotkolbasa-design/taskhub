import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyTasks, getAllProfiles } from '@/lib/queries/my-tasks'
import MyTasksBoard from '@/components/my-tasks/my-tasks-board'

export default async function MyTasksPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, login, role')
    .eq('id', session.user.id)
    .maybeSingle()

  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin'

  const [tasks, allProfiles] = await Promise.all([
    getMyTasks(profile.id).catch(() => []),
    isAdmin ? getAllProfiles().catch(() => []) : Promise.resolve([]),
  ])

  return (
    <MyTasksBoard
      tasks={tasks}
      currentUserId={profile.id}
      isAdmin={isAdmin}
      allProfiles={isAdmin ? allProfiles : []}
    />
  )
}
