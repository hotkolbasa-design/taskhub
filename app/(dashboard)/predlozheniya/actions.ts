'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SuggestionStatus } from '@/lib/podskazchik/predlozheniya'

// Решение по предложению хантера — только админы
export async function decideSuggestion(id: number, status: SuggestionStatus, decision: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Не авторизован')
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') throw new Error('Решение принимает администратор')
  if (!['new', 'approved', 'rejected', 'applied'].includes(status)) throw new Error('Неизвестный статус')

  const { error } = await createAdminClient()
    .from('script_suggestions')
    .update({
      status,
      decision: decision.trim().slice(0, 1000),
      decided_by: status === 'new' ? null : profile.full_name,
      decided_at: status === 'new' ? null : new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/predlozheniya')
}
