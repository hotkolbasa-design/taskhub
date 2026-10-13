import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'

const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/auth']

export async function proxy(request: NextRequest) {
  const { supabase, response } = await createClient(request)

  const pathname = request.nextUrl.pathname
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  if (!isPublicRoute) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Вернуть на подсказчик после входа — хантеры держат эту ссылку в закладках
        const next = pathname === '/podskazchik' ? '?next=/podskazchik' : ''
        return NextResponse.redirect(new URL('/login' + next, request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
