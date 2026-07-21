import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/revalidate  { tag: "members-uuid" }
// Only accessible to admins.
export async function POST(req: NextRequest) {
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
