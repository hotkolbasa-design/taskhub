import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, login')
    .eq('id', user!.id)
    .maybeSingle()

  const displayName = profile?.full_name || profile?.login || user?.email || ''

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Добро пожаловать в Task Hub
      </h1>
      {displayName && (
        <p className="mt-2 text-base" style={{ color: 'var(--text2)' }}>
          {displayName}
        </p>
      )}
    </div>
  )
}
