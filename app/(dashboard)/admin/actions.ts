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

async function guardTarget(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (data?.role === 'admin') throw new Error('Cannot modify another admin')
}

export async function approveUser(userId: string) {
  await requireAdmin()
  await guardTarget(userId)
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'active' }).eq('id', userId)
  revalidatePath('/admin')
}

export async function deactivateUser(userId: string) {
  await requireAdmin()
  await guardTarget(userId)
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'inactive' }).eq('id', userId)
  revalidatePath('/admin')
}

export async function setRole(userId: string, role: 'admin' | 'employee') {
  await requireAdmin()
  if (role === 'admin') {
    // Повышение до admin разрешено — только понижение с admin заблокировано
  } else {
    await guardTarget(userId)
  }
  const admin = createAdminClient()
  await admin.from('profiles').update({ role }).eq('id', userId)
  revalidatePath('/admin')
}

export async function updateUserName(userId: string, fullName: string) {
  await requireAdmin()
  const admin = createAdminClient()
  await admin.from('profiles').update({ full_name: fullName }).eq('id', userId)
  revalidatePath('/admin')
}
