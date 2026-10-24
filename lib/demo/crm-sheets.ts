// Выдуманные листы CRM для демо-копии (DEMO_MODE=1). Раскладка колонок та же, что у таблиц
// «Интеграция B24 лиды - сделки», звонков и прогресса хантеров, поэтому расчёт в lib/crm
// работает без изменений. Форматы колонок — в комментариях lib/crm/read-sheet.ts, spend.ts,
// settings.ts, hunters.ts.
//
// Данные строятся при первом обращении от текущей даты по Алматы и живут в памяти экземпляра
// функции. Демо-сайт только для чтения (lib/demo/read-only.ts): запись сюда идёт лишь при
// DEMO_WRITABLE=1 на локальной разработке и пропадает при перезапуске.

type Cell = string | number | boolean
type Grid = Cell[][]

const HUNTERS = [
  { name: 'Мадина Нурланова', share: 1 },
  { name: 'Тимур Беков', share: 1 },
  { name: 'Камила Рахимова', share: 0.375 },
]
const EXPERTS = ['Ерлан Касымов', 'Сабина Ергалиева', 'Жанар Ибраева']

// источник лида → доля; Instagram особый: заявка идёт стадией «(Instagram)» с тегом instagram
const SOURCES: [string, number][] = [
  ['Facebook — ЕНТ', 30], ['Facebook — Начальная школа', 18], ['Instagram', 17], ['Google Ads', 10],
  ['TikTok', 8], ['Сайт — форма', 8], ['Рекомендация', 6], ['Входящий звонок', 3],
]
// расход ведётся по каналу; два источника Facebook сведены в группу «Facebook»
const PAID: [string, number, number][] = [['Facebook', 34, 52], ['Instagram', 14, 24], ['Google Ads', 11, 19], ['TikTok', 7, 13]]
const OLD_SOURCE = 'Старая лид-форма'

const NAMES = ['Айжан', 'Алихан', 'Амина', 'Ансар', 'Айсулу', 'Батыр', 'Дамир', 'Дарина', 'Ержан', 'Жасмин',
  'Ильяс', 'Лейла', 'Мирас', 'Нурай', 'Рамазан', 'Сафия', 'Тамерлан', 'Томирис', 'Эмир', 'Ясмина', 'Алина',
  'Артём', 'София', 'Аян', 'Медина', 'Нурсултан', 'Аиша', 'Санжар', 'Ева', 'Адель']

const LINK = 'https://demo.bitrix24.kz/crm'
const DAY = 86400000
const MIN = 60000

let store: Map<string, Grid> | null = null
let storeDay = ''

// «Сейчас» по Алматы в виде даты, у которой UTC-поля — местное время: так же устроены серийные даты листов
function almatyNow(): number {
  return Date.now() + 5 * 3600000
}

