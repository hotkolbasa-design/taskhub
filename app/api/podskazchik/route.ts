// Подсказчик хантера Globalos: скрипт звонка и ответы на возражения по личной ссылке ?h=<код>.
// Лежит в /api, потому что proxy.ts не требует входа для /api: у хантеров нет аккаунтов TaskHub,
// а страницы script.google.com ломаются в браузерах с несколькими аккаунтами Google.
// Коды хантеров — лист «Хантеры» таблицы базы. Журнал нажатий — лист «Журнал».
import { loadBaza, writeLog, type Baza } from '@/lib/podskazchik/baza'
import { aiAnswer, aiKey } from '@/lib/podskazchik/ai'
import { PAGE_HTML } from '@/lib/podskazchik/page'

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

function message(text: string, status: number) {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Подсказчик хантера</title><p style="font-family:sans-serif;padding:24px">${safe}</p>`,
    { status, headers: HTML_HEADERS },
  )
}

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

const almaty = () =>
  new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', hour12: false }).replace(',', '')

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  const code = (p.get('h') ?? '').trim()
  if (!/^[A-Za-z0-9]{6,32}$/.test(code)) return message('Откройте подсказчик по своей личной ссылке.', 400)

  let baza: Baza
  try {
    baza = await loadBaza(p.get('fresh') === '1')
  } catch {
    return message('База подсказчика временно недоступна, обновите страницу через минуту.', 502)
  }
  const hunter = baza.hunters.find(h => h.code === code)
  if (!hunter) return message('Ссылка не действует. Попросите у РОПа свою личную ссылку.', 403)

  const lang = p.get('lang') === 'kz' ? 'kz' : 'ru'

  const log = p.get('log')
  if (log) {
    try {
      await writeLog([almaty(), hunter.name, log.slice(0, 20), (p.get('id') ?? '').slice(0, 40), lang, (p.get('t') ?? '').slice(0, 300)])
    } catch { /* журнал не должен мешать звонку */ }
    return json({ ok: true })
  }

  const said = p.get('ai')
  if (said) {
    const key = await aiKey().catch(() => null)
    if (!key) return json({ ok: false, error: 'ИИ-подбор пока не подключён.' })
    try {
      const a = await aiAnswer(baza, said, lang, key)
      if (!a) return json({ ok: false, error: 'ИИ не смог подобрать ответ — воспользуйтесь кнопками.' })
      writeLog([almaty(), hunter.name, 'ai', a.id, lang, said.slice(0, 300)]).catch(() => {})
      return json({ ok: true, ...a })
    } catch {
      return json({ ok: false, error: 'ИИ сейчас не отвечает — воспользуйтесь кнопками.' })
    }
  }

  const ai = !!(await aiKey().catch(() => null))
  const { hunters: _hunters, ...data } = baza
  void _hunters
  const payload = JSON.stringify({ ...data, hunter, ai }).replace(/</g, '\\u003c')
  return new Response(PAGE_HTML.replace('/*DATA*/null/*END*/', payload), { status: 200, headers: HTML_HEADERS })
}
