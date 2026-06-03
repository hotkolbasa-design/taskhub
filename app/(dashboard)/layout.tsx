import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/sidebar-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, login, role')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      <SidebarNav profile={profile} />
      <main className="flex-1 overflow-auto h-full">
        {children}
      </main>
    </div>
  )
}