const serial = (ms: number) => ms / DAY + 25569

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generate(): Map<string, Grid> {
  const now = almatyNow()
  const today = new Date(now)
  const rnd = mulberry32(today.getUTCFullYear() * 10000 + (today.getUTCMonth() + 1) * 100 + today.getUTCDate())
  const between = (a: number, b: number) => a + rnd() * (b - a)
  const int = (a: number, b: number) => Math.floor(between(a, b + 1))
  const pick = <T,>(items: [T, number][]): T => {
    let r = rnd() * items.reduce((s, [, w]) => s + w, 0)
    for (const [v, w] of items) { if ((r -= w) <= 0) return v }
    return items[items.length - 1][0]
  }
  const dow = (ms: number) => (new Date(ms).getUTCDay() + 6) % 7 // 0 = понедельник
  const nextWorkday = (ms: number, days: number) => {
    let t = ms
    for (let left = days; left > 0;) { t += DAY; if (dow(t) < 5) left-- }
    return t
  }
  const at = (dayMs: number, hFrom: number, hTo: number) => dayMs + Math.floor(between(hFrom * 60, hTo * 60)) * MIN

  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1)
  const callsStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1)
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())

  const leads: Grid = []
  const deals: Grid = []
  const react: Grid = []
  const fbLeadsByDay = new Map<number, number>()
  let leadSeq = 70001
  let dealSeq = 90001
  const hunterPick: [string, number][] = HUNTERS.map(h => [h.name, h.share])

  const leadRow = (t: number, id: number, title: string, stage: string, prev: string, who: string, source: string, tags: string): Cell[] =>
    [serial(t), `${LINK}/lead/details/${id}/`, title, stage, 'Лиды', prev, '', 0, who, '', '', source, '', tags]
  const dealRow = (t: number, id: number, title: string, stage: string, pipeline: string, prev: string, amount: number, who: string, source: string, tags: string): Cell[] =>
    [serial(t), `${LINK}/deal/details/${id}/`, title, stage, pipeline, prev, '', amount, who, '', '', source, '', tags]

  for (let day = start; day <= todayStart; day += DAY) {
    const wd = dow(day)
    const progress = (day - start) / (todayStart - start || 1)
    const base = wd < 5 ? 50 : wd === 5 ? 34 : 26
    const count = Math.round(base * (0.9 + 0.2 * progress) * between(0.85, 1.15))

    for (let i = 0; i < count; i++) {
      const t0 = at(day, 8, 23)
      if (t0 > now) continue
      const source = pick(SOURCES)
      const insta = source === 'Instagram'
      const tags = insta ? 'instagram' : ''
      const title = `${NAMES[int(0, NAMES.length - 1)]}, ${int(1, 11)} класс`
      const id = leadSeq++
      const hunter = pick(hunterPick)
      const newStage = insta ? 'Новая заявка (Instagram)' : 'Новая заявка (WhatsApp)'
      if (source.startsWith('Facebook')) fbLeadsByDay.set(day, (fbLeadsByDay.get(day) ?? 0) + 1)

      leads.push(leadRow(t0, id, title, 'Новое обращение', '', '', source, tags))
      const tNew = t0 + 30 * MIN
      if (tNew > now) continue
      leads.push(leadRow(tNew, id, title, newStage, 'Новое обращение', hunter, source, tags))

      // реакция хантера: в рабочее время минуты, вечером и в воскресенье — часы
      const hour = new Date(tNew).getUTCHours()
      const window = wd === 6 ? 'Выходные' : hour >= 9 && hour < 19 ? 'Рабочее время' : 'Вне графика'
      const minutes = window === 'Рабочее время' ? int(2, 30) : int(40, 220)
      const reactRow: Cell[] = Array(20).fill('')
      reactRow[0] = serial(tNew); reactRow[3] = hunter; reactRow[5] = minutes; reactRow[13] = window
      react.push(reactRow)

      const r = rnd()
      let tLast = tNew + minutes * MIN
      let prev = newStage
      if (r < 0.03) {
        if (tLast <= now) leads.push(leadRow(tLast, id, title, 'Перенести в зачисление', prev, hunter, source, tags))
        continue
      }
      if (r < 0.13) {
        if (tLast <= now) leads.push(leadRow(tLast, id, title, 'Некачественный лид', prev, hunter, source, tags))
        continue
      }
      if (rnd() < 0.5) {
        if (tLast > now) continue
        leads.push(leadRow(tLast, id, title, 'Недозвон', prev, hunter, source, tags))
        prev = 'Недозвон'
        tLast += int(2, 26) * 60 * MIN
      }
      if (r > 0.41 || tLast > now) continue

      // назначено → сделка в «Собеседовании», дальше «Продажи»
      leads.push(leadRow(tLast, id, title, 'Собеседование назначено', prev, hunter, source, tags))
      const deal = dealSeq++
      deals.push(dealRow(tLast + 2 * MIN, deal, title, 'Собеседование назначено', 'Собеседование (воронка)', '', 0, hunter, source, tags))
      if (rnd() > 0.75) continue
      const expert = EXPERTS[int(0, EXPERTS.length - 1)]
      const held = at(nextWorkday(tLast - (tLast % DAY), int(1, 3)), 10, 18)
      if (held > now) continue
      deals.push(dealRow(held, deal, title, 'Собеседование проведено', 'Собеседование', 'Собеседование назначено', 0, expert, source, tags))
      if (rnd() > 0.6) continue
      const pre = held + int(10, 40) * MIN
      if (pre > now) continue
      deals.push(dealRow(pre, deal, title, 'Предоплата получена', 'Собеседование', 'Собеседование проведено', 3000, expert, source, tags))
      // дубль стадии во второй воронке бывает и в жизни — в счёт он не идёт
      if (rnd() < 0.15) deals.push(dealRow(pre + MIN, deal, title, 'Предоплата получена', 'Продажи', '', 3000, expert, source, tags))
      if (rnd() > 0.92) continue
      const amount = int(22, 32) * 5000
      const sovet = at(nextWorkday(pre - (pre % DAY), int(1, 4)), 11, 17)
      if (sovet > now) continue
      deals.push(dealRow(sovet, deal, title, 'Одобрен педсоветом', 'Продажи', 'Предоплата получена', amount, expert, source, tags))
      if (rnd() > 0.85) continue
      const paid = at(nextWorkday(sovet - (sovet % DAY), int(2, 7)), 10, 19)
      if (paid > now) continue
      deals.push(dealRow(paid, deal, title, 'Полная оплата есть', 'Продажи', 'Одобрен педсоветом', amount, expert, source, tags))
    }

    // повторные обращения, тестовые заявки и «шумный» источник — то, что расчёт обязан отсеять
    if (rnd() < 0.3) {
      const t = at(day, 10, 20)
      if (t <= now) leads.push(leadRow(t, leadSeq++, 'Тестовая заявка', 'Новая заявка (WhatsApp)', 'Новое обращение', HUNTERS[0].name, 'Facebook — ЕНТ', ''))
    }
    if (wd === 2) {
      const t = at(day, 10, 20)
      if (t <= now) leads.push(leadRow(t, leadSeq++, `${NAMES[int(0, NAMES.length - 1)]}, ${int(1, 11)} класс`, 'Новая заявка (WhatsApp)', 'Новое обращение', pick(hunterPick), OLD_SOURCE, ''))
    }
  }
  // повторная заявка того же лида через несколько дней
  const firstNew = leads.filter(r => String(r[3]).startsWith('Новая заявка') && r[11] !== OLD_SOURCE)
  for (const r of firstNew) {
    if (rnd() > 0.06) continue
    const t = (Number(r[0]) - 25569) * DAY + int(3, 20) * DAY
    if (t <= now) leads.push([serial(t), ...r.slice(1)])
  }
  const byTime = (a: Cell[], b: Cell[]) => Number(a[0]) - Number(b[0])
  leads.sort(byTime)
  deals.sort(byTime)
  react.sort(byTime)

  // звонки и балл за скрипт — по рабочим дням последних трёх месяцев
  const calls: Grid = []
  const progressRows: Grid = []
  let callSeq = 1
  for (let day = callsStart; day <= todayStart; day += DAY) {
    const wd = dow(day)
    if (wd === 6) continue
    for (const h of HUNTERS) {
      if (rnd() < 0.04) continue // выходной или больничный
      const n = Math.round(250 * h.share * between(0.8, 1.15) * (wd === 5 ? 0.5 : 1))
      for (let i = 0; i < n; i++) {
        const t = at(day, 9, wd === 5 ? 14 : 19)
        if (t > now) continue
        const talk = rnd() < 0.17
        const sec = talk ? Math.round(20 + Math.pow(rnd(), 2) * 420) : 0
        calls.push([`c${callSeq++}`, `+7 70${int(0, 8)} ${int(100, 999)} ${int(1000, 9999)}`, serial(t), 'исходящий', '', h.name, sec])
      }
      if (day < todayStart) {
        const row: Cell[] = Array(14).fill('')
        row[0] = serial(day); row[1] = h.name.split(' ')[0]; row[9] = Math.round(between(3.2, 4.9) * 10) / 10
        progressRows.push(row)
      }
    }
  }
  calls.sort(byTime)

  // расходы, курс и настройки делят один лист, как в настоящей таблице
  const spend: Grid = []
  const rates: Grid = []
  let rate = between(498, 512)
  for (let day = start; day <= todayStart; day += DAY) {
    for (const [source, lo, hi] of PAID) {
      const spent = Math.round(between(lo, hi) * 100) / 100
      const impressions = Math.round(spent * between(330, 420))
      const clicks = Math.round(impressions * between(0.009, 0.018))
      const fb = source === 'Facebook' ? Math.round((fbLeadsByDay.get(day) ?? 0) * between(1.0, 1.2)) : 0
      spend.push([serial(day), source, spent, impressions, clicks, fb])
    }
    rate = Math.min(520, Math.max(495, rate + between(-1.5, 1.5)))
    rates.push([serial(day), Math.round(rate * 10) / 10])
  }
  const month = (offset: number) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }
  const plan = (target: number) => ({
    target, conv: { lead2app: 25, app2held: 75, held2pre: 60, pre2paid: 80 }, check: 132000, cpl: 2.35,
    mode: 'catch', manual: null, weights: {}, capacity: { hunters: 3, cap: 80, slots: 20, callable: 65 },
  })
  const settings: [string, string][] = [
    ['excludedSources', JSON.stringify([OLD_SOURCE])],
    ['mergedGroups', JSON.stringify([{ name: 'Facebook', sources: ['Facebook — ЕНТ', 'Facebook — Начальная школа'] }])],
    ['monthPlans', JSON.stringify({ [month(-1)]: plan(120), [month(0)]: plan(130), [month(1)]: plan(140) })],
    ['', ''],
    ['hunters', JSON.stringify(HUNTERS)],
    ['hunterPlans', '{}'],
  ]
  const marketing: Grid = [['Дата', 'Источник', 'Потрачено, $', 'Показы', 'Клики', 'Лиды FB', '', 'Дата', 'Курс', '', settings[0][0], settings[0][1]]]
  for (let i = 0; i < Math.max(spend.length, rates.length, settings.length - 1); i++) {
    const row: Cell[] = Array(12).fill('')
    if (spend[i]) spend[i].forEach((v, c) => { row[c] = v })
    if (rates[i]) { row[7] = rates[i][0]; row[8] = rates[i][1] }
    if (settings[i + 1]) { row[10] = settings[i + 1][0]; row[11] = settings[i + 1][1] }
    marketing.push(row)
  }

  const head = ['Дата', 'Ссылка', 'Название', 'Стадия', 'Воронка', 'Прошлая стадия', '', 'Сумма', 'Ответственный', '', '', 'Источник', '', 'Теги']
  return new Map<string, Grid>([
    ['Лиды', [head, ...leads]],
    ['Сделки', [head, ...deals]],
    ['Воронки', [['Название', 'ID'],
      ['Лиды', 'LEADS'], ['Новое обращение', 'NEW'], ['Новая заявка (WhatsApp)', 'UC_WA'], ['Новая заявка (Instagram)', 'UC_IG'],
      ['Недозвон', 'UC_NOANS'], ['Собеседование назначено', 'UC_BOOK'], ['Перенести в зачисление', 'UC_SCHOOL'], ['Некачественный лид', 'JUNK'],
      ['Собеседование (воронка)', '2'], ['Собеседование назначено', 'C2:NEW'], ['Собеседование проведено', 'C2:PREPARATION'],
      ['Предоплата получена', 'C2:EXECUTING'], ['Не пришёл', 'C2:LOSE'],
      ['Продажи (воронка)', '0'], ['Форма заполнена', 'NEW'], ['Предоплата получена', 'PREPARATION'], ['Одобрен педсоветом', 'EXECUTING'],
      ['Полная оплата есть', 'WON'], ['Отказ', 'LOSE']]],
    ['МаркетингРасходы', marketing],
    ['Snapshots', [['Месяц', 'Когда', 'Кто', 'Данные']]],
    ['Звонки', [['ID', 'Номер', 'Дата', 'Тип', '', 'Сотрудник', 'Секунд'], ...calls]],
    ['Реакция на лиды', [['Дата', '', '', 'Ответственный', '', 'Минут до набора', '', '', '', '', '', '', '', 'Окно'], ...react]],
    ['По дням', [['Дата', 'Хантер', '', '', '', '', '', '', '', 'Балл'], ...progressRows]],
  ])
}

