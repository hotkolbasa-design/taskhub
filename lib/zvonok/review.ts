// Разбор звонка хантера по скрипту v2: что сказано правильно, что нет и как можно было сказать.
// Делается Claude при первом открытии расшифровки (/api/zvonok?review=1) и хранится в call_reviews —
// повторное открытие не стоит денег. Ключ — app_settings.anthropic_api_key (общий с подсказчиком).
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiKey } from '@/lib/podskazchik/ai'
import { loadBaza } from '@/lib/podskazchik/baza'

export type Turn = { role: string; start: number; text: string }
export type Call = { turns: Turn[]; staff: string; staffRole: string; when: string; lang: string; durationSec: number }

const Review = z.object({
  itog: z.string(),
  ball: z.number(),
  silno: z.string(),
  glavnoe: z.string(),
  repliki: z.array(z.object({
    i: z.number(),
    ocenka: z.enum(['хорошо', 'можно лучше', 'ошибка']),
    pochemu: z.string(),
    kak_luchshe: z.string(),
  })),
})
export type ReviewT = z.infer<typeof Review>

const MODEL = 'claude-opus-5-5'

const RULES = `Правила скрипта хантера Globalos (цель звонка — запись на бесплатную онлайн-консультацию к эксперту сегодня или завтра):
1. Сначала мотив, потом рассказ. Мотив уточнить 2–3 вопросами («удобно» — не мотив). Хантер говорит не больше 60 % времени.
2. Пять вопросов: мотив; кто решает (позвать на консультацию); с какой четверти; какие школы смотрят; класс, язык, город, страна.
3. Презентация — 2–3 пункта под мотив родителя, не монолог.
4. Цена одной фразой: «С сопровождением — 160 000 в месяц, самостоятельно — 130 000» + подарок по акции, затем пауза. Нельзя: вилки, «итоговая», годовые суммы, самодельные скидки, «от 120/180».
5. На «дорого» и «подумаю» не прощаться: один вопрос «что смущает / с чем сравниваете», один довод, возврат к записи.
6. Запись — выбор из двух-трёх времён на сегодня или завтра, не «когда вам удобно?». Попросить написать любое слово в WhatsApp, пока на линии. Повторить дату, ребёнок нужен на консультации.
7. Итог — запись или конкретная дата перезвона. Фраза «будем ждать обратной связи» запрещена.
8. Честно: 10 платежей в год, в 1–2 классе рядом нужен взрослый, психолога нет, про СОЧ — «зависит от школы-партнёра, скажет эксперт».
9. Globalos — платформа дистанционного обучения со школами-партнёрами, не «онлайн-школа». Уроки с ментором называются «уроки с менторами по видеозвонку».
10. Записывать к эксперту только тех, кто переходит в ближайшие 3 месяца. Позже (следующий учебный год, 4-я четверть, «через полгода», первый класс в следующем году) — не записывать и не уговаривать: «к эксперту пока рано, консультацию проводим ближе к переходу», перезвон за 3 месяца до их срока. Запись такого клиента или уговоры — ошибка; вежливый отказ с датой перезвона — хорошо.`

export async function getCachedReview(callId: string): Promise<ReviewT | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('call_reviews').select('review').eq('call_id', callId).maybeSingle()
  return (data?.review as ReviewT | undefined) ?? null
}

export async function makeReview(callId: string, call: Call): Promise<ReviewT | { error: string }> {
  const cached = await getCachedReview(callId)
  if (cached) return cached

  const key = await aiKey().catch(() => null)
  if (!key) return { error: 'Разбор включится, когда будет подключён ключ ИИ.' }
  if (!call.turns.some(t => t.role !== 'client')) return { error: 'В звонке нет реплик сотрудника — разбирать нечего.' }

  const baza = await loadBaza().catch(() => null)
  const extra = baza
    ? `\nЗапрещено обещать:\n${baza.zaprety.map(z => '- ' + z).join('\n')}\nАкция: ${baza.nastroyki['акция_ru'] ?? 'нет'} (до ${baza.nastroyki['акция_до'] ?? '—'}).`
    : ''
  const kz = /каз|kk/i.test(call.lang)

  const system = [
    'Ты — РОП отдела продаж Globalos и разбираешь звонок хантера по скрипту. Будь конкретным и справедливым:',
    'хвали то, что сделано по скрипту, и показывай, что сказать вместо ошибки.',
    RULES + extra,
    '',
    'Оцени реплики сотрудника (роль не «client»), которые что-то значат для продажи; «алло», «да», «угу» пропускай.',
    'i — номер реплики из расшифровки. ocenka: «хорошо» — по скрипту; «можно лучше» — не ошибка, но слабее скрипта;',
    '«ошибка» — нарушение правила, запрещённая фраза, упущенная запись. pochemu — одно короткое предложение, со ссылкой на правило.',
    `kak_luchshe — готовая фраза, которую хантер мог сказать вместо этой (для «хорошо» — пустая строка), ${kz ? 'на казахском, на «Сіз»' : 'на русском'}.`,
    'itog — 1–2 предложения: чем кончился звонок и почему. ball — от 0 до 10 по соблюдению скрипта.',
    'silno — что получилось лучше всего, одно предложение. glavnoe — один навык, который стоит отработать, одно предложение.',
    'Все пояснения (itog, silno, glavnoe, pochemu) — по-русски.',
  ].join('\n')

  const text = call.turns.map((t, i) => `${i} [${t.role === 'client' ? 'клиент' : 'сотрудник'}] ${t.text}`).join('\n')
  const client = new Anthropic({ apiKey: key, timeout: 110_000, maxRetries: 1 })
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: 'medium', format: zodOutputFormat(Review) },
    system,
    messages: [{ role: 'user', content: `Звонок: ${call.staff} (${call.staffRole}), ${call.when}, ${call.lang}, ${call.durationSec} с.\n\n${text}` }],
  })
  if (res.stop_reason === 'refusal' || !res.parsed_output) return { error: 'ИИ не смог разобрать этот звонок.' }

  const review = res.parsed_output
  review.repliki = review.repliki.filter(r => call.turns[r.i] && call.turns[r.i].role !== 'client')
  await createAdminClient().from('call_reviews').upsert({ call_id: callId, review, model: MODEL })
  return review
}
