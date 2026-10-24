import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SidebarNav from '@/components/sidebar-nav'
import NavigationLoader from '@/components/navigation-loader'
import { isDemo } from '@/lib/demo/mode'
import { isDemoReadOnly } from '@/lib/demo/read-only'
import DemoReadOnlyBar from '@/components/demo/read-only-bar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, login, role, status, position, department')
    .eq('id', session.user.id)
    .maybeSingle()

  if (profile?.status === 'inactive') redirect('/login?reason=inactive')
  if (profile?.status === 'pending') redirect('/login?reason=pending')

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      <NavigationLoader />
      <SidebarNav profile={profile} demo={isDemo()} />
      {isDemoReadOnly() ? (
        // демо-сайт: плашка «только просмотр» над страницей, прокрутка — у main, как без неё
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <DemoReadOnlyBar />
          <main className="flex-1 overflow-auto min-h-0">
            {children}
          </main>
        </div>
      ) : (
        <main className="flex-1 overflow-auto h-full">
          {children}
        </main>
      )}
    </div>
  )
}
