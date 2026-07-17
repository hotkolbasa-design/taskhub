import { createAdminClient } from '@/lib/supabase/admin'
import type { Sprint, SprintColumn, SprintTask } from '@/types'

export type SprintData = {
  sprint: Sprint
  columns: SprintColumn[]
  tasks: SprintTask[]
}

export async function getSprintData(projectId: string): Promise<SprintData | null> {
  const admin = createAdminClient()

  const { data: sprint } = await admin
    .from('sprints')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sprint) return null

  const [{ data: columns }, { data: rawTasks }] = await Promise.all([
    admin
      .from('sprint_columns')
      .select('*')
      .eq('sprint_id', sprint.id)
      .order('order_index', { ascending: true }),
    admin
      .from('tasks')
      .select('*, assignee:profiles!tasks_assignee_id_fkey(full_name, login, avatar_url)')
      .eq('sprint_id', sprint.id)
      .eq('status', 'sprint')
      .order('column_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
  ])

  // Отдельный запрос для эпиков (избегаем inner join, который исключает задачи без эпика)
  const parentIds = [...new Set((rawTasks ?? []).map((t: any) => t.parent_task_id).filter(Boolean))]
  let epicMap: Record<string, { id: string; title: string }> = {}
  if (parentIds.length > 0) {
    const { data: epics } = await admin
      .from('tasks')
      .select('id, title')
      .in('id', parentIds)
      .eq('type', 'epic')
    for (const e of epics ?? []) epicMap[e.id] = e
  }

  return {
    sprint,
    columns: columns ?? [],
    tasks: (rawTasks ?? []).map((t: any) => ({
      ...t,
      assignee: t.assignee ?? null,
      parent_epic: t.parent_task_id ? (epicMap[t.parent_task_id] ?? null) : null,
    })),
  }
}
