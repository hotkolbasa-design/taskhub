import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type MyTask = {
  id: string
  title: string
  type: 'task' | 'epic'
  status: 'backlog' | 'sprint' | 'done' | 'deleted'
  workflow_status: 'new' | 'in_progress' | 'review' | 'done' | 'cancelled'
  deadline: string | null
  priority: 'medium' | 'high' | null
  project_id: string
  project_name: string
  project_color: string
  assignee_id: string | null
  creator_id: string
  assignee: { id: string; full_name: string | null; login: string; avatar_url: string | null } | null
  creator: { id: string; full_name: string | null; login: string; avatar_url: string | null } | null
  comment_count: number
  time_estimate: number | null
  is_recurring: boolean
}

export function getMyTasks(targetUserId: string): Promise<MyTask[]> {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()

      const { data: rows, error } = await admin
        .from('tasks')
        .select(`
          id, title, type, status, workflow_status, deadline, priority,
          project_id, assignee_id, creator_id, time_estimate, is_recurring,
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, login, avatar_url),
          creator:profiles!tasks_creator_id_fkey(id, full_name, login, avatar_url),
          project:projects!tasks_project_id_fkey(id, name, color)
        `)
        .or(`assignee_id.eq.${targetUserId},creator_id.eq.${targetUserId}`)
        .neq('status', 'deleted')
        .order('deadline', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error || !rows) return []

      const taskIds = rows.map((r: any) => r.id)
      const commentCounts: Record<string, number> = {}

      if (taskIds.length > 0) {
        const { data: counts } = await admin
          .from('comments')
          .select('task_id')
          .in('task_id', taskIds)

        for (const c of counts ?? []) {
          commentCounts[c.task_id] = (commentCounts[c.task_id] ?? 0) + 1
        }
      }

      return rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        status: r.status,
        workflow_status: r.workflow_status ?? 'new',
        deadline: r.deadline,
        priority: r.priority,
        project_id: r.project_id,
        project_name: r.project?.name ?? '',
        project_color: r.project?.color ?? '#4F8EF7',
        assignee_id: r.assignee_id,
        creator_id: r.creator_id,
        assignee: r.assignee ?? null,
        creator: r.creator ?? null,
        comment_count: commentCounts[r.id] ?? 0,
        time_estimate: r.time_estimate,
        is_recurring: r.is_recurring ?? false,
      }))
    },
    [`my-tasks-${targetUserId}`],
    { tags: ['my-tasks'] },
  )()
}

export function getAllProfiles() {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()
      const { data } = await admin
        .from('profiles')
        .select('id, full_name, login, avatar_url')
        .eq('status', 'active')
        .order('full_name', { ascending: true })
      return (data ?? []) as { id: string; full_name: string | null; login: string; avatar_url: string | null }[]
    },
    ['all-profiles'],
    { tags: ['profiles'] },
  )()
}
