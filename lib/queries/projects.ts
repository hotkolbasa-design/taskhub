import { createClient } from '@/lib/supabase/server'
import type { ProjectWithMeta } from '@/types'

export async function getProjects(userId: string, isAdmin: boolean): Promise<ProjectWithMeta[]> {
  const supabase = await createClient()

  // Получаем все проекты (для admin) или только свои
  const projectsQuery = isAdmin
    ? supabase.from('projects').select('*').order('created_at', { ascending: false })
    : supabase
        .from('projects')
        .select('*, project_members!inner(role)')
        .eq('project_members.user_id', userId)
        .order('created_at', { ascending: false })

  const { data: projects, error } = await projectsQuery
  if (error || !projects) return []

  if (projects.length === 0) return []

  const projectIds = projects.map((p: any) => p.id)

  // Получаем всех участников для подсчёта и своих ролей
  const { data: members } = await supabase
    .from('project_members')
    .select('project_id, user_id, role')
    .in('project_id', projectIds)

  const membersByProject: Record<string, { count: number; myRole: string }> = {}
  for (const m of members ?? []) {
    if (!membersByProject[m.project_id]) {
      membersByProject[m.project_id] = { count: 0, myRole: 'viewer' }
    }
    membersByProject[m.project_id].count++
    if (m.user_id === userId) {
      membersByProject[m.project_id].myRole = m.role
    }
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
    my_role: membersByProject[p.id]?.myRole ?? 'viewer',
    member_count: membersByProject[p.id]?.count ?? 0,
  }))
}
