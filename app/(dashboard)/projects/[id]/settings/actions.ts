'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getSession() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Не авторизован')
  return session
}

export async function updateProject(projectId: string, data: {
  name: string
  description: string
  color: string
  default_assignee_mode?: 'manual' | 'creator' | 'specific'
  default_assignee_id?: string | null
}) {
  await getSession()
  const admin = createAdminClient()

  const { error } = await admin
    .from('projects')
    .update({
      name: data.name.trim(),
      description: data.description.trim() || null,
      color: data.color,
      ...(data.default_assignee_mode !== undefined && { default_assignee_mode: data.default_assignee_mode }),
      ...(data.default_assignee_id !== undefined && { default_assignee_id: data.default_assignee_id }),
    })
    .eq('id', projectId)

  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/settings`)
  revalidatePath('/projects')
}

export async function addMember(projectId: string, userId: string, role: 'manager' | 'member' | 'viewer') {
  await getSession()
  const admin = createAdminClient()

  const { error } = await admin
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, role })

  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/settings`)
}

export async function updateMemberRole(projectId: string, userId: string, role: 'manager' | 'member' | 'viewer') {
  await getSession()
  const admin = createAdminClient()

  const { error } = await admin
    .from('project_members')
    .update({ role })
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/settings`)
}

export async function removeMember(projectId: string, userId: string) {
  await getSession()
  const admin = createAdminClient()

  const { error } = await admin
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}/settings`)
}
