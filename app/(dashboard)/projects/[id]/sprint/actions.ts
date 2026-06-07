'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const WEEKDAY_COLUMNS = [
  { name: 'Понедельник', color: '#4F8EF7' },
  { name: 'Вторник',     color: '#A78BFA' },
  { name: 'Среда',       color: '#2DD4A0' },
  { name: 'Четверг',     color: '#F7C04F' },
  { name: 'Пятница',     color: '#F75C6E' },
  { name: 'Суббота',     color: '#8892A4' },
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

  await admin
    .from('sprints')
    .update({ status: 'closed' })
    .eq('id', sprintId)

  revalidatePath(`/projects/${projectId}/sprint`)
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
