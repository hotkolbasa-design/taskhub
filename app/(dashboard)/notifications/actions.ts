'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type AppNotification = {
  id: string
  type: string
  is_read: boolean
  created_at: string
  task_id: string | null
  data: Record<string, unknown> | null
  actor: { full_name: string | null; login: string | null } | null
  task: { title: string; project_id: string; status: string } | null
}

export async function getNotifications(): Promise<AppNotification[]> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('notifications')
    .select(`
      id, type, is_read, created_at, task_id, data,
      actor:profiles!notifications_actor_id_fkey(full_name, login),
      task:tasks!notifications_task_id_fkey(title, project_id, status)
    `)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  return (data ?? []) as unknown as AppNotification[]
}

export async function markAsRead(notificationId: string) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const admin = createAdminClient()
  await admin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', session.user.id)
}

export async function markAllAsRead() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const admin = createAdminClient()
  await admin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', session.user.id)
    .eq('is_read', false)
}