function sheets(): Map<string, Grid> {
  const day = new Date(almatyNow()).toISOString().slice(0, 10)
  if (!store || storeDay !== day) {
    store = generate()
    storeDay = day
  }
  return store
}

function grid(name: string): Grid {
  const all = sheets()
  if (!all.has(name)) all.set(name, [])
  return all.get(name)!
}

const colIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

// «A2:N», «K3:L3», «B5», «A1:A» → 0-based границы; конец строк null = до конца листа
function parseRange(range: string) {
  const m = range.match(/^([A-Z]+)(\d+)?(?::([A-Z]+)(\d+)?)?$/)
  if (!m) throw new Error(`Демо: неизвестный диапазон ${range}`)
  const c1 = colIndex(m[1])
  const r1 = m[2] ? Number(m[2]) - 1 : 0
  const c2 = m[3] ? colIndex(m[3]) : c1
  const r2 = m[4] ? Number(m[4]) - 1 : m[3] || !m[2] ? null : r1
  return { c1, r1, c2, r2 }
}

const empty = (v: Cell | undefined) => v === undefined || v === ''

/** Как values.get у Google: пустые хвосты строк и пустые строки в конце отрезаются. */
export function demoRead(name: string, range: string): Cell[][] {
  const g = grid(name)
  const { c1, r1, c2, r2 } = parseRange(range)
  const out: Cell[][] = []
  for (let r = r1; r <= (r2 ?? g.length - 1) && r < g.length; r++) {
    const row = (g[r] ?? []).slice(c1, c2 + 1)
    while (row.length && empty(row[row.length - 1])) row.pop()
    out.push(row)
  }
  while (out.length && !out[out.length - 1].length) out.pop()
  return out
}

export function demoWrite(name: string, range: string, values: (string | number | null)[][]): void {
  const g = grid(name)
  const { c1, r1 } = parseRange(range)
  values.forEach((vals, i) => {
    const row = (g[r1 + i] ??= [])
    vals.forEach((v, j) => {
      while (row.length < c1 + j) row.push('')
      row[c1 + j] = v ?? ''
    })
  })
}

/** Как values.append с диапазоном A1: строка встаёт после последней заполненной в этих колонках. */
export function demoAppend(name: string, values: (string | number | null)[]): void {
  const g = grid(name)
  let last = g.length - 1
  while (last >= 0 && (g[last] ?? []).slice(0, values.length).every(empty)) last--
  demoWrite(name, `A${last + 2}`, [values])
}

export function demoDeleteRow(name: string, rowIndex: number): void {
  grid(name).splice(rowIndex - 1, 1)
}
