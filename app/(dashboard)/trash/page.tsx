import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTrashTasks } from '@/lib/queries/trash'
import TrashClient from '@/components/trash/trash-client'

export default async function TrashPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const tasks = await getTrashTasks(session.user.id)

  return <TrashClient initialTasks={tasks} />
}
