'use server'

import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getMyTasks, getTasksForUsers } from '@/lib/queries/my-tasks'
import { backlogArchivePatch, archiveAction, syncEpicSubtasksArchive } from '@/lib/queries/task-archive'
import type { BacklogTask } from '@/types'

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', session.user.id)
    .maybeSingle()
  return profile ? { id: profile.id, role: profile.role as 'admin' | 'employee' } : null
}

export async function fetchTasksForUser(targetUserId: string) {
  const user = await getCurrentUser()
  if (!user) return []
  const effectiveId = user.role === 'admin' ? targetUserId : user.id
  return getMyTasks(effectiveId)
}

// Мультивыбор сотрудников в «Мои задачи» — только админ может смотреть чужие задачи
export async function fetchTasksForUsers(userIds: string[]) {
  const user = await getCurrentUser()
  if (!user) return []
  if (user.role !== 'admin') return getMyTasks(user.id)
  return getTasksForUsers(userIds)
}

export async function updateTaskWorkflowStatus(taskId: string, workflowStatus: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Не авторизован')
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('tasks')
    .select('status, workflow_status, type, project_id')
    .eq('id', taskId)
    .maybeSingle()

  // Выполненная в бэклоге задача уходит в архив (см. task-archive.ts)
  const archivePatch = current
    ? await backlogArchivePatch(admin, current.project_id, current.status, current.workflow_status, workflowStatus)
    : {}

  const { error } = await admin
    .from('tasks')
    .update({ workflow_status: workflowStatus, ...archivePatch, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw new Error(error.message)

  // Эпик уходит в архив вместе с подзадачами
  if (current?.type === 'epic') {
    await syncEpicSubtasksArchive(admin, current.project_id, taskId, archiveAction(current.status, current.workflow_status, workflowStatus))
  }

  if (current) revalidateTag(`tasks-${current.project_id}`, 'default')
  revalidateTag('my-tasks', 'default')
}

export async function updateTaskPriority(taskId: string, priority: 'medium' | 'high' | null) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Не авторизован')
  const admin = createAdminClient()
  const { error } = await admin
    .from('tasks')
    .update({ priority, updated_at: new Date().toISOString() })
    .eq('id', taskId)
  if (error) throw new Error(error.message)
}

export type DrawerData = {
  task: BacklogTask
  members: { id: string; full_name: string | null; login: string; avatar_url: string | null }[]
  epics: BacklogTask[]
  comments: unknown[]
}

export async function getTaskForDrawer(taskId: string): Promise<DrawerData | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const admin = createAdminClient()

  const { data: row } = await admin
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(full_name, login, avatar_url)
    `)
    .eq('id', taskId)
    .maybeSingle()

  if (!row) return null

  const task: BacklogTask = {
    ...row,
    assignee: row.assignee ?? null,
    subtasks: [],
    subtask_total: 0,
    subtask_done: 0,
  }

  const [membersRes, epicsRes, commentsRes] = await Promise.all([
    admin
      .from('project_members')
      .select('user_id, profile:profiles!project_members_user_id_fkey(id, full_name, login, avatar_url)')
      .eq('project_id', row.project_id),
    admin
      .from('tasks')
      .select('*, assignee:profiles!tasks_assignee_id_fkey(full_name, login, avatar_url)')
      .eq('project_id', row.project_id)
      .eq('type', 'epic')
      .neq('status', 'deleted'),
    admin
      .from('comments')
      .select('*, author:profiles!comments_author_id_fkey(id, full_name, login, avatar_url)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true }),
  ])

  const members = (membersRes.data ?? []).map((m: any) => ({ ...m.profile }))
  const epics: BacklogTask[] = (epicsRes.data ?? []).map((e: any) => ({
    ...e,
    assignee: e.assignee ?? null,
    subtasks: [],
    subtask_total: 0,
    subtask_done: 0,
  }))

  return { task, members, epics, comments: commentsRes.data ?? [] }
}
