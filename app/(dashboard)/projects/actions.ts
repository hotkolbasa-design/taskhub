'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidateTag } from 'next/cache'

export async function createProject(formData: {
  name: string
  description: string
  color: string
}) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Не авторизован')

  const userId = session.user.id

  const { data: project, error } = await admin
    .from('projects')
    .insert({
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      color: formData.color,
      created_by: userId,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const { error: memberError } = await admin
    .from('project_members')
    .insert({
      project_id: project.id,
      user_id: userId,
      role: 'owner',
    })

  if (memberError) throw new Error(memberError.message)

  revalidateTag('projects', "default")
  return project
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Не авторизован')

  // Удаляем в правильном порядке (с учётом FK)
  const { data: tasks } = await admin
    .from('tasks')
    .select('id')
    .eq('project_id', projectId)

  const taskIds = (tasks ?? []).map((t: any) => t.id)

  if (taskIds.length > 0) {
    await admin.from('task_history').delete().in('task_id', taskIds)
    await admin.from('comments').delete().in('task_id', taskIds)
    await admin.from('tasks').delete().eq('project_id', projectId)
  }

  const { data: sprints } = await admin
    .from('sprints')
    .select('id')
    .eq('project_id', projectId)

  const sprintIds = (sprints ?? []).map((s: any) => s.id)
  if (sprintIds.length > 0) {
    await admin.from('sprint_columns').delete().in('sprint_id', sprintIds)
    await admin.from('sprints').delete().eq('project_id', projectId)
  }

  await admin.from('project_members').delete().eq('project_id', projectId)
  await admin.from('projects').delete().eq('id', projectId)

  revalidateTag('projects', "default")
}
