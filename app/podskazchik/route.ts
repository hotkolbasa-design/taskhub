// Подсказчик хантера под аккаунтом TaskHub. Без входа proxy.ts уводит на /login?next=/podskazchik.
// Доступ — как к CRM (canAccessCrm): админы, маркетологи, отделы «Маркетинг» и «Отдел продаж».
// Страница самостоятельная (не в layout дашборда): хантер держит её во вкладке рядом с Битриксом.
import { createClient } from '@/lib/supabase/server'
import { canAccessCrm } from '@/lib/utils/crm-access'
import { getBaza, message, respond } from '@/lib/podskazchik/handler'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.redirect(new URL('/login?next=/podskazchik', req.url), 307)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, login, role, status, position, department')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || profile.status !== 'active' || !canAccessCrm(profile)) {
    return message('Подсказчик открыт отделу продаж и маркетингу. Попросите администратора указать в вашем профиле отдел «Отдел продаж».', 403)
  }

  const p = new URL(req.url).searchParams
  const baza = await getBaza(p.get('fresh') === '1')
  if (baza instanceof Response) return baza
  return respond(p, baza, { name: profile.full_name || profile.login || 'без имени', code: '' })
}
