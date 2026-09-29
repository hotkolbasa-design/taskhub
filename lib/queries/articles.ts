import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Article, ArticleReader, ExpensePerson } from '@/types'

const PERSON_FIELDS = 'id, full_name, login, avatar_url'

type RawArticle = Omit<Article, 'author' | 'is_read' | 'read_count'>

async function loadArticles(): Promise<RawArticle[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('articles')
    .select('*')
    .order('category')
    .order('title')
  if (error) throw new Error(error.message)
  return (data ?? []) as RawArticle[]
}

const cachedArticles = unstable_cache(loadArticles, ['articles-all'], { tags: ['articles'] })

/**
 * Список инструкций для конкретного человека: сотрудник видит опубликованные
 * плюс свои черновики, админ — всё. Отметка о прочтении привязана к версии,
 * поэтому после правки инструкция снова считается непрочитанной.
 */
export async function getArticlesFor(userId: string, isAdmin: boolean, department: string | null): Promise<Article[]> {
  const [rows, reads, people] = await Promise.all([
    cachedArticles(),
    readsOf(userId),
    peopleMap(),
  ])

  const counts = await readCounts()

  return rows
    .filter(a => {
      if (a.status !== 'published') return isAdmin || a.author_id === userId
      // Адресная инструкция: пустой список отделов — значит всем
      if (a.departments.length > 0 && !isAdmin) {
        return department ? a.departments.includes(department) : false
      }
      return true
    })
    .map(a => ({
      ...a,
      attachments: Array.isArray(a.attachments) ? a.attachments : [],
      author: a.author_id ? people.get(a.author_id) ?? null : null,
      is_read: reads.get(a.id) === a.version,
      read_count: counts.get(`${a.id}:${a.version}`) ?? 0,
    }))
}

export async function getArticle(id: string, userId: string): Promise<Article | null> {
  const [rows, reads, people, counts] = await Promise.all([cachedArticles(), readsOf(userId), peopleMap(), readCounts()])
  const a = rows.find(r => r.id === id)
  if (!a) return null
  return {
    ...a,
    attachments: Array.isArray(a.attachments) ? a.attachments : [],
    author: a.author_id ? people.get(a.author_id) ?? null : null,
    is_read: reads.get(a.id) === a.version,
    read_count: counts.get(`${a.id}:${a.version}`) ?? 0,
  }
}

async function readsOf(userId: string): Promise<Map<string, number>> {
  const admin = createAdminClient()
  const { data } = await admin.from('article_reads').select('article_id, version').eq('user_id', userId)
  const map = new Map<string, number>()
  for (const r of (data ?? []) as { article_id: string; version: number }[]) {
    const prev = map.get(r.article_id) ?? 0
    if (r.version > prev) map.set(r.article_id, r.version)
  }
  return map
}

async function readCounts(): Promise<Map<string, number>> {
  const admin = createAdminClient()
  const { data } = await admin.from('article_reads').select('article_id, version')
  const map = new Map<string, number>()
  for (const r of (data ?? []) as { article_id: string; version: number }[]) {
    const key = `${r.article_id}:${r.version}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

function peopleMap(): Promise<Map<string, ExpensePerson>> {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()
      const { data } = await admin.from('profiles').select(PERSON_FIELDS)
      return (data ?? []) as ExpensePerson[]
    },
    ['articles-people'],
    { tags: ['profiles'] },
  )().then(list => new Map(list.map(p => [p.id, p])))
}

/** Кто ознакомился с текущей версией, а кто нет — для обязательных инструкций. */
export async function getArticleReaders(articleId: string): Promise<{ version: number; readers: ArticleReader[] }> {
  const admin = createAdminClient()

  const { data: article } = await admin.from('articles').select('version, departments').eq('id', articleId).maybeSingle()
  const version = article?.version ?? 1
  const departments = (article?.departments ?? []) as string[]

  let q = admin.from('profiles').select('id, full_name, login, department').eq('status', 'active')
  if (departments.length > 0) q = q.in('department', departments)
  const { data: people } = await q

  const { data: reads } = await admin
    .from('article_reads')
    .select('user_id, read_at')
    .eq('article_id', articleId)
    .eq('version', version)

  const readMap = new Map((reads ?? []).map((r: { user_id: string; read_at: string }) => [r.user_id, r.read_at]))

  const readers: ArticleReader[] = ((people ?? []) as { id: string; full_name: string | null; login: string; department: string | null }[])
    .map(p => ({
      user_id: p.id,
      full_name: p.full_name,
      login: p.login,
      department: p.department,
      read_at: readMap.get(p.id) ?? null,
    }))
    .sort((a, b) => (a.read_at ? 1 : 0) - (b.read_at ? 1 : 0))

  return { version, readers }
}
