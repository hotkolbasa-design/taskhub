import { createClient } from '@/lib/supabase/server'
import type { ProjectWithMeta } from '@/types'

export async function getProjects(userId: string, isAdmin: boolean): Promise<ProjectWithMeta[]> {
  const supabase = await createClient()

  if (isAdmin) {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_members!inner(role, user_id),
        member_count:project_members(count)
      `)
      .order('created_at', { ascending: false })

    if (error) return []

    return (data ?? []).map((p: any) => ({
      ...p,
      my_role: p.project_members.find((m: any) => m.user_id === userId)?.role ?? 'viewer',
      member_count: p.member_count[0]?.count ?? 0,
    }))
  }

  const { data, error } = await supabase
    .from('project_members')
    .select(`
      role,
      projects(
        *,
        member_count:project_members(count)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false, foreignTable: 'projects' })

  if (error) return []

  return (data ?? [])
    .filter((item: any) => item.projects)
    .map((item: any) => ({
      ...item.projects,
      my_role: item.role,
      member_count: item.projects.member_count[0]?.count ?? 0,
    }))
}
