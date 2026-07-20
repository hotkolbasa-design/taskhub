import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminUsersClient from '@/components/admin-users-client'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (!myProfile || myProfile.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, login, role, status, position, department, birth_date, created_at')
    .order('created_at', { ascending: false })

  const listResult = await admin.auth.admin.listUsers().catch(() => ({ data: { users: [] } }))
  const authUsers = listResult.data?.users ?? []
  const emailMap = Object.fromEntries(authUsers.map((u: any) => [u.id, u.email]))

  const SUPERADMIN_EMAIL = 'director@goschool.kz'
  const superAdminId = authUsers.find((u: any) => u.email === SUPERADMIN_EMAIL)?.id ?? null

  return (
    <div className="p-8 max-w-5xl">
      <AdminUsersClient
        users={profiles ?? []}
        emailMap={emailMap}
        currentUserId={user.id}
        superAdminId={superAdminId}
      />
    </div>
  )
}
