'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCurrentUserId() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user.id ?? null
}

export async function createTask(projectId: string, data: {
  title: string
  type: 'task' | 'epic'
  assignee_id?: string | null
  deadline?: string | null
  time_estimate?: number | null
  parent_task_id?: string | null
  description?: string | null
}) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Не авторизован')

  const admin = createAdminClient()

  // Определяем backlog_order: максимальный + 1
  const { data: last } = await admin
    .from('tasks')
    .select('backlog_order')
    .eq('project_id', projectId)
    .eq('status', 'backlog')
    .order('backlog_order', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (last?.backlog_order ?? 0) + 1

  const { error } = await admin.from('tasks').insert({
    project_id: projectId,
    title: data.title,
    type: data.type,
    status: 'backlog',
    workflow_status: 'new',
    assignee_id: data.assignee_id ?? null,
    creator_id: userId,
    deadline: data.deadline ?? null,
    time_estimate: data.time_estimate ?? null,
    parent_task_id: data.parent_task_id ?? null,
    description: data.description ?? null,
    backlog_order: nextOrder,
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function deleteTask(taskId: string, projectId: string) {
  const admin = createAdminClient()
  // Мягкое удаление — статус deleted
  const { error } = await admin
    .from('tasks')
    .update({ status: 'deleted' })
    .eq('id', taskId)
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function moveToSprint(taskId: string, projectId: string) {
  const admin = createAdminClient()

  const { data: sprint } = await admin
    .from('sprints')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!sprint) throw new Error('Нет активного спринта')

  const { data: col } = await admin
    .from('sprint_columns')
    .select('id')
    .eq('sprint_id', sprint.id)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle()

  const updateData = { status: 'sprint' as const, sprint_id: sprint.id, column_id: col?.id ?? null }

  // Переносим саму задачу
  const { data: task } = await admin.from('tasks').select('type').eq('id', taskId).maybeSingle()
  await admin.from('tasks').update(updateData).eq('id', taskId)

  // Если эпик — переносим все его backlog-подзадачи
  if (task?.type === 'epic') {
    await admin.from('tasks').update(updateData)
      .eq('parent_task_id', taskId)
      .eq('status', 'backlog')
  }

  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function updateTask(taskId: string, projectId: string, data: {
  title?: string
  description?: string | null
  assignee_id?: string | null
  creator_id?: string | null
  deadline?: string | null
  time_estimate?: number | null
  parent_task_id?: string | null
  workflow_status?: string
}) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('tasks')
    .update({
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.assignee_id !== undefined && { assignee_id: data.assignee_id }),
      ...(data.creator_id !== undefined && { creator_id: data.creator_id }),
      ...(data.deadline !== undefined && { deadline: data.deadline }),
      ...(data.time_estimate !== undefined && { time_estimate: data.time_estimate }),
      ...(data.parent_task_id !== undefined && { parent_task_id: data.parent_task_id }),
      ...(data.workflow_status !== undefined && { workflow_status: data.workflow_status }),
    })
    .eq('id', taskId)
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function getComments(taskId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('comments')
    .select('*, author:profiles(id, full_name, login, avatar_url)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function uploadAttachment(formData: FormData): Promise<string> {
  const file = formData.get('file') as File
  const taskId = formData.get('taskId') as string
  if (!file || !taskId) throw new Error('Missing file or taskId')

  const admin = createAdminClient()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = file.name.split('.').pop() || 'png'
  const path = `${taskId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await admin.storage
    .from('task-attachments')
    .upload(path, buffer, { contentType: file.type || 'image/png' })

  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = admin.storage
    .from('task-attachments')
    .getPublicUrl(path)

  return publicUrl
}

export async function createComment(
  taskId: string,
  projectId: string,
  text: string,
  attachments?: { url: string; name: string; size: number }[]
) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Не авторизован')
  const admin = createAdminClient()
  const { error } = await admin.from('comments').insert({
    task_id: taskId,
    author_id: userId,
    text: text.trim(),
    attachments: attachments ?? [],
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function moveBackToBacklog(taskId: string, projectId: string, parentTaskId?: string | null) {
  const admin = createAdminClient()

  const { data: last } = await admin
    .from('tasks')
    .select('backlog_order')
    .eq('project_id', projectId)
    .eq('status', 'backlog')
    .order('backlog_order', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  let nextOrder = (last?.backlog_order ?? 0) + 1

  const { data: task } = await admin.from('tasks').select('type').eq('id', taskId).maybeSingle()

  await admin.from('tasks').update({
    status: 'backlog',
    sprint_id: null,
    column_id: null,
    column_order: null,
    parent_task_id: parentTaskId !== undefined ? parentTaskId : null,
    backlog_order: nextOrder,
  }).eq('id', taskId)

  // Если эпик — переносим его спринт-подзадачи обратно в бэклог (сохраняя parent_task_id)
  if (task?.type === 'epic') {
    const { data: subtasks } = await admin
      .from('tasks')
      .select('id')
      .eq('parent_task_id', taskId)
      .eq('status', 'sprint')

    if (subtasks) {
      for (const sub of subtasks) {
        nextOrder++
        await admin.from('tasks').update({
          status: 'backlog',
          sprint_id: null,
          column_id: null,
          column_order: null,
          backlog_order: nextOrder,
        }).eq('id', sub.id)
      }
    }
  }

  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function reorderBacklog(projectId: string, orderedIds: string[]) {
  const admin = createAdminClient()
  await Promise.all(
    orderedIds.map((id, index) =>
      admin.from('tasks').update({ backlog_order: index + 1 }).eq('id', id)
    )
  )
  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function reorderSprintTasks(projectId: string, orderedIds: string[]) {
  const admin = createAdminClient()
  await Promise.all(
    orderedIds.map((id, index) =>
      admin.from('tasks').update({ column_order: index }).eq('id', id)
    )
  )
  revalidatePath(`/projects/${projectId}/backlog`)
}
