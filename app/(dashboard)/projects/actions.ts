'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createProject(formData: {
  name: string
  description: string
  color: string
}) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Не авторизован')

  const userId = session.user.id

  const { data: project, error } = await supabase
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

  await supabase.from('project_members').insert({
    project_id: project.id,
    user_id: userId,
    role: 'owner',
  })

  revalidatePath('/projects')
  return project
}
