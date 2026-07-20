import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProjectWithMeta } from '@/types'

export function getProjects(userId: string, isAdmin: boolean): Promise<ProjectWithMeta[]> {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()

      let projectIds: string[] = []
      const roleMap: Record<string, string> = {}

      if (isAdmin) {
        const { data: all } = await admin.from('projects').select('id')
        projectIds = (all ?? []).map((p: any) => p.id)
      } else {
        const { data: memberships } = await admin
          .from('project_members')
          .select('project_id, role')
          .eq('user_id', userId)

        for (const m of memberships ?? []) {
          projectIds.push(m.project_id)
          roleMap[m.project_id] = m.role
        }
      }

      if (projectIds.length === 0) return []

      const { data: projects, error } = await admin
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .order('created_at', { ascending: false })

      if (error || !projects) return []

      const { data: members } = await admin
        .from('project_members')
        .select('project_id, user_id, role')
        .in('project_id', projectIds)

      const countMap: Record<string, number> = {}
      for (const m of members ?? []) {
        countMap[m.project_id] = (countMap[m.project_id] ?? 0) + 1
        if (m.user_id === userId) roleMap[m.project_id] = m.role
      }

      return projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        color: p.color,
        default_assignee_mode: p.default_assignee_mode,
        default_assignee_id: p.default_assignee_id,
        created_by: p.created_by,
        created_at: p.created_at,
        my_role: (roleMap[p.id] ?? 'viewer') as import('@/types').ProjectMemberRole,
        member_count: countMap[p.id] ?? 0,
      }))
    },
    [`projects-${userId}-${isAdmin}`],
    { tags: ['projects'] },
  )()
}
