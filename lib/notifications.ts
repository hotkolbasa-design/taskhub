import { createAdminClient } from '@/lib/supabase/admin'

export type NotificationType =
  | 'task_assigned'
  | 'assignee_changed'
  | 'creator_changed'
  | 'status_changed'
  | 'comment_added'
  | 'deadline_soon'
  | 'deadline_overdue'

export interface NotificationPayload {
  user_id: string
  actor_id?: string | null
  task_id?: string | null
  type: NotificationType
  data?: Record<string, unknown>
}

export async function createNotifications(items: NotificationPayload[]) {
  if (items.length === 0) return
  const admin = createAdminClient()
  await admin.from('notifications').insert(
    items.map(n => ({
      user_id: n.user_id,
      actor_id: n.actor_id ?? null,
      task_id: n.task_id ?? null,
      type: n.type,
      data: n.data ?? null,
    }))
  )
}

// Собирает получателей (creator + assignee), исключая актора и дубли
export function buildRecipients(params: {
  actorId: string | null
  creatorId: string | null
  assigneeId: string | null
}): string[] {
  const { actorId, creatorId, assigneeId } = params
  const set = new Set<string>()
  if (creatorId) set.add(creatorId)
  if (assigneeId) set.add(assigneeId)
  if (actorId) set.delete(actorId)
  return Array.from(set)
}
