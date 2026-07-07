import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Находим активные спринты без фиксации, созданные более 24 часов назад
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: sprints, error } = await admin
    .from('sprints')
    .select('id, project_id')
    .eq('status', 'active')
    .eq('is_fixed', false)
    .lt('created_at', cutoff)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: { sprintId: string; taskCount: number }[] = []

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

    results.push({ sprintId: sprint.id, taskCount: taskIds.length })
  }

  return NextResponse.json({ fixed: results.length, details: results })
}
