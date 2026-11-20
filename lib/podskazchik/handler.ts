// Общая логика подсказчика для двух входов: /podskazchik (аккаунт TaskHub) и /api/podskazchik?h=<код>.
// Кто открыл — решает вызывающий маршрут; здесь только страница, журнал и ИИ-подбор.
import { loadBaza, writeLog, type Baza } from './baza'
import { addSuggestion, mySuggestions } from './predlozheniya'
import { aiAnswer, aiKey } from './ai'
import { applyEdit, EditError, type EditChange } from './redaktor'
import { PAGE_HTML } from './page'

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

export function message(text: string, status: number) {
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

export async function getBaza(fresh: boolean): Promise<Baza | Response> {
  try {
    return await loadBaza(fresh)
  } catch {
    return message('База подсказчика временно недоступна, обновите страницу через минуту.', 502)
  }
}

// who.code — код из ссылки (вход по коду) или '' (вход через аккаунт: страница шлёт запросы без h=)
// who.tester — админ TaskHub или вход «Тест»: видят скрипт v2, пока в «Настройках» скрипт_v2 = тест
// who.editor — может править тексты со страницы (только вход под аккаунтом, см. redaktor.ts)
export async function respond(p: URLSearchParams, baza: Baza, who: { name: string; code: string; id?: string; tester?: boolean; editor?: boolean }) {
  const lang = p.get('lang') === 'kz' ? 'kz' : 'ru'

  const log = p.get('log')
  if (log) {
    try {
      const ver = p.get('v') === '2' ? ' v2' : ''
      await writeLog([almaty(), who.name, log.slice(0, 20), (p.get('id') ?? '').slice(0, 40), lang + ver, (p.get('t') ?? '').slice(0, 300)])
    } catch { /* журнал не должен мешать звонку */ }
    return json({ ok: true })
  }

  if (p.get('mine') === '1') {
    try {
      return json({ ok: true, items: await mySuggestions(who) })
    } catch {
      return json({ ok: false, error: 'Список предложений временно недоступен.' })
    }
  }

  const said = p.get('ai')
  if (said) {
    const key = await aiKey().catch(() => null)
    if (!key) return json({ ok: false, error: 'ИИ-подбор пока не подключён.' })
    try {
      const a = await aiAnswer(baza, said, lang, key)
      if (!a) return json({ ok: false, error: 'ИИ не смог подобрать ответ — воспользуйтесь кнопками.' })
      writeLog([almaty(), who.name, 'ai', a.id, lang, said.slice(0, 300)]).catch(() => {})
      return json({ ok: true, ...a })
    } catch {
      return json({ ok: false, error: 'ИИ сейчас не отвечает — воспользуйтесь кнопками.' })
    }
  }

  const ai = !!(await aiKey().catch(() => null))
  const { hunters: _hunters, etapy_v2, ...data } = baza
  void _hunters
  const mode = (baza.nastroyki['скрипт_v2'] ?? '').toLowerCase()
  const v2show = etapy_v2.length > 0 && (mode === 'все' || (mode === 'тест' && !!who.tester))
  const payload = JSON.stringify({ ...data, etapy_v2: v2show ? etapy_v2 : [], v2show, v2test: mode !== 'все', hunter: { name: who.name, code: who.code }, ai, editor: !!who.editor })
    .replace(/</g, '\\u003c')
  return new Response(PAGE_HTML.replace('/*DATA*/null/*END*/', payload), { status: 200, headers: HTML_HEADERS })
}

// POST {act:'suggest', gde, pole, lang, frag, variant, comment} — предложение правки скрипта
// POST {act:'edit', ref:{list,id,blok?,tip?}, changes:[{field,old,value}], gde, comment} — правка редактора сразу в базу
export async function respondPost(req: Request, who: { name: string; id?: string; editor?: boolean }) {
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json({ ok: false, error: 'Не удалось прочитать запрос.' }, 400) }
  const str = (k: string, max: number) => String(b[k] ?? '').trim().slice(0, max)
  if (b.act === 'edit') {
    if (!who.editor) return json({ ok: false, error: 'Править скрипт может только редактор.' }, 403)
    const r = (b.ref ?? {}) as Record<string, unknown>
    const ref = { list: String(r.list ?? ''), id: String(r.id ?? ''), blok: r.blok == null ? undefined : String(r.blok), tip: r.tip == null ? undefined : String(r.tip) }
    const changes: EditChange[] = (Array.isArray(b.changes) ? b.changes : []).slice(0, 20).map((c: Record<string, unknown>) => ({
      field: String(c?.field ?? ''), old: String(c?.old ?? '').slice(0, 8000), value: String(c?.value ?? '').slice(0, 8000),
    }))
    try {
      const res = await applyEdit(ref, changes, who, { gde: str('gde', 200), comment: str('comment', 2000) })
      return json({ ok: true, ...res })
    } catch (e) {
      return json({ ok: false, error: e instanceof EditError ? e.message : 'Не удалось сохранить — попробуйте ещё раз через минуту.' }, e instanceof EditError ? 409 : 502)
    }
  }
  if (b.act !== 'suggest') return json({ ok: false, error: 'Неизвестное действие.' }, 400)
  const variant = str('variant', 8000)
  if (!variant) return json({ ok: false, error: 'Напишите, как, по-вашему, лучше сказать.' }, 400)
  try {
    const n = await addSuggestion({
      authorId: who.id ?? null, authorName: who.name, gde: str('gde', 200), pole: str('pole', 60),
      lang: str('lang', 4) === 'kz' ? 'kz' : 'ru', frag: str('frag', 2000), variant, comment: str('comment', 2000),
    })
    return json({ ok: true, n })
  } catch {
    return json({ ok: false, error: 'Не удалось сохранить — попробуйте ещё раз через минуту.' }, 502)
  }
}
