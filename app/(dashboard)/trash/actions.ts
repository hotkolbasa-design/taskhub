'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { BacklogTask } from '@/types'

export async function restoreTask(taskId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('tasks')
    .update({
      status: 'backlog',
      deleted_at: null,
      deleted_by: null,
      sprint_id: null,
      column_id: null,
    })
    .eq('id', taskId)
  if (error) throw new Error(error.message)
  revalidatePath('/trash')
}

export type DrawerData = {
  task: BacklogTask
  members: { id: string; full_name: string | null; login: string; avatar_url: string | null }[]
  epics: BacklogTask[]
  comments: unknown[]
}

export async function getTaskDrawerData(taskId: string): Promise<DrawerData> {
  const admin = createAdminClient()

  const { data: raw } = await admin
    .from('tasks')
    .select('*, assignee:profiles!tasks_assignee_id_fkey(full_name, login, avatar_url)')
    .eq('id', taskId)
    .single()

  if (!raw) throw new Error('Task not found')

  const task: BacklogTask = {
    ...raw,
    assignee: raw.assignee ?? null,
    subtasks: [],
    subtask_total: 0,
    subtask_done: 0,
  }

  const [membersRes, epicsRes, commentsRes] = await Promise.all([
    admin
      .from('project_members')
      .select('user_id, profile:profiles!project_members_user_id_fkey(id, full_name, login, avatar_url)')
      .eq('project_id', raw.project_id),
    admin
      .from('tasks')
      .select('*, assignee:profiles!tasks_assignee_id_fkey(full_name, login, avatar_url)')
      .eq('project_id', raw.project_id)
      .eq('type', 'epic')
      .eq('status', 'backlog'),
    admin
      .from('comments')
      .select('*, author:profiles(id, full_name, login, avatar_url)')
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
