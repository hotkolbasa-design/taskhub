'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getExpenseFeed } from '@/lib/queries/expenses'
import type { ExpenseAttachment, ExpenseCategory, ExpenseStatus } from '@/types'

type Caller = {
  id: string
  role: 'admin' | 'employee'
  department: string | null
  canApprove: boolean
}

async function getCaller(): Promise<Caller | null> {
  const supabase = await createClient()
  // Именно getUser(), а не getSession(): здесь решается доступ к деньгам,
  // и личность должен подтвердить Auth-сервер, а не кука
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, department, can_approve_expenses')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return null
  return {
    id: profile.id,
    role: profile.role as 'admin' | 'employee',
    department: profile.department ?? null,
    // Учредителю выдан флаг, чтобы решать по расходам, не получая остальную админку
    canApprove: profile.role === 'admin' || profile.can_approve_expenses === true,
  }
}

async function requireCaller(): Promise<Caller> {
  const caller = await getCaller()
  if (!caller) throw new Error('Не авторизован')
  return caller
}

async function requireApprover(): Promise<Caller> {
  const caller = await requireCaller()
  if (!caller.canApprove) throw new Error('Нет прав решать по заявкам')
  return caller
}

async function logActivity(
  requestId: string,
  actorId: string | null,
  type: 'created' | 'status_changed' | 'edited' | 'paid' | 'payment_undone',
  oldValue: string | null,
  newValue: string | null,
) {
  const admin = createAdminClient()
  await admin.from('expense_request_activities').insert({
    request_id: requestId,
    actor_id: actorId,
    type,
    old_value: oldValue,
    new_value: newValue,
  })
}

async function notifyApprovers(requestId: string, actorId: string, title: string) {
  const admin = createAdminClient()
  const { data: approvers } = await admin
    .from('profiles')
    .select('id')
    .eq('status', 'active')
    .or('role.eq.admin,can_approve_expenses.eq.true')

  const recipients = (approvers ?? []).map((p: { id: string }) => p.id).filter(id => id !== actorId)
  if (recipients.length === 0) return

  await admin.from('notifications').insert(
    recipients.map(userId => ({
      user_id: userId,
      actor_id: actorId,
      expense_request_id: requestId,
      type: 'expense_submitted',
      data: { title },
    })),
  )
}

async function notifyUser(
  userId: string,
  actorId: string,
  requestId: string,
  type: 'expense_decided' | 'expense_comment' | 'expense_paid',
  data: Record<string, unknown>,
) {
  if (userId === actorId) return
  const admin = createAdminClient()
  await admin.from('notifications').insert({
    user_id: userId,
    actor_id: actorId,
    expense_request_id: requestId,
    type,
    data,
  })
}

export async function createExpenseRequest(input: {
  title: string
  justification: string
  category: ExpenseCategory
  amount: number
  needed_by: string | null
  attachments: ExpenseAttachment[]
}) {
  const caller = await requireCaller()
  const title = input.title.trim()
  if (!title) throw new Error('Укажите, что нужно купить')
  if (!(input.amount >= 0)) throw new Error('Сумма указана неверно')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('expense_requests')
    .insert({
      requester_id: caller.id,
      title,
      justification: input.justification.trim() || null,
      category: input.category,
      amount: input.amount,
      // Отдел фиксируем на момент подачи: человек может перейти в другой
      department: caller.department,
      needed_by: input.needed_by,
      attachments: input.attachments,
      status: 'pending' as ExpenseStatus,
    })
    .select('id, number')
    .single()

  if (error) throw new Error(error.message)

  await logActivity(data.id, caller.id, 'created', null, null)
  await notifyApprovers(data.id, caller.id, title)
  revalidateTag('expenses', 'default')
  revalidatePath('/expenses')
  return data.number as string
}

export async function updateExpenseRequest(requestId: string, input: {
  title: string
  justification: string
  category: ExpenseCategory
  amount: number
  needed_by: string | null
  attachments: ExpenseAttachment[]
}) {
  const caller = await requireCaller()
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('expense_requests')
    .select('requester_id, status, amount')
    .eq('id', requestId)
    .maybeSingle()
  if (!current) throw new Error('Заявка не найдена')

  const isOwner = current.requester_id === caller.id
  const editableByOwner = current.status === 'pending' || current.status === 'needs_info'
  if (!caller.canApprove && !(isOwner && editableByOwner)) {
    throw new Error('Заявку уже нельзя менять')
  }

  const { error } = await admin
    .from('expense_requests')
    .update({
      title: input.title.trim(),
      justification: input.justification.trim() || null,
      category: input.category,
      amount: input.amount,
      needed_by: input.needed_by,
      attachments: input.attachments,
    })
    .eq('id', requestId)
  if (error) throw new Error(error.message)

  const oldAmount = Number(current.amount)
  if (oldAmount !== input.amount) {
    await logActivity(requestId, caller.id, 'edited', String(oldAmount), String(input.amount))
  } else {
    await logActivity(requestId, caller.id, 'edited', null, null)
  }
  revalidateTag('expenses', 'default')
  revalidatePath('/expenses')
}

/** Решение по заявке. Принимает любой из утверждающих в одиночку. */
export async function decideExpenseRequest(
  requestId: string,
  status: Extract<ExpenseStatus, 'approved' | 'rejected' | 'needs_info'>,
  note: string,
) {
  const caller = await requireApprover()
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('expense_requests')
    .select('status, requester_id, title, number')
    .eq('id', requestId)
    .maybeSingle()
  if (!current) throw new Error('Заявка не найдена')

  const { error } = await admin
    .from('expense_requests')
    .update({
      status,
      decided_by: caller.id,
      decided_at: new Date().toISOString(),
      decision_note: note.trim() || null,
    })
    .eq('id', requestId)
  if (error) throw new Error(error.message)

  await logActivity(requestId, caller.id, 'status_changed', current.status, status)
  await notifyUser(current.requester_id, caller.id, requestId, 'expense_decided', {
    title: current.title,
    number: current.number,
    status,
  })
  revalidateTag('expenses', 'default')
  revalidatePath('/expenses')
}

