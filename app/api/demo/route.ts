import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isDemo } from '@/lib/demo/mode'
import { createUnguardedAdminClient } from '@/lib/supabase/admin'

// Вход в демо по одной ссылке — для работодателей из профилей и резюме: пароль нигде не публикуется.
// Работает только на демо-сайте (DEMO_MODE=1), на проде маршрута как будто нет.
export const dynamic = 'force-dynamic'

const DEMO_EMAIL = 'demo@taskhub.local'

export async function GET(request: NextRequest) {
  const password = process.env.DEMO_PASSWORD
  if (!isDemo() || !password) return new NextResponse('Not found', { status: 404 })

  const response = NextResponse.redirect(new URL('/dashboard', request.url))
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    }
  )

  let { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password })

  // Учётка общая: посетитель мог сменить в ней пароль — тогда остальные не войдут до пересборки.
  // Возвращаем пароль сервисным ключом демо-базы и пробуем ещё раз. Клиент — без защиты демо:
  // обычный createAdminClient на демо-сайте запись отбивает (lib/demo/read-only.ts).
  if (error) {
    const admin = createUnguardedAdminClient()
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const user = data?.users.find((u) => u.email === DEMO_EMAIL)
    if (user) {
      await admin.auth.admin.updateUserById(user.id, { password, ban_duration: 'none' })
      ;({ error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password }))
    }
  }

  if (error) return NextResponse.redirect(new URL('/login?reason=demo', request.url))
  return response
}
