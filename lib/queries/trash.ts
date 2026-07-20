import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export type TrashTask = {
  id: string
  title: string
  type: 'task' | 'epic'
  deleted_at: string | null
  project_id: string
  project_name: string
  project_color: string
  deleter_name: string | null
}

export function getTrashTasks(userId: string): Promise<TrashTask[]> {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()

      const { data: memberships } = await admin
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId)

      const projectIds = (memberships ?? []).map((m: any) => m.project_id)
      if (projectIds.length === 0) return []

      const { data: tasks } = await admin
        .from('tasks')
        .select(`
          id, title, type, deleted_at, project_id,
          project:projects!tasks_project_id_fkey(name, color),
          deleter:profiles!tasks_deleted_by_fkey(full_name, login)
        `)
        .eq('status', 'deleted')
        .in('project_id', projectIds)
        .order('deleted_at', { ascending: false, nullsFirst: false })

      return (tasks ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        deleted_at: t.deleted_at,
        project_id: t.project_id,
        project_name: t.project?.name ?? '',
        project_color: t.project?.color ?? '#8892A4',
        deleter_name: t.deleter?.full_name || t.deleter?.login || null,
      }))
    },
    [`trash-${userId}`],
    { tags: ['trash'] },
  )()
}
