import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getArticle } from '@/lib/queries/articles'
import ArticleView from '@/components/articles/article-view'

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
  const article = await getArticle(id, profile.id)
  if (!article) notFound()

  // Черновик виден только автору и админам
  if (article.status !== 'published' && !isAdmin && article.author_id !== profile.id) notFound()

  const admin = createAdminClient()
  const { data: people } = await admin.from('profiles').select('department').eq('status', 'active')
  const departments = [...new Set((people ?? [])
    .map((p: { department: string | null }) => p.department)
    .filter((d): d is string => !!d && d.trim() !== ''))].sort((a, b) => a.localeCompare(b))

  return (
    <ArticleView
      article={article}
      isAdmin={isAdmin}
      currentUserId={profile.id}
      departments={departments}
    />
  )
}
