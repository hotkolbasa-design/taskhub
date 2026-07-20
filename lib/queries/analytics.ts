import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type TaskStat = {
  id: string
  title: string
  type: 'task' | 'epic'
  parent_task_id: string | null
  workflow_status: string
  task_status: string
  deadline: string | null
  time_estimate: number | null
  closed_at: string | null
}

export type SprintStat = {
  sprint_id: string
  sprint_name: string
  project_id: string
  project_name: string
  date_from: string
  date_to: string
  sprint_status: 'active' | 'closed'
  is_fixed: boolean
  fixed_at: string | null
  total_tasks: number
  total_time: number
  done_count: number
  done_time: number
  cancelled_count: number
  not_done_count: number
  efficiency: number
  tasks: TaskStat[]
}

export type AnalyticsUser = {
  id: string
  full_name: string | null
  login: string
  avatar_url: string | null
  role: string
}

function calcStats(tasks: any[]): Pick<SprintStat, 'total_tasks' | 'total_time' | 'done_count' | 'done_time' | 'cancelled_count' | 'not_done_count' | 'efficiency'> {
  const onlyTasks = tasks.filter(t => t.type !== 'epic')
  const active = onlyTasks.filter(t => t.task_status !== 'deleted')
  const cancelled = active.filter(t => t.workflow_status === 'cancelled')
  const nonCancelled = active.filter(t => t.workflow_status !== 'cancelled')
  const done = nonCancelled.filter(t => t.workflow_status === 'done')
  const notDone = nonCancelled.filter(t => t.workflow_status !== 'done')
  const totalTime = nonCancelled.reduce((s, t) => s + (t.time_estimate ?? 0), 0)
  const doneTime = done.reduce((s, t) => s + (t.time_estimate ?? 0), 0)

  const efficiency = (() => {
    const relevantTime = [...done, ...notDone].reduce((s, t) => s + (t.time_estimate ?? 0), 0)
    if (relevantTime > 0) return Math.round(doneTime / relevantTime * 100)
    const relevantCount = done.length + notDone.length
    if (relevantCount > 0) return Math.round(done.length / relevantCount * 100)
    return 0
  })()

  return {
    total_tasks: nonCancelled.length,
    total_time: totalTime,
    done_count: done.length,
    done_time: doneTime,
    cancelled_count: cancelled.length,
    not_done_count: notDone.length,
    efficiency,
  }
}

export function getProjectSprintHistory(projectId: string): Promise<SprintStat[]> {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()

      const [{ data: sprints }, { data: project }] = await Promise.all([
        admin.from('sprints').select('*').eq('project_id', projectId)
          .or('status.eq.closed,is_fixed.eq.true')
          .order('date_from', { ascending: false }),
        admin.from('projects').select('name').eq('id', projectId).maybeSingle(),
      ])

      if (!sprints?.length) return []

      const results: SprintStat[] = []

      for (const sprint of sprints) {
        let rawTasks: any[] = []

        if (sprint.fixed_task_ids?.length) {
          const { data } = await admin
            .from('tasks')
            .select('id, title, type, parent_task_id, workflow_status, status, deadline, time_estimate, closed_at')
            .in('id', sprint.fixed_task_ids)
          rawTasks = data ?? []
        } else {
          const { data } = await admin
            .from('tasks')
            .select('id, title, type, parent_task_id, workflow_status, status, deadline, time_estimate, closed_at')
            .eq('sprint_id', sprint.id)
          rawTasks = data ?? []
        }

        const tasks: TaskStat[] = rawTasks.map(t => ({
          id: t.id, title: t.title, type: t.type,
          parent_task_id: t.parent_task_id ?? null,
          workflow_status: t.workflow_status, task_status: t.status,
          deadline: t.deadline, time_estimate: t.time_estimate, closed_at: t.closed_at,
        }))

        results.push({
          sprint_id: sprint.id, sprint_name: sprint.name,
          project_id: projectId, project_name: project?.name ?? '',
          date_from: sprint.date_from, date_to: sprint.date_to,
          sprint_status: sprint.status, is_fixed: sprint.is_fixed, fixed_at: sprint.fixed_at,
          tasks, ...calcStats(tasks),
        })
      }

      return results
    },
    [`sprint-history-${projectId}`],
    { tags: [`sprints-${projectId}`] },
  )()
}

export function getUserSprintHistory(userId: string): Promise<SprintStat[]> {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()

      const { data: userTasks } = await admin
        .from('tasks')
        .select('id, sprint_id, project_id')
        .eq('assignee_id', userId)
        .not('sprint_id', 'is', null)
        .neq('type', 'epic')

      if (!userTasks?.length) return []

      const sprintIds = [...new Set(userTasks.map(t => t.sprint_id as string))]

      const { data: sprints } = await admin
        .from('sprints')
        .select('*, projects(name)')
        .in('id', sprintIds)
        .order('date_from', { ascending: false })

      if (!sprints?.length) return []

      const results: SprintStat[] = []

      for (const sprint of sprints) {
        let rawTasks: any[] = []

        if (sprint.fixed_task_ids?.length) {
          const { data } = await admin
            .from('tasks')
            .select('id, title, type, parent_task_id, workflow_status, status, deadline, time_estimate, closed_at')
            .in('id', sprint.fixed_task_ids)
            .eq('assignee_id', userId)
          rawTasks = data ?? []
        } else {
          const { data } = await admin
            .from('tasks')
            .select('id, title, type, parent_task_id, workflow_status, status, deadline, time_estimate, closed_at')
            .eq('sprint_id', sprint.id)
            .eq('assignee_id', userId)
          rawTasks = data ?? []
        }

        if (!rawTasks.length) continue

        const tasks: TaskStat[] = rawTasks.map(t => ({
          id: t.id, title: t.title, type: t.type,
          parent_task_id: t.parent_task_id ?? null,
          workflow_status: t.workflow_status, task_status: t.status,
          deadline: t.deadline, time_estimate: t.time_estimate, closed_at: t.closed_at,
        }))

        results.push({
          sprint_id: sprint.id, sprint_name: sprint.name,
          project_id: sprint.project_id, project_name: (sprint as any).projects?.name ?? '',
          date_from: sprint.date_from, date_to: sprint.date_to,
          sprint_status: sprint.status, is_fixed: sprint.is_fixed, fixed_at: sprint.fixed_at,
          tasks, ...calcStats(tasks),
        })
      }

      return results
    },
    [`user-sprint-history-${userId}`],
    { tags: [`analytics-${userId}`] },
  )()
}

export function getVisibleUsers(currentUserId: string, currentUserRole: string): Promise<AnalyticsUser[]> {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()

      if (currentUserRole === 'admin') {
        const { data } = await admin
          .from('profiles')
          .select('id, full_name, login, avatar_url, role')
          .eq('status', 'active')
          .order('full_name', { ascending: true })
        return (data ?? []) as AnalyticsUser[]
      }

      const { data: access } = await admin
        .from('access_settings')
        .select('visible_user_ids')
        .eq('user_id', currentUserId)
        .maybeSingle()

      const ids = [currentUserId, ...(access?.visible_user_ids ?? [])]
      const { data } = await admin
        .from('profiles')
        .select('id, full_name, login, avatar_url, role')
        .in('id', ids)
        .eq('status', 'active')
        .order('full_name', { ascending: true })

      return (data ?? []) as AnalyticsUser[]
    },
    [`visible-users-${currentUserId}-${currentUserRole}`],
    { tags: ['profiles'] },
  )()
}
