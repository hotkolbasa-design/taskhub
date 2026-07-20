import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BacklogTask } from '@/types'

export function getBacklogTasks(projectId: string): Promise<BacklogTask[]> {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()

      const { data: rows, error } = await admin
        .from('tasks')
        .select(`
          *,
          assignee:profiles!tasks_assignee_id_fkey(full_name, login, avatar_url)
        `)
        .eq('project_id', projectId)
        .eq('status', 'backlog')
        .order('backlog_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

      if (error || !rows) return []

      const epicIds = rows.filter((r: any) => r.type === 'epic').map((r: any) => r.id)
      const progressMap: Record<string, { total: number; done: number }> = {}

      if (epicIds.length > 0) {
        const { data: subtaskStats } = await admin
          .from('tasks')
          .select('parent_task_id, status')
          .in('parent_task_id', epicIds)
          .neq('status', 'deleted')

        for (const s of subtaskStats ?? []) {
          if (!progressMap[s.parent_task_id]) progressMap[s.parent_task_id] = { total: 0, done: 0 }
          progressMap[s.parent_task_id].total++
          if (s.status === 'done') progressMap[s.parent_task_id].done++
        }
      }

      const epicMap: Record<string, BacklogTask> = {}
      const topLevel: BacklogTask[] = []

      for (const r of rows) {
        if (r.type !== 'epic') continue
        const task: BacklogTask = {
          ...r,
          assignee: r.assignee ?? null,
          subtasks: [],
          subtask_total: progressMap[r.id]?.total ?? 0,
          subtask_done: progressMap[r.id]?.done ?? 0,
        }
        epicMap[r.id] = task
        topLevel.push(task)
      }

      for (const r of rows) {
        if (r.type === 'epic') continue
        const task: BacklogTask = {
          ...r,
          assignee: r.assignee ?? null,
          subtasks: [],
          subtask_total: 0,
          subtask_done: 0,
        }
        if (r.parent_task_id && epicMap[r.parent_task_id]) {
          epicMap[r.parent_task_id].subtasks.push(task)
        } else {
          topLevel.push(task)
        }
      }

      return topLevel
    },
    [`backlog-${projectId}`],
    { tags: [`tasks-${projectId}`] },
  )()
}

export function getProjectMembers(projectId: string) {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()
      const { data } = await admin
        .from('project_members')
        .select('user_id, role, profile:profiles!project_members_user_id_fkey(id, full_name, login, avatar_url)')
        .eq('project_id', projectId)
      return (data ?? []).map((m: any) => ({ ...m.profile, role: m.role }))
    },
    [`members-${projectId}`],
    { tags: [`members-${projectId}`] },
  )()
}

export function getActiveSprintForProject(projectId: string) {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()
      const { data } = await admin
        .from('sprints')
        .select('id, name')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
      return data
    },
    [`active-sprint-${projectId}`],
    { tags: [`tasks-${projectId}`] },
  )()
}
