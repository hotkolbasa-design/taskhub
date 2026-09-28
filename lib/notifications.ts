import { createAdminClient } from '@/lib/supabase/admin'

export type NotificationType =
  | 'task_assigned'
  | 'assignee_changed'
  | 'creator_changed'
  | 'status_changed'
  | 'comment_added'
  | 'deadline_soon'
  | 'deadline_overdue'
  | 'expense_submitted'
  | 'expense_decided'
  | 'expense_comment'
  | 'expense_paid'

export interface NotificationPayload {
  user_id: string
  actor_id?: string | null
  task_id?: string | null
  expense_request_id?: string | null
  type: NotificationType
  data?: Record<string, unknown>
}

/**
 * Уведомления — дело побочное: если они не записались, действие пользователя
 * (создание задачи, смена статуса) всё равно должно завершиться. Но молчать нельзя:
 * из-за проглоченной ошибки функция не работала месяцами — в таблице не было
 * колонок actor_id и data, и каждая вставка отлетала с PGRST204 незаметно.
 */
export async function createNotifications(items: NotificationPayload[]) {
  if (items.length === 0) return
  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert(
    items.map(n => ({
      user_id: n.user_id,
      actor_id: n.actor_id ?? null,
      task_id: n.task_id ?? null,
      expense_request_id: n.expense_request_id ?? null,
      type: n.type,
      data: n.data ?? null,
    }))
  )
  if (error) {
    console.error('[notifications] не удалось создать уведомления:', error.message, {
      count: items.length,
      types: [...new Set(items.map(i => i.type))],
    })
  }
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
