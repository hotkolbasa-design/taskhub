// Подсказчик хантера: база скрипта лежит в Google-таблице «Подсказчик хантера — база»
// (владелец kidsbooster, сервисному аккаунту TaskHub выдан доступ на запись).
// Тексты правят РОП и Марлен прямо в таблице — страница подхватывает их через пару минут.
// Исходники базы и описание листов: ~/Desktop/Globalos/Отдел продаж и маркетинг/Подсказчик хантера/
import { google } from 'googleapis'

export const SHEET_ID = '16ylUmoP7g8V71bz3I6vN10AKgw1ez07waWjLh1KTYV4'

const LISTS = ['Настройки', 'Этапы', 'Чек-листы', 'Мотивы', 'Ситуации', 'Запреты', 'Передать эксперту', 'Слова KZ', 'Хантеры'] as const

function client() {
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyRaw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured')
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(keyRaw),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

type Row = Record<string, string>

function rows(values: unknown[][] | undefined): Row[] {
  if (!values || values.length < 2) return []
  const head = values[0].map(v => String(v ?? '').trim())
  return values.slice(1)
    .map(r => Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? '').trim()])))
    .filter(r => Object.values(r).some(Boolean))
}

const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)

export type Hunter = { name: string; code: string }

export type Baza = {
  nastroyki: Record<string, string>
  gruppy: string[]
  etapy: unknown[]
  motivy: unknown[]
  kartochki: unknown[]
  zaprety: string[]
  peredat: { fraza_ru: string; fraza_kz: string; spisok: string[] }
  slova_kz: string[][]
  ishody: { id: string; ru: string; pr: string }[]
  hunters: Hunter[]
}

// Итог звонка — всегда один из трёх исходов, без «будем ждать обратной связи»
const ISHODY = [
  { id: 'zapis', ru: 'Запись', pr: 'время записи + «+» в WhatsApp + повтор даты' },
  { id: 'perezvon', ru: 'Дата перезвона', pr: 'конкретный день и час, задача в CRM' },
  { id: 'otkaz', ru: 'Отказ с причиной', pr: 'причина в CRM и дата касания к следующей четверти' },
]

// «23.10.2026» или «2026-10-23» → «2026-10-23»
function isoDate(s: string): string {
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s
}

function parse(v: Record<string, unknown[][] | undefined>): Baza {
  const nastroyki: Record<string, string> = {}
  for (const r of rows(v['Настройки'])) if (r['Ключ']) nastroyki[r['Ключ']] = r['Значение']
  if (nastroyki['акция_до']) nastroyki['акция_до'] = isoDate(nastroyki['акция_до'])

  const checks = rows(v['Чек-листы'])
  const etapy: { id: string; nazv: string; vremya: string; cel: string; ton: string; bloki: unknown[]; dopusk: string[]; nelzya: string[]; posle: string }[] = []
  for (const r of rows(v['Этапы'])) {
    let e = etapy.find(x => x.id === r['Этап ID'])
    if (!e) {
      e = { id: r['Этап ID'], nazv: '', vremya: '', cel: '', ton: '', bloki: [], dopusk: [], nelzya: [], posle: '' }
      etapy.push(e)
    }
    e.nazv ||= r['Этап']; e.vremya ||= r['Время']; e.cel ||= r['Цель']; e.ton ||= r['Тон']
    e.bloki.push({ m: r['Блок'], ru: r['Текст RU'], kz: r['Текст KZ'], pr: r['Пометка'] })
  }
  for (const e of etapy) {
    const c = checks.filter(r => r['Этап ID'] === e.id)
    e.dopusk = c.filter(r => r['Тип'] === 'допуск').map(r => r['Текст'])
    e.nelzya = c.filter(r => r['Тип'] === 'нельзя').map(r => r['Текст'])
    e.posle = c.filter(r => r['Тип'] === 'после').map(r => r['Текст']).join('\n')
  }

  const motivy = rows(v['Мотивы']).map(r => ({
    id: r['ID'], nazv: r['Мотив'], fakt: r['Факт'], ru: r['Текст RU'], kz: r['Текст KZ'], ogovorka: r['Оговорка'], ton: r['Тон'],
  }))

  const kartochki = rows(v['Ситуации'])
    .filter(r => r['ID'] && r['Показывать'].toLowerCase() !== 'нет')
    .map(r => ({
      id: r['ID'], gr: r['Группа'], nazv: r['Кнопка'],
      korotko_ru: r['Коротко RU'], korotko_kz: r['Коротко KZ'],
      frazy_ru: lines(r['Фразы клиента RU']), frazy_kz: lines(r['Фразы клиента KZ']),
      zachem: r['Что за этим'], vopros_ru: r['Уточнить RU'], vopros_kz: r['Уточнить KZ'],
      otvet_ru: r['Ответ RU'], otvet_kz: r['Ответ KZ'], nazad_ru: r['Вернуть к записи RU'], nazad_kz: r['Вернуть к записи KZ'],
      povtor: r['Если повторяет'], posle: r['После'], ton: r['Тон'], nelzya: r['Нельзя'], primer: r['Пример звонка'],
      svyaz: r['Связано'].split(/[,;\s]+/).filter(Boolean),
    }))

  const pe = rows(v['Передать эксперту'])
  const peredat = {
    fraza_ru: pe.find(r => r['Тип'] === 'фраза_ru')?.['Текст'] ?? '',
    fraza_kz: pe.find(r => r['Тип'] === 'фраза_kz')?.['Текст'] ?? '',
    spisok: pe.filter(r => r['Тип'] === 'ситуация').map(r => r['Текст']),
  }

  const hunters = rows(v['Хантеры'])
    .filter(r => r['Код'] && r['Активен'].toLowerCase() !== 'нет')
    .map(r => ({ name: r['Имя'], code: r['Код'] }))

  return {
    nastroyki,
    gruppy: (nastroyki['группы'] ?? '').split(';').map(s => s.trim()).filter(Boolean),
    etapy, motivy, kartochki,
    zaprety: rows(v['Запреты']).map(r => r['Текст']),
    peredat,
    slova_kz: rows(v['Слова KZ']).map(r => [r['RU'], r['KZ']]),
    ishody: ISHODY,
    hunters,
  }
}

// Кэш на экземпляр функции: правка в таблице видна максимум через 2 минуты,
// а Sheets API не дёргается на каждое открытие страницы (лимит CPU на Vercel).
let cache: { at: number; baza: Baza } | null = null
const TTL = 120_000

export async function loadBaza(fresh = false): Promise<Baza> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.baza
  const res = await client().spreadsheets.values.batchGet({
    spreadsheetId: SHEET_ID,
    ranges: LISTS.map(n => `'${n}'!A1:Z1000`),
  })
  const v: Record<string, unknown[][] | undefined> = {}
  res.data.valueRanges?.forEach((r, i) => { v[LISTS[i]] = r.values as unknown[][] | undefined })
  const baza = parse(v)
  cache = { at: Date.now(), baza }
  return baza
}

export async function writeLog(row: (string | number)[]): Promise<void> {
  await client().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "'Журнал'!A1",
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  })
}
