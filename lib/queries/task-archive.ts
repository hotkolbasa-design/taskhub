import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

const isDone = (s: string | null | undefined) => s === 'done' || s === 'cancelled'

/**
 * Что делать со строкой при смене workflow_status:
 *  - 'archive' — задача из бэклога стала done/cancelled → уводим в архив (status='done')
 *  - 'restore' — задача была в архиве, статус сняли → возвращаем в бэклог
 *  - null — ничего (в т.ч. для задач спринта — их архивирует closeSprint)
 */
export function archiveAction(
  currentStatus: string,
  currentWorkflow: string | null,
  newWorkflow: string,
): 'archive' | 'restore' | null {
  if (currentStatus === 'backlog' && isDone(newWorkflow) && !isDone(currentWorkflow)) return 'archive'
  if (currentStatus === 'done' && !isDone(newWorkflow)) return 'restore'
  return null
}

export async function nextBacklogOrder(admin: Admin, projectId: string): Promise<number> {
  const { data: last } = await admin
    .from('tasks')
    .select('backlog_order')
    .eq('project_id', projectId)
    .eq('status', 'backlog')
    .order('backlog_order', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  return ((last?.backlog_order as number) ?? 0) + 1
}

/**
 * Доп. патч к САМОЙ строке task при смене workflow_status.
 * Выполненных задач в бэклоге нет — они живут только в архиве (виден в «Мои задачи» → «Выполненные»).
 */
export async function backlogArchivePatch(
  admin: Admin,
  projectId: string,
  currentStatus: string,
  currentWorkflow: string | null,
  newWorkflow: string,
): Promise<Record<string, unknown>> {
  const action = archiveAction(currentStatus, currentWorkflow, newWorkflow)
  if (action === 'archive') return { status: 'done', backlog_order: null }
  if (action === 'restore') return { status: 'backlog', backlog_order: await nextBacklogOrder(admin, projectId) }
  return {}
}

/**
 * При архиве эпика его backlog-подзадачи не должны остаться «сиротами» под
 * исчезнувшим родителем (иначе getBacklogTasks выкинет их наверх как top-level).
 *  - выполненные (done/cancelled) → в архив вместе с эпиком;
 *  - невыполненные → ОСТАЮТСЯ в бэклоге, но отвязываются от эпика (parent_task_id=null),
 *    становясь самостоятельными задачами (авто «Убрать из эпика»).
 * restore не трогаем — отвязанные задачи уже живут своей жизнью.
 */
export async function syncEpicSubtasksArchive(
  admin: Admin,
  projectId: string,
  epicId: string,
  action: 'archive' | 'restore' | null,
): Promise<void> {
  if (action !== 'archive') return

  const { data: subs } = await admin
    .from('tasks')
    .select('id, workflow_status')
    .eq('parent_task_id', epicId)
    .eq('status', 'backlog')

  const list = subs ?? []
  const done = list.filter((s: any) => isDone(s.workflow_status)).map((s: any) => s.id)
  const open = list.filter((s: any) => !isDone(s.workflow_status)).map((s: any) => s.id)

  if (done.length > 0) {
    await admin.from('tasks').update({ status: 'done', backlog_order: null }).in('id', done)
  }

  if (open.length > 0) {
    let order = (await nextBacklogOrder(admin, projectId)) - 1
    for (const id of open) {
      order++
      await admin.from('tasks').update({ parent_task_id: null, backlog_order: order }).eq('id', id)
    }
  }
}
