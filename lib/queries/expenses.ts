import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ExpenseRequest, ExpenseComment, ExpenseActivity, ExpensePerson } from '@/types'

const PERSON_FIELDS = 'id, full_name, login, avatar_url'

type RawRequest = Omit<ExpenseRequest, 'requester' | 'decider' | 'payer' | 'comment_count'>

async function attachPeople(rows: RawRequest[]): Promise<ExpenseRequest[]> {
  if (rows.length === 0) return []
  const admin = createAdminClient()

  const ids = new Set<string>()
  for (const r of rows) {
    ids.add(r.requester_id)
    if (r.decided_by) ids.add(r.decided_by)
    if (r.paid_by) ids.add(r.paid_by)
  }

  const [{ data: people }, { data: comments }] = await Promise.all([
    admin.from('profiles').select(PERSON_FIELDS).in('id', [...ids]),
    admin.from('expense_request_comments').select('request_id').in('request_id', rows.map(r => r.id)),
  ])

  const byId = new Map<string, ExpensePerson>((people ?? []).map((p: ExpensePerson) => [p.id, p]))
  const counts = new Map<string, number>()
  for (const c of (comments ?? []) as { request_id: string }[]) {
    counts.set(c.request_id, (counts.get(c.request_id) ?? 0) + 1)
  }

  return rows.map(r => ({
    ...r,
    amount: Number(r.amount),
    paid_amount: r.paid_amount === null ? null : Number(r.paid_amount),
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    requester: byId.get(r.requester_id) ?? null,
    decider: r.decided_by ? byId.get(r.decided_by) ?? null : null,
    payer: r.paid_by ? byId.get(r.paid_by) ?? null : null,
    comment_count: counts.get(r.id) ?? 0,
  }))
}

async function queryRequests(requesterId: string | null): Promise<ExpenseRequest[]> {
  const admin = createAdminClient()
  let q = admin.from('expense_requests').select('*').order('created_at', { ascending: false })
  if (requesterId) q = q.eq('requester_id', requesterId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return attachPeople((data ?? []) as RawRequest[])
}

/** Заявки одного сотрудника — он видит только их. */
export function getMyExpenseRequests(userId: string): Promise<ExpenseRequest[]> {
  return unstable_cache(
    () => queryRequests(userId),
    [`expenses-${userId}`],
    { tags: ['expenses'] },
  )()
}

/** Все заявки — для админов и тех, кому выдано право утверждать расходы. */
export function getAllExpenseRequests(): Promise<ExpenseRequest[]> {
  return unstable_cache(
    () => queryRequests(null),
    ['expenses-all'],
    { tags: ['expenses'] },
  )()
}

export async function getExpenseFeed(requestId: string): Promise<{
  comments: ExpenseComment[]
  activities: ExpenseActivity[]
}> {
  const admin = createAdminClient()

  const [{ data: comments }, { data: activities }] = await Promise.all([
    admin.from('expense_request_comments').select('*').eq('request_id', requestId).order('created_at'),
    admin.from('expense_request_activities').select('*').eq('request_id', requestId).order('created_at'),
  ])

  const ids = new Set<string>()
  for (const c of (comments ?? []) as ExpenseComment[]) ids.add(c.author_id)
  for (const a of (activities ?? []) as ExpenseActivity[]) if (a.actor_id) ids.add(a.actor_id)

  const { data: people } = ids.size
    ? await admin.from('profiles').select(PERSON_FIELDS).in('id', [...ids])
    : { data: [] }
  const byId = new Map<string, ExpensePerson>((people ?? []).map((p: ExpensePerson) => [p.id, p]))

  return {
    comments: ((comments ?? []) as ExpenseComment[]).map(c => ({
      ...c,
      attachments: Array.isArray(c.attachments) ? c.attachments : [],
      author: byId.get(c.author_id) ?? null,
    })),
    activities: ((activities ?? []) as ExpenseActivity[]).map(a => ({
      ...a,
      actor: a.actor_id ? byId.get(a.actor_id) ?? null : null,
    })),
  }
}
