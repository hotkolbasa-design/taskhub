'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Forbidden')
}

export async function approveUser(userId: string) {
  await requireAdmin()
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'active' }).eq('id', userId)
  revalidatePath('/admin')
}

export async function deactivateUser(userId: string) {
  await requireAdmin()
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'inactive' }).eq('id', userId)
  revalidatePath('/admin')
}

export async function setRole(userId: string, role: 'admin' | 'employee') {
  await requireAdmin()
  const admin = createAdminClient()
  await admin.from('profiles').update({ role }).eq('id', userId)
  revalidatePath('/admin')
}
