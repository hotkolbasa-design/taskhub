'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

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

  revalidatePath('/projects')
  return project
}
