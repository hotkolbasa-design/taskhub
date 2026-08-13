'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SUPERADMIN_EMAIL = 'director@goschool.kz'

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
  return user
}

async function isSuperAdmin(callerId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(callerId)
  return data?.user?.email === SUPERADMIN_EMAIL
}

async function guardTarget(userId: string, callerId: string) {
  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('role').eq('id', userId).single()
  if (target?.role !== 'admin') return

  if (!(await isSuperAdmin(callerId))) throw new Error('Only superadmin can modify admins')
}

export async function getPendingUsersCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return 0

  const admin = createAdminClient()
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  return count ?? 0
}

export async function approveUser(userId: string) {
  const caller = await requireAdmin()
  await guardTarget(userId, caller.id)
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'active' }).eq('id', userId)
  revalidateTag('profiles', "default")
}

export async function deactivateUser(userId: string) {
  const caller = await requireAdmin()
  await guardTarget(userId, caller.id)
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'inactive' }).eq('id', userId)
  revalidateTag('profiles', "default")
}

export async function setStatus(userId: string, status: 'active' | 'inactive') {
  const caller = await requireAdmin()
  await guardTarget(userId, caller.id)
  const admin = createAdminClient()
  await admin.from('profiles').update({ status }).eq('id', userId)
  revalidateTag('profiles', "default")
}

export async function setRole(userId: string, role: 'admin' | 'employee') {
  const caller = await requireAdmin()
  // Только суперадмин может назначать роль admin или менять её
  if (role === 'admin' && !(await isSuperAdmin(caller.id))) {
    throw new Error('Only superadmin can assign admin role')
  }
  await guardTarget(userId, caller.id)
  const admin = createAdminClient()
  await admin.from('profiles').update({ role }).eq('id', userId)
  revalidateTag('profiles', "default")
}

export async function updateUserName(userId: string, fullName: string) {
  await requireAdmin()
  const admin = createAdminClient()
  await admin.from('profiles').update({ full_name: fullName }).eq('id', userId)
  revalidateTag('profiles', "default")
}

export async function updateUserProfile(
  userId: string,
  updates: { full_name?: string; position?: string | null; department?: string | null; birth_date?: string | null }
) {
  await requireAdmin()
  const admin = createAdminClient()
  await admin.from('profiles').update(updates).eq('id', userId)
  revalidateTag('profiles', "default")
}

export async function inviteUser(data: {
  email: string
  full_name: string
  role: 'admin' | 'employee'
  position: string
  department: string
}) {
  const caller = await requireAdmin()
  if (data.role === 'admin' && !(await isSuperAdmin(caller.id))) {
    throw new Error('Только суперадмин может приглашать администраторов')
  }

  const admin = createAdminClient()
  const { data: authData, error } = await admin.auth.admin.inviteUserByEmail(data.email, {
    data: { full_name: data.full_name || null },
    redirectTo: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://taskhub-ecru.vercel.app',
  })
  if (error) throw new Error(error.message)

  if (authData.user) {
    await admin.from('profiles').upsert({
      id: authData.user.id,
      login: data.email.split('@')[0],
      full_name: data.full_name || null,
      role: data.role,
      position: data.position || null,
      department: data.department || null,
      status: 'pending',
    })
  }

  revalidateTag('profiles', "default")
}
