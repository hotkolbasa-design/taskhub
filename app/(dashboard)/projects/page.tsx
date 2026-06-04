import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/lib/queries/projects'
import ProjectsClient from './projects-client'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'
  const projects = await getProjects(session.user.id, isAdmin)

  return <ProjectsClient projects={projects} />
}
