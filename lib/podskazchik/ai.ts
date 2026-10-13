// Вторая ступень подсказчика: хантер вводит фразу клиента своими словами, Claude выбирает
// подходящую карточку базы или, если такой нет, собирает короткий ответ по правилам скрипта.
// Ключ — в app_settings.anthropic_api_key (как вебхук Битрикса); нет ключа — ступень выключена.
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Baza } from './baza'

let keyCache: { at: number; key: string | null } | null = null

export async function aiKey(): Promise<string | null> {
  if (keyCache && Date.now() - keyCache.at < 300_000) return keyCache.key
  const admin = createAdminClient()
  const { data } = await admin.from('app_settings').select('value').eq('key', 'anthropic_api_key').maybeSingle()
  keyCache = { at: Date.now(), key: (data?.value as string | undefined) || null }
  return keyCache.key
}

const Answer = z.object({
  id: z.string(),
  fraza: z.string(),
  ton: z.string(),
})

type Card = { id: string; nazv: string; korotko_ru: string; frazy_ru: string[] }

export async function aiAnswer(baza: Baza, said: string, lang: 'ru' | 'kz', key: string) {
  const cards = (baza.kartochki as Card[])
    .map(c => `${c.id} | ${c.nazv} | клиент говорит: ${c.frazy_ru.slice(0, 4).join('; ')} | ответ: ${c.korotko_ru}`)
    .join('\n')
  const system = [
    'Ты помогаешь хантеру Globalos во время живого звонка родителю. Globalos — платформа дистанционного обучения:',
    'ребёнка зачисляют в лицензированную частную школу-партнёр в Казахстане, учится он на платформе. Не называй Globalos онлайн-школой.',
    'Ниже карточки базы ответов (id | ситуация | как говорит клиент | что ответить). Выбери карточку, которая отвечает на фразу клиента,',
    'и верни её id. Если ни одна не подходит — id "none" и составь ответ сам.',
    'fraza — одна-две короткие фразы, которые хантер скажет вслух прямо сейчас; если карточка подошла — её ответ, подстроенный под слова клиента.',
    'Последней фразой, где уместно, — вернуть к записи на консультацию с выбором из двух времён.',
    'ton — 3–6 слов, каким тоном говорить.',
    `Язык fraza: ${lang === 'kz' ? 'казахский, обращение на «Сіз», живая разговорная речь' : 'русский'}. ton — по-русски.`,
    'Нельзя обещать ничего из этого списка:',
    baza.zaprety.map(z => `- ${z}`).join('\n'),
    `Текущая акция: ${baza.nastroyki['акция_ru'] ?? 'нет'} (действует до ${baza.nastroyki['акция_до'] ?? '—'}).`,
    'Если ответа на вопрос в базе и в правилах нет — не выдумывай факты, а предложи уточнить у эксперта и перезвонить через 15 минут.',
    '',
    cards,
  ].join('\n')

  const client = new Anthropic({ apiKey: key, timeout: 20_000, maxRetries: 1 })
  const res = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 1024,
    output_config: { effort: 'low', format: zodOutputFormat(Answer) },
    system,
    messages: [{ role: 'user', content: `Клиент сказал: «${said.slice(0, 500)}»` }],
  })
  if (res.stop_reason === 'refusal' || !res.parsed_output) return null
  return res.parsed_output
}
