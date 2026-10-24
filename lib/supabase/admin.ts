import { createClient } from '@supabase/supabase-js'
import { demoReadOnlyOptions } from '@/lib/demo/read-only-server'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      // на демо-сайте запись отбивается (lib/demo/read-only.ts), на проде пусто
      ...demoReadOnlyOptions(),
    }
  )
}

/**
 * Сервисный клиент без защиты демо. Только для app/api/demo/enter/route.ts: вернуть пароль общей
 * демо-учётки, если его всё-таки сменили. Больше нигде не использовать.
 */
export function createUnguardedAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
