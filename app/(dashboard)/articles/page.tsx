import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getArticlesFor } from '@/lib/queries/articles'
import ArticlesClient from '@/components/articles/articles-client'

export default async function ArticlesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, department')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin'
  const articles = await getArticlesFor(profile.id, isAdmin, profile.department ?? null).catch(() => [])

  // Список отделов — для адресной публикации
  const admin = createAdminClient()
  const { data: people } = await admin.from('profiles').select('department').eq('status', 'active')
  const departments = [...new Set((people ?? [])
    .map((p: { department: string | null }) => p.department)
    .filter((d): d is string => !!d && d.trim() !== ''))].sort((a, b) => a.localeCompare(b))

  return (
    <ArticlesClient
      articles={articles}
      isAdmin={isAdmin}
      departments={departments}
      currentUserId={profile.id}
    />
  )
}
