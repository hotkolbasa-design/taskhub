import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessCrm } from '@/lib/utils/crm-access'
import { listSuggestions } from '@/lib/podskazchik/predlozheniya'
import { isEditor } from '@/lib/podskazchik/redaktor'
import PredlozheniyaClient from '@/components/predlozheniya/predlozheniya-client'

// Предложения хантеров по скрипту звонка (из подсказчика). Видят — как CRM, решают — админы и редакторы скрипта.
export default async function PredlozheniyaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, position, department')
    .eq('id', user.id)
    .maybeSingle()
  if (!canAccessCrm(profile ?? {})) redirect('/dashboard')

  const items = await listSuggestions().catch(() => [])
  return <PredlozheniyaClient items={items} canDecide={await isEditor(profile ?? {}, user.email)} />
}