/** Решение сразу по нескольким заявкам — для еженедельного разбора накопившегося. */
export async function decideExpenseRequests(
  requestIds: string[],
  status: Extract<ExpenseStatus, 'approved' | 'rejected'>,
  note: string,
) {
  await requireApprover()
  for (const id of requestIds) {
    await decideExpenseRequest(id, status, note)
  }
}

/** Автор может отозвать свою заявку, пока по ней нет решения. */
export async function cancelExpenseRequest(requestId: string) {
  const caller = await requireCaller()
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('expense_requests')
    .select('requester_id, status')
    .eq('id', requestId)
    .maybeSingle()
  if (!current) throw new Error('Заявка не найдена')
  if (current.requester_id !== caller.id && !caller.canApprove) throw new Error('Это не ваша заявка')
  if (current.status !== 'pending' && current.status !== 'needs_info') {
    throw new Error('По заявке уже есть решение')
  }

  const { error } = await admin
    .from('expense_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
  if (error) throw new Error(error.message)

  await logActivity(requestId, caller.id, 'status_changed', current.status, 'cancelled')
  revalidateTag('expenses', 'default')
  revalidatePath('/expenses')
}

/** Отметка об оплате — следующий шаг после одобрения, поэтому статус не меняется. */
export async function markExpensePaid(requestId: string, paidAmount: number, note: string) {
  const caller = await requireApprover()
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('expense_requests')
    .select('status, requester_id, title, number, amount')
    .eq('id', requestId)
    .maybeSingle()
  if (!current) throw new Error('Заявка не найдена')
  if (current.status !== 'approved') throw new Error('Оплатить можно только одобренную заявку')

  const amount = paidAmount >= 0 ? paidAmount : Number(current.amount)
  const { error } = await admin
    .from('expense_requests')
    .update({
      paid_at: new Date().toISOString(),
      paid_by: caller.id,
      paid_amount: amount,
      paid_note: note.trim() || null,
    })
    .eq('id', requestId)
  if (error) throw new Error(error.message)

  await logActivity(requestId, caller.id, 'paid', null, String(amount))
  await notifyUser(current.requester_id, caller.id, requestId, 'expense_paid', {
    title: current.title,
    number: current.number,
    amount,
  })
  revalidateTag('expenses', 'default')
  revalidatePath('/expenses')
}

export async function undoExpensePaid(requestId: string) {
  const caller = await requireApprover()
  const admin = createAdminClient()
  const { error } = await admin
    .from('expense_requests')
    .update({ paid_at: null, paid_by: null, paid_amount: null, paid_note: null })
    .eq('id', requestId)
  if (error) throw new Error(error.message)
  await logActivity(requestId, caller.id, 'payment_undone', null, null)
  revalidateTag('expenses', 'default')
  revalidatePath('/expenses')
}

export async function fetchExpenseFeed(requestId: string) {
  const caller = await requireCaller()
  const admin = createAdminClient()

  const { data: request } = await admin
    .from('expense_requests')
    .select('requester_id')
    .eq('id', requestId)
    .maybeSingle()
  if (!request) throw new Error('Заявка не найдена')
  if (request.requester_id !== caller.id && !caller.canApprove) throw new Error('Нет доступа к заявке')

  return getExpenseFeed(requestId)
}

export async function createExpenseComment(requestId: string, text: string, attachments: ExpenseAttachment[]) {
  const caller = await requireCaller()
  const trimmed = text.trim()
  if (!trimmed && attachments.length === 0) throw new Error('Пустой комментарий')

  const admin = createAdminClient()
  const { data: request } = await admin
    .from('expense_requests')
    .select('requester_id, title, number')
    .eq('id', requestId)
    .maybeSingle()
  if (!request) throw new Error('Заявка не найдена')
  if (request.requester_id !== caller.id && !caller.canApprove) throw new Error('Нет доступа к заявке')

  const { error } = await admin.from('expense_request_comments').insert({
    request_id: requestId,
    author_id: caller.id,
    text: trimmed,
    attachments,
  })
  if (error) throw new Error(error.message)

  // Автору пишут утверждающие и наоборот — уведомляем вторую сторону
  if (caller.id === request.requester_id) {
    const { data: approvers } = await admin
      .from('profiles')
      .select('id')
      .eq('status', 'active')
      .or('role.eq.admin,can_approve_expenses.eq.true')
    for (const p of (approvers ?? []) as { id: string }[]) {
      await notifyUser(p.id, caller.id, requestId, 'expense_comment', {
        title: request.title,
        number: request.number,
      })
    }
  } else {
    await notifyUser(request.requester_id, caller.id, requestId, 'expense_comment', {
      title: request.title,
      number: request.number,
    })
  }

  revalidateTag('expenses', 'default')
  revalidatePath('/expenses')
}

export async function uploadExpenseAttachment(formData: FormData): Promise<ExpenseAttachment> {
  await requireCaller()
  const file = formData.get('file') as File
  if (!file) throw new Error('Файл не передан')

  const admin = createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'bin'
  const path = `expenses/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await admin.storage
    .from('task-attachments')
    .upload(path, buffer, { contentType: file.type || 'application/octet-stream' })
  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = admin.storage.from('task-attachments').getPublicUrl(path)
  return { url: publicUrl, name: file.name, size: file.size }
}
