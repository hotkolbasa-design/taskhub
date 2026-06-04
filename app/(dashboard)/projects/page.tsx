import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProjects } from '@/lib/queries/projects'
import ProjectsClient from './projects-client'
import { redirect } from 'next/navigation'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'
  const projects = await getProjects(session.user.id, isAdmin)

  return <ProjectsClient projects={projects} />
}
