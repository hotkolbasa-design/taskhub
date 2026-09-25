import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyExpenseRequests, getAllExpenseRequests } from '@/lib/queries/expenses'
import ExpensesClient from '@/components/expenses/expenses-client'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, login, role, department, can_approve_expenses')
    .eq('id', session.user.id)
    .maybeSingle()

  if (!profile) redirect('/login')

  const canApprove = profile.role === 'admin' || profile.can_approve_expenses === true
  const requests = await (canApprove ? getAllExpenseRequests() : getMyExpenseRequests(profile.id)).catch(() => [])

  return (
    <ExpensesClient
      requests={requests}
      currentUserId={profile.id}
      canApprove={canApprove}
      department={profile.department ?? null}
    />
  )
}
