import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

const isDone = (s: string | null | undefined) => s === 'done' || s === 'cancelled'

/**
 * Выполненные/отменённые задачи не живут в бэклоге — они уходят в архив (status='done')
 * и видны только в разделе «Мои задачи» → колонка «Выполненные».
 * Возвращает доп. патч к строке tasks при смене workflow_status:
 *  - из бэклога + стала done/cancelled → уводим в архив
 *  - была в архиве + статус сняли → возвращаем в бэклог (в конец списка)
 * Задачи спринта не трогаем — их архивирует closeSprint.
 */
export async function backlogArchivePatch(
  admin: Admin,
  projectId: string,
  currentStatus: string,
  currentWorkflow: string | null,
  newWorkflow: string,
): Promise<Record<string, unknown>> {
  if (currentStatus === 'backlog' && isDone(newWorkflow) && !isDone(currentWorkflow)) {
    return { status: 'done', backlog_order: null }
  }

  if (currentStatus === 'done' && !isDone(newWorkflow)) {
    const { data: last } = await admin
      .from('tasks')
      .select('backlog_order')
      .eq('project_id', projectId)
      .eq('status', 'backlog')
      .order('backlog_order', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    return { status: 'backlog', backlog_order: ((last?.backlog_order as number) ?? 0) + 1 }
  }

  return {}
}
