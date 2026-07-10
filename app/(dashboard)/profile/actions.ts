'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getMyProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, login, role, position, birth_date, avatar_url')
    .eq('id', user.id)
    .single()

  return data ? { ...data, email: user.email ?? null } : null
}

export async function updateMyProfile(updates: {
  full_name?: string
  position?: string | null
  birth_date?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  await admin.from('profiles').update(updates).eq('id', user.id)
}
