import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CrmDashboard from '@/components/crm/crm-dashboard'

export default async function CrmPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, position')
    .eq('id', session.user.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'
  const isMarketer = profile?.position?.toLowerCase() === 'маркетолог'
  if (!isAdmin && !isMarketer) redirect('/dashboard')

  return (
    <div className="h-full overflow-hidden">
      <CrmDashboard />
    </div>
  )
}
