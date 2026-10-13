// Предложения хантеров по скрипту звонка: таблица script_suggestions, раздел /predlozheniya.
// Статус: new → approved / rejected → applied (внесено в базу подсказчика).
import { createAdminClient } from '@/lib/supabase/admin'
import { STATUS_LABEL, type Suggestion } from './predlozheniya-types'

export { STATUS_LABEL, type Suggestion, type SuggestionStatus } from './predlozheniya-types'

export async function addSuggestion(f: {
  authorId: string | null; authorName: string; gde: string; pole: string; lang: 'ru' | 'kz'; frag: string; variant: string; comment: string
}): Promise<number> {
  const { data, error } = await createAdminClient()
    .from('script_suggestions')
    .insert({
      author_id: f.authorId, author_name: f.authorName, gde: f.gde, pole: f.pole, lang: f.lang,
      frag: f.frag, variant: f.variant, comment: f.comment,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as number
}

// Свои предложения: по аккаунту, а у входа по коду — по имени из листа «Хантеры»
export async function mySuggestions(who: { id?: string; name: string }) {
  let q = createAdminClient().from('script_suggestions').select('*').order('created_at', { ascending: false }).limit(50)
  q = who.id ? q.eq('author_id', who.id) : q.eq('author_name', who.name).is('author_id', null)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data as Suggestion[]).map(s => ({
    n: s.id,
    time: new Date(s.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', hour12: false }).replace(',', ''),
    gde: s.gde, frag: s.frag, variant: s.variant, status: STATUS_LABEL[s.status], reshenie: s.decision,
  }))
}

export async function listSuggestions(): Promise<Suggestion[]> {
  const { data, error } = await createAdminClient()
    .from('script_suggestions').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) throw new Error(error.message)
  return data as Suggestion[]
}
