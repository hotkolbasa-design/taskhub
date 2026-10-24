import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { demoReadOnlyOptions } from '@/lib/demo/read-only-server'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot set cookies — safe to ignore
          }
        },
      },
      // на демо-сайте запись отбивается (lib/demo/read-only.ts), на проде пусто
      ...demoReadOnlyOptions(),
    }
  )
}
