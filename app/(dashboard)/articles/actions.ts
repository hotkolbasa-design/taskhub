'use server'

import { revalidateTag, revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotifications } from '@/lib/notifications'
import { getArticleReaders } from '@/lib/queries/articles'
import type { ArticleCategory, ArticleStatus, ExpenseAttachment } from '@/types'

type Caller = { id: string; isAdmin: boolean; department: string | null }

async function requireCaller(): Promise<Caller> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Не авторизован')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, department')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) throw new Error('Не авторизован')

  return { id: profile.id, isAdmin: profile.role === 'admin', department: profile.department ?? null }
}

function refresh() {
  revalidateTag('articles', 'default')
  revalidatePath('/articles')
}

export async function createArticle(input: {
  title: string
  summary: string
  content: string
  category: ArticleCategory
}) {
  const caller = await requireCaller()
  if (!input.title.trim()) throw new Error('Нужен заголовок')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('articles')
    .insert({
      title: input.title.trim(),
      summary: input.summary.trim() || null,
      content: input.content,
      category: input.category,
      status: 'draft' as ArticleStatus,
      author_id: caller.id,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  refresh()
  return data.id as string
}

export async function updateArticle(id: string, input: {
  title: string
  summary: string
  content: string
  category: ArticleCategory
  is_required?: boolean
  departments?: string[]
  /** Смысловая правка: поднимаем версию, и людей просят перечитать */
  bump_version?: boolean
}) {
  const caller = await requireCaller()
  const admin = createAdminClient()

  const { data: current } = await admin
    .from('articles')
    .select('author_id, status, version, title')
    .eq('id', id)
    .maybeSingle()
  if (!current) throw new Error('Инструкция не найдена')

  const isOwner = current.author_id === caller.id
  if (!caller.isAdmin && !(isOwner && current.status !== 'published')) {
    throw new Error('Опубликованную инструкцию правит только админ')
  }

  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    summary: input.summary.trim() || null,
    content: input.content,
    category: input.category,
  }
  if (caller.isAdmin) {
    if (input.is_required !== undefined) patch.is_required = input.is_required
    if (input.departments !== undefined) patch.departments = input.departments
  }

  const bumped = input.bump_version && current.status === 'published'
  if (bumped) patch.version = current.version + 1

  const { error } = await admin.from('articles').update(patch).eq('id', id)
  if (error) throw new Error(error.message)

  // Версия выросла — прежние отметки об ознакомлении больше не в счёт, сообщаем людям
  if (bumped) await notifyAudience(id, caller.id, 'article_updated', input.title.trim())

  refresh()
}

/** Автор отдаёт черновик на проверку — публикует уже админ. */
export async function submitArticle(id: string) {
  const caller = await requireCaller()
  const admin = createAdminClient()
  const { data: current } = await admin.from('articles').select('author_id, title').eq('id', id).maybeSingle()
  if (!current) throw new Error('Инструкция не найдена')
  if (current.author_id !== caller.id && !caller.isAdmin) throw new Error('Это не ваша инструкция')

  const { error } = await admin.from('articles').update({ status: 'review' }).eq('id', id)
  if (error) throw new Error(error.message)

  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin').eq('status', 'active')
  await createNotifications(
    (admins ?? [])
      .map((p: { id: string }) => p.id)
      .filter(uid => uid !== caller.id)
      .map(uid => ({
        user_id: uid,
        actor_id: caller.id,
        article_id: id,
        type: 'article_published' as const,
        data: { title: current.title, review: true },
      })),
  )
  refresh()
}

export async function publishArticle(id: string) {
  const caller = await requireCaller()
  if (!caller.isAdmin) throw new Error('Публикует только админ')

  const admin = createAdminClient()
  const { data: current } = await admin.from('articles').select('title, status').eq('id', id).maybeSingle()
  if (!current) throw new Error('Инструкция не найдена')

  const { error } = await admin
    .from('articles')
    .update({ status: 'published', published_by: caller.id, published_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  await notifyAudience(id, caller.id, 'article_published', current.title)
  refresh()
}

export async function unpublishArticle(id: string) {
  const caller = await requireCaller()
  if (!caller.isAdmin) throw new Error('Снимает с публикации только админ')
  const admin = createAdminClient()
  const { error } = await admin.from('articles').update({ status: 'draft' }).eq('id', id)
  if (error) throw new Error(error.message)
  refresh()
}

export async function deleteArticle(id: string) {
  const caller = await requireCaller()
  const admin = createAdminClient()
  const { data: current } = await admin.from('articles').select('author_id, status').eq('id', id).maybeSingle()
  if (!current) return
  const isOwner = current.author_id === caller.id
  if (!caller.isAdmin && !(isOwner && current.status === 'draft')) {
    throw new Error('Удалить может автор в черновике или админ')
  }
  const { error } = await admin.from('articles').delete().eq('id', id)
  if (error) throw new Error(error.message)
  refresh()
}

/** Отметка «прочитал» — на конкретную версию, чтобы после правки её просили заново. */
export async function markArticleRead(id: string) {
  const caller = await requireCaller()
  const admin = createAdminClient()

  const { data: article } = await admin.from('articles').select('version').eq('id', id).maybeSingle()
  if (!article) throw new Error('Инструкция не найдена')

  const { error } = await admin
    .from('article_reads')
    .upsert(
      { article_id: id, user_id: caller.id, version: article.version },
      { onConflict: 'article_id,user_id,version' },
    )
  if (error) throw new Error(error.message)
  refresh()
}

export async function fetchArticleReaders(id: string) {
  const caller = await requireCaller()
  if (!caller.isAdmin) throw new Error('Нет доступа')
  return getArticleReaders(id)
}

export async function uploadArticleAttachment(formData: FormData): Promise<ExpenseAttachment> {
  await requireCaller()
  const file = formData.get('file') as File
  if (!file) throw new Error('Файл не передан')

  const admin = createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'bin'
  const path = `articles/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await admin.storage
    .from('task-attachments')
    .upload(path, buffer, { contentType: file.type || 'application/octet-stream' })
  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = admin.storage.from('task-attachments').getPublicUrl(path)
  return { url: publicUrl, name: file.name, size: file.size }
}

async function notifyAudience(
  articleId: string,
  actorId: string,
  type: 'article_published' | 'article_updated',
  title: string,
) {
  const admin = createAdminClient()
  const { data: article } = await admin.from('articles').select('departments, is_required').eq('id', articleId).maybeSingle()
  if (!article) return

  let q = admin.from('profiles').select('id').eq('status', 'active')
  const departments = (article.departments ?? []) as string[]
  if (departments.length > 0) q = q.in('department', departments)
  const { data: people } = await q

  await createNotifications(
    (people ?? [])
      .map((p: { id: string }) => p.id)
      .filter(uid => uid !== actorId)
      .map(uid => ({
        user_id: uid,
        actor_id: actorId,
        article_id: articleId,
        type,
        data: { title, required: article.is_required },
      })),
  )
}
