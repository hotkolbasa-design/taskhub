import { createBrowserClient } from '@supabase/ssr'
import { DEMO_READ_ONLY_BROWSER, notifyDemoBlocked, readOnlyFetch } from '@/lib/demo/read-only'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // демо-сайт: регистрация, смена пароля, загрузка файлов и прочая запись отбиваются
    DEMO_READ_ONLY_BROWSER ? { global: { fetch: readOnlyFetch(notifyDemoBlocked) } } : undefined
  )
}
