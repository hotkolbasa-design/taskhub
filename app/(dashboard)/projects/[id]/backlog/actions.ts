'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotifications, buildRecipients } from '@/lib/notifications'

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

  const { data: task, error } = await admin.from('tasks').insert({
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
  }).select('id').single()

  if (error || !task) throw new Error(error?.message ?? 'Ошибка создания задачи')

  // Уведомляем исполнителя, если это не сам создатель
  if (data.assignee_id && data.assignee_id !== userId) {
    await createNotifications([{
      user_id: data.assignee_id,
      actor_id: userId,
      task_id: task.id,
      type: 'task_assigned',
      data: { task_title: data.title },
    }])
  }

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
    .select('id, date_to, is_fixed, fixed_task_ids')
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

  const baseUpdate = { status: 'sprint' as const, sprint_id: sprint.id, column_id: col?.id ?? null }

  const { data: task } = await admin.from('tasks').select('type, id, deadline').eq('id', taskId).maybeSingle()

  const taskDeadline = task?.deadline ?? (sprint.date_to ?? null)
  await admin.from('tasks').update({ ...baseUpdate, deadline: taskDeadline }).eq('id', taskId)

  const movedIds: string[] = [taskId]

  if (task?.type === 'epic') {
    const { data: subtasks } = await admin.from('tasks')
      .select('id, deadline')
      .eq('parent_task_id', taskId)
      .eq('status', 'backlog')

    for (const sub of subtasks ?? []) {
      const subDeadline = sub.deadline ?? (sprint.date_to ?? null)
      await admin.from('tasks').update({ ...baseUpdate, deadline: subDeadline }).eq('id', sub.id)
    }
    movedIds.push(...(subtasks ?? []).map((s: { id: string }) => s.id))
  }

  // Если спринт зафиксирован — добавляем новые задачи в снапшот
  if (sprint.is_fixed) {
    const existing: string[] = sprint.fixed_task_ids ?? []
    const newIds = movedIds.filter(id => !existing.includes(id))
    if (newIds.length > 0) {
      await admin.from('sprints').update({
        fixed_task_ids: [...existing, ...newIds],
      }).eq('id', sprint.id)
    }
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
  const userId = await getCurrentUserId()
  const admin = createAdminClient()

  // Читаем текущие значения для сравнения
  const { data: current } = await admin
    .from('tasks')
    .select('workflow_status, deadline, time_estimate, assignee_id, creator_id, title')
    .eq('id', taskId)
    .single()

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

  // Записываем историю изменений + уведомления
  if (current && userId) {
    const activities: { task_id: string; actor_id: string; type: string; old_value: string | null; new_value: string | null }[] = []
    const notifications: Parameters<typeof createNotifications>[0] = []

    const taskTitle = current.title as string | null
    const creatorId = current.creator_id as string | null
    const assigneeId = current.assignee_id as string | null

    if (data.workflow_status !== undefined && data.workflow_status !== current.workflow_status) {
      activities.push({ task_id: taskId, actor_id: userId, type: 'status_change', old_value: current.workflow_status, new_value: data.workflow_status })
      const recipients = buildRecipients({ actorId: userId, creatorId, assigneeId })
      for (const uid of recipients) {
        notifications.push({ user_id: uid, actor_id: userId, task_id: taskId, type: 'status_changed', data: { task_title: taskTitle, old_status: current.workflow_status, new_status: data.workflow_status } })
      }
    }
    if (data.deadline !== undefined && data.deadline !== current.deadline) {
      activities.push({ task_id: taskId, actor_id: userId, type: 'deadline_change', old_value: current.deadline ?? null, new_value: data.deadline ?? null })
    }
    if (data.time_estimate !== undefined && data.time_estimate !== current.time_estimate) {
      activities.push({ task_id: taskId, actor_id: userId, type: 'time_change', old_value: current.time_estimate != null ? String(current.time_estimate) : null, new_value: data.time_estimate != null ? String(data.time_estimate) : null })
    }
    if (data.assignee_id !== undefined && data.assignee_id !== current.assignee_id) {
      activities.push({ task_id: taskId, actor_id: userId, type: 'assignee_change', old_value: current.assignee_id ?? null, new_value: data.assignee_id ?? null })
      // Уведомляем нового исполнителя и создателя (кроме актора)
      const newAssigneeId = data.assignee_id
      const recipients = buildRecipients({ actorId: userId, creatorId, assigneeId: newAssigneeId ?? null })
      for (const uid of recipients) {
        notifications.push({ user_id: uid, actor_id: userId, task_id: taskId, type: 'assignee_changed', data: { task_title: taskTitle } })
      }
    }
    if (data.creator_id !== undefined && data.creator_id !== current.creator_id) {
      activities.push({ task_id: taskId, actor_id: userId, type: 'creator_change', old_value: current.creator_id ?? null, new_value: data.creator_id ?? null })
      // Уведомляем нового постановщика и исполнителя (кроме актора)
      const newCreatorId = data.creator_id
      const recipients = buildRecipients({ actorId: userId, creatorId: newCreatorId ?? null, assigneeId })
      for (const uid of recipients) {
        notifications.push({ user_id: uid, actor_id: userId, task_id: taskId, type: 'creator_changed', data: { task_title: taskTitle } })
      }
    }

    if (activities.length > 0) {
      await admin.from('task_activities').insert(activities)
    }
    if (notifications.length > 0) {
      await createNotifications(notifications)
    }
  }

  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function getActivities(taskId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('task_activities')
    .select('*, actor:profiles(id, full_name, login, avatar_url)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  return data ?? []
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

  // Уведомляем создателя и исполнителя задачи (кроме автора комментария)
  const { data: task } = await admin
    .from('tasks')
    .select('creator_id, assignee_id, title')
    .eq('id', taskId)
    .maybeSingle()

  if (task) {
    const recipients = buildRecipients({ actorId: userId, creatorId: task.creator_id ?? null, assigneeId: task.assignee_id ?? null })
    if (recipients.length > 0) {
      await createNotifications(recipients.map(uid => ({
        user_id: uid,
        actor_id: userId,
        task_id: taskId,
        type: 'comment_added' as const,
        data: { task_title: task.title, comment_preview: text.trim().slice(0, 100) },
      })))
    }
  }

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

  // Если эпик — переносим незавершённые подзадачи в бэклог, выполненные/отменённые — в done
  if (task?.type === 'epic') {
    const { data: subtasks } = await admin
      .from('tasks')
      .select('id, workflow_status')
      .eq('parent_task_id', taskId)
      .eq('status', 'sprint')

    if (subtasks) {
      for (const sub of subtasks) {
        if (sub.workflow_status === 'done' || sub.workflow_status === 'cancelled') {
          await admin.from('tasks').update({
            status: 'done',
            sprint_id: null,
            column_id: null,
            column_order: null,
          }).eq('id', sub.id)
        } else {
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

export async function deleteSprint(sprintId: string, projectId: string) {
  const admin = createAdminClient()

  // Получаем максимальный backlog_order для вставки в конец
  const { data: last } = await admin
    .from('tasks')
    .select('backlog_order')
    .eq('project_id', projectId)
    .eq('status', 'backlog')
    .order('backlog_order', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  let nextOrder = (last?.backlog_order ?? 0) + 1

  // Переносим все задачи спринта обратно в бэклог
  const { data: sprintTasks } = await admin
    .from('tasks')
    .select('id')
    .eq('sprint_id', sprintId)
    .neq('status', 'deleted')

  if (sprintTasks && sprintTasks.length > 0) {
    for (const t of sprintTasks) {
      await admin.from('tasks').update({
        status: 'backlog',
        sprint_id: null,
        column_id: null,
        column_order: null,
        backlog_order: nextOrder++,
      }).eq('id', t.id)
    }
  }

  // Удаляем колонки спринта и сам спринт
  await admin.from('sprint_columns').delete().eq('sprint_id', sprintId)
  await admin.from('sprints').delete().eq('id', sprintId)

  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function updateSprintPeriod(sprintId: string, projectId: string, dateFrom: string, dateTo: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('sprints').update({ date_from: dateFrom, date_to: dateTo }).eq('id', sprintId)
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function createSprint(projectId: string, dateFrom: string, dateTo: string) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Не авторизован')

  const admin = createAdminClient()

  const { count } = await admin.from('sprints').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
  const name = `Спринт ${(count ?? 0) + 1}`

  const { data: sprint, error } = await admin.from('sprints').insert({
    project_id: projectId,
    name,
    date_from: dateFrom,
    date_to: dateTo,
    status: 'active',
    created_by: userId,
  }).select().maybeSingle()

  if (error || !sprint) throw new Error(error?.message ?? 'Не удалось создать спринт')

  await admin.from('sprint_columns').insert([
    { sprint_id: sprint.id, name: 'К выполнению', color: '#7C5CF6', order_index: 0 },
    { sprint_id: sprint.id, name: 'В работе',     color: '#F7C04F', order_index: 1 },
    { sprint_id: sprint.id, name: 'Готово',        color: '#2DD4A0', order_index: 2 },
  ])

  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function removeFromEpic(taskId: string, projectId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('tasks')
    .update({ parent_task_id: null })
    .eq('id', taskId)
  if (error) throw new Error(error.message)
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

export async function createSprintTask(
  sprintId: string,
  projectId: string,
  data: {
    title: string
    type: 'task' | 'epic'
    description?: string | null
    assignee_id?: string | null
    deadline?: string | null
    time_estimate?: number | null
    parent_task_id?: string | null
  }
): Promise<string> {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Не авторизован')

  const admin = createAdminClient()

  const [{ data: col }, { data: sprint }] = await Promise.all([
    admin
      .from('sprint_columns')
      .select('id')
      .eq('sprint_id', sprintId)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from('sprints')
      .select('date_to')
      .eq('id', sprintId)
      .single(),
  ])

  const deadline = data.deadline ?? sprint?.date_to ?? null

  const { data: task, error } = await admin.from('tasks').insert({
    project_id: projectId,
    title: data.title,
    type: data.type,
    status: 'sprint',
    workflow_status: 'new',
    sprint_id: sprintId,
    column_id: col?.id ?? null,
    assignee_id: data.assignee_id ?? null,
    creator_id: userId,
    deadline,
    time_estimate: data.time_estimate ?? null,
    parent_task_id: data.parent_task_id ?? null,
    description: data.description ?? null,
  }).select('id').single()

  if (error || !task) throw new Error(error?.message ?? 'Ошибка создания задачи')

  // Уведомляем исполнителя, если это не сам создатель
  if (data.assignee_id && data.assignee_id !== userId) {
    await createNotifications([{
      user_id: data.assignee_id,
      actor_id: userId,
      task_id: task.id,
      type: 'task_assigned',
      data: { task_title: data.title },
    }])
  }

  revalidatePath(`/projects/${projectId}/backlog`)
  return task.id
}
