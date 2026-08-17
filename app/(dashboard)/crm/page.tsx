import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CrmDashboard from '@/components/crm/crm-dashboard'
import { canAccessCrm } from '@/lib/utils/crm-access'

export default async function CrmPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, position, department')
    .eq('id', session.user.id)
    .maybeSingle()

  if (!canAccessCrm(profile ?? {})) redirect('/dashboard')

  return (
    <div className="h-full overflow-hidden">
      <CrmDashboard />
    </div>
  )
}
