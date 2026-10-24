import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/revalidate  { tag: "members-uuid" } или { tags: [...] }
// Админ из браузера или скрипт с Authorization: Bearer <CRON_SECRET> — так демо-копия сбрасывает
// кэш после еженедельной пересборки базы (scripts/demo-sync.py): unstable_cache сам не протухает.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') === `Bearer ${secret}`) {
    const { tags } = await req.json()
    if (!Array.isArray(tags) || !tags.every(t => typeof t === 'string')) {
      return NextResponse.json({ error: 'tags required' }, { status: 400 })
    }
    for (const t of tags) revalidateTag(t, 'default')
    revalidatePath('/', 'layout')
    return NextResponse.json({ revalidated: tags.length })
  }

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { tag } = await req.json()
  if (!tag || typeof tag !== 'string') return NextResponse.json({ error: 'tag required' }, { status: 400 })

  revalidateTag(tag, 'default')
  return NextResponse.json({ revalidated: tag })
}
