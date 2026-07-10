'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const WEEKDAY_COLUMNS = [
  { name: 'Новые',       color: '#8892A4' },
  { name: 'Понедельник', color: '#7C5CF6' },
  { name: 'Вторник',     color: '#A78BFA' },
  { name: 'Среда',       color: '#2DD4A0' },
  { name: 'Четверг',     color: '#F7C04F' },
  { name: 'Пятница',     color: '#F75C6E' },
  { name: 'Суббота',     color: '#60C0E8' },
]

export async function createSprint(projectId: string, data: {
  name: string
  dateFrom: string
  dateTo: string
  mode: 'weekdays' | 'custom'
  customColumns?: { name: string; color: string }[]
}) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Не авторизован')

  const admin = createAdminClient()

  const { data: sprint, error } = await admin
    .from('sprints')
    .insert({
      project_id: projectId,
      name: data.name,
      date_from: data.dateFrom,
      date_to: data.dateTo,
      status: 'active',
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error || !sprint) throw new Error(error?.message ?? 'Ошибка создания спринта')

  const cols = data.mode === 'weekdays' ? WEEKDAY_COLUMNS : (data.customColumns ?? [])

  await admin
    .from('sprint_columns')
    .insert(cols.map((c, i) => ({
      sprint_id: sprint.id,
      name: c.name,
      color: c.color,
      order_index: i,
    })))

  revalidatePath(`/projects/${projectId}/sprint`)
}

export async function closeSprint(sprintId: string, projectId: string) {
  const admin = createAdminClient()

  // Все задачи спринта
  const { data: allTasks } = await admin
    .from('tasks')
    .select('id, workflow_status, status')
    .eq('sprint_id', sprintId)
    .eq('status', 'sprint')

  const tasks = allTasks ?? []

  // Незавершённые задачи возвращаются в бэклог (не done и не cancelled)
  const unfinishedIds = tasks
    .filter(t => t.workflow_status !== 'done' && t.workflow_status !== 'cancelled')
    .map(t => t.id)

  if (unfinishedIds.length > 0) {
    await admin
      .from('tasks')
      .update({ status: 'backlog', sprint_id: null, column_id: null, column_order: null })
      .in('id', unfinishedIds)
  }

  // Снапшот: все задачи (включая незавершённые — для истории)
  const taskIds = tasks.map(t => t.id)

  await admin.from('sprints').update({
    status: 'closed',
    is_fixed: true,
    fixed_at: new Date().toISOString(),
    fixed_task_ids: taskIds,
  }).eq('id', sprintId)

  revalidatePath(`/projects/${projectId}/sprint`)
  revalidatePath(`/projects/${projectId}/backlog`)
  revalidatePath(`/projects/${projectId}/sprints`)
}

export async function getTasksMissingData(sprintId: string) {
  const admin = createAdminClient()
  const { data: tasks } = await admin
    .from('tasks')
    .select('id, title, deadline, time_estimate, type')
    .eq('sprint_id', sprintId)
    .eq('status', 'sprint')
    .neq('type', 'epic')

  const all = tasks ?? []
  return {
    missingDeadline: all.filter(t => !t.deadline),
    missingTime: all.filter(t => !t.time_estimate),
  }
}

export async function deleteClosedSprint(sprintId: string, projectId: string) {
  const admin = createAdminClient()

  // Возвращаем задачи в бэклог
  await admin
    .from('tasks')
    .update({ status: 'backlog', sprint_id: null, column_id: null, column_order: null })
    .eq('sprint_id', sprintId)

  // Удаляем колонки и сам спринт
  await admin.from('sprint_columns').delete().eq('sprint_id', sprintId)
  await admin.from('sprints').delete().eq('id', sprintId)

  revalidatePath(`/projects/${projectId}/sprint`)
  revalidatePath(`/projects/${projectId}/backlog`)
  revalidatePath(`/projects/${projectId}/sprints`)
}

export async function unfixSprint(sprintId: string, projectId: string) {
  const admin = createAdminClient()

  await admin.from('sprints').update({
    is_fixed: false,
    fixed_at: null,
    fixed_task_ids: null,
  }).eq('id', sprintId)

  revalidatePath(`/projects/${projectId}/sprint`)
  revalidatePath(`/projects/${projectId}/backlog`)
  revalidatePath(`/projects/${projectId}/sprints`)
}

export async function fixSprint(sprintId: string, projectId: string) {
  const admin = createAdminClient()

  // Снапшот: сохраняем текущие task_ids спринта
  const { data: tasks } = await admin
    .from('tasks')
    .select('id')
    .eq('sprint_id', sprintId)
    .eq('status', 'sprint')

  const taskIds = (tasks ?? []).map(t => t.id)

  await admin.from('sprints').update({
    is_fixed: true,
    fixed_at: new Date().toISOString(),
    fixed_task_ids: taskIds,
  }).eq('id', sprintId)

  revalidatePath(`/projects/${projectId}/sprint`)
  revalidatePath(`/projects/${projectId}/backlog`)
}

export async function moveTaskInSprint(
  updates: { id: string; column_id: string; column_order: number }[]
) {
  const admin = createAdminClient()

  await Promise.all(
    updates.map(u =>
      admin
        .from('tasks')
        .update({ column_id: u.column_id, column_order: u.column_order })
        .eq('id', u.id)
    )
  )
}

export async function deleteSprintColumn(columnId: string, sprintId: string, projectId: string) {
  const admin = createAdminClient()

  // Задачи переносим в первую оставшуюся колонку
  const { data: otherCols } = await admin
    .from('sprint_columns')
    .select('id')
    .eq('sprint_id', sprintId)
    .neq('id', columnId)
    .order('order_index', { ascending: true })
    .limit(1)

  if (otherCols && otherCols.length > 0) {
    await admin.from('tasks').update({ column_id: otherCols[0].id }).eq('column_id', columnId)
  }

  await admin.from('sprint_columns').delete().eq('id', columnId)
  revalidatePath(`/projects/${projectId}/sprint`)
}

export async function reorderSprintColumns(
  updates: { id: string; order_index: number }[]
) {
  const admin = createAdminClient()
  await Promise.all(
    updates.map(u =>
      admin.from('sprint_columns').update({ order_index: u.order_index }).eq('id', u.id)
    )
  )
}

export async function createSprintColumn(
  sprintId: string,
  projectId: string,
  name: string,
  color: string,
  orderIndex: number
) {
  const admin = createAdminClient()

  // Сдвигаем существующие колонки начиная с orderIndex
  const { data: existing } = await admin
    .from('sprint_columns')
    .select('id, order_index')
    .eq('sprint_id', sprintId)
    .gte('order_index', orderIndex)

  if (existing && existing.length > 0) {
    await Promise.all(
      existing.map(c =>
        admin.from('sprint_columns').update({ order_index: c.order_index + 1 }).eq('id', c.id)
      )
    )
  }

  const { data: col, error } = await admin.from('sprint_columns').insert({
    sprint_id: sprintId,
    name,
    color,
    order_index: orderIndex,
  }).select().single()

  if (error || !col) throw new Error(error?.message ?? 'Ошибка создания колонки')
  revalidatePath(`/projects/${projectId}/sprint`)
  return col as { id: string; sprint_id: string; name: string; color: string; order_index: number }
}
