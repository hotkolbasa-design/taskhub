'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

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
