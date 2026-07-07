import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotifications, buildRecipients } from '@/lib/notifications'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const results: Record<string, number> = { sprints_fixed: 0, deadline_soon: 0, deadline_overdue: 0 }

  // ── 1. Авто-фиксация спринтов старше 24 часов ──
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: sprints } = await admin
    .from('sprints')
    .select('id, project_id')
    .eq('status', 'active')
    .eq('is_fixed', false)
    .lt('created_at', cutoff)

  for (const sprint of sprints ?? []) {
    const { data: tasks } = await admin
      .from('tasks')
      .select('id')
      .eq('sprint_id', sprint.id)
      .eq('status', 'sprint')

    const taskIds = (tasks ?? []).map(t => t.id)
    await admin.from('sprints').update({
      is_fixed: true,
      fixed_at: new Date().toISOString(),
      fixed_task_ids: taskIds,
    }).eq('id', sprint.id)

    results.sprints_fixed++
  }

  // ── 2. Уведомления о дедлайнах ──
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayStr = today.toISOString().slice(0, 10)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  // Задачи с дедлайном завтра (ещё не уведомляли сегодня)
  const { data: soonTasks } = await admin
    .from('tasks')
    .select('id, title, creator_id, assignee_id')
    .eq('deadline', tomorrowStr)
    .in('status', ['backlog', 'sprint'])
    .neq('workflow_status', 'done')
    .neq('workflow_status', 'cancelled')

  for (const task of soonTasks ?? []) {
    const recipients = buildRecipients({ actorId: null, creatorId: task.creator_id ?? null, assigneeId: task.assignee_id ?? null })

    // Проверяем, не посылали ли уже сегодня такое уведомление
    const { data: existing } = await admin
      .from('notifications')
      .select('id')
      .eq('task_id', task.id)
      .eq('type', 'deadline_soon')
      .gte('created_at', todayStr)
      .limit(1)

    if (!existing || existing.length === 0) {
      await createNotifications(recipients.map(uid => ({
        user_id: uid,
        task_id: task.id,
        type: 'deadline_soon' as const,
        data: { task_title: task.title },
      })))
      results.deadline_soon += recipients.length
    }
  }

  // Просроченные задачи (дедлайн = сегодня или раньше)
  const { data: overdueTasks } = await admin
    .from('tasks')
    .select('id, title, creator_id, assignee_id')
    .lte('deadline', todayStr)
    .in('status', ['backlog', 'sprint'])
    .neq('workflow_status', 'done')
    .neq('workflow_status', 'cancelled')
    .not('deadline', 'is', null)

  for (const task of overdueTasks ?? []) {
    const recipients = buildRecipients({ actorId: null, creatorId: task.creator_id ?? null, assigneeId: task.assignee_id ?? null })

    const { data: existing } = await admin
      .from('notifications')
      .select('id')
      .eq('task_id', task.id)
      .eq('type', 'deadline_overdue')
      .gte('created_at', todayStr)
      .limit(1)

    if (!existing || existing.length === 0) {
      await createNotifications(recipients.map(uid => ({
        user_id: uid,
        task_id: task.id,
        type: 'deadline_overdue' as const,
        data: { task_title: task.title },
      })))
      results.deadline_overdue += recipients.length
    }
  }

  return NextResponse.json(results)
}
