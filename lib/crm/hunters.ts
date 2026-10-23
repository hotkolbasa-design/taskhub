import { unstable_cache } from 'next/cache'
import { sheetValuesFrom } from './sheets'
import { readSheetRows } from './read-sheet'
import { getHunters } from './settings'
import { serialToDateKey, isTestTitle } from './utils'
import { getMonthDays, getWeekGroups } from './utils'
import type { HunterDay, HunterReport, Hunter } from './types'

// Звонки Битрикс-телефонии и прогресс по скрипту лежат в отдельных таблицах,
// не в той, из которой считается воронка. Доступ у сервисного аккаунта есть.
const CALLS_SHEET = '1Nq7EmiXI6r6MYoxENGX0TmIc_Qfpr9yDAVutRfNPZF8'
const SCRIPT_SHEET = '1qQKO5-GGM-247j7ydiDOiEUg8QIWn2pNL_-web-L_f8'

const HUNTER_CACHE_SECONDS = 900   // звонков больше 11 тысяч строк: пересчёт дорогой

const dayOf = (serial: unknown): string => {
  const n = Math.floor(Number(serial))
  return Number.isFinite(n) && n > 1000 ? serialToDateKey(n) : ''
}
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const median = (a: number[]): number | null => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

// В прогрессе по скрипту имена короткие (только имя), в звонках и CRM — полные
const shortName = (full: string) => full.trim().split(/\s+/)[0]

function emptyDay(date: string): HunterDay {
  return { date, calls: 0, talks: 0, minutes: 0, leads: 0, booked: 0, held: 0, reactWork: null, reactOff: null, score: null }
}

/**
 * Работа хантеров за месяц: звонки, скорость реакции, баллы за скрипт и воронка
 * собеседований — всё по дням. Собирается из трёх источников, у каждого свой
 * формат имени и своя дата, поэтому склеивается здесь, а не в компоненте.
 */
export async function computeHunters(monthKey: string): Promise<HunterReport> {
  const [yearStr, monthStr] = monthKey.split('-')
  const days = getMonthDays(parseInt(yearStr), parseInt(monthStr) - 1)
  const weeks = getWeekGroups(days)
  const inMonth = (d: string) => d.startsWith(monthKey)

  const hunters: Hunter[] = await getHunters()
  const names = new Set(hunters.map(h => h.name))
  const byName = new Map<string, Map<string, HunterDay>>()
  const touch = (who: string, date: string): HunterDay => {
    let m = byName.get(who)
    if (!m) { m = new Map(); byName.set(who, m) }
    let d = m.get(date)
    if (!d) { d = emptyDay(date); m.set(date, d) }
    return d
  }

  const [calls, react, progress, leadRows, dealRows] = await Promise.all([
    sheetValuesFrom(CALLS_SHEET, 'Звонки', 'A2:G').catch(() => []),
    sheetValuesFrom(CALLS_SHEET, 'Реакция на лиды', 'A2:T').catch(() => []),
    sheetValuesFrom(SCRIPT_SHEET, 'По дням', 'A2:N').catch(() => []),
    readSheetRows('Лиды'),
    readSheetRows('Сделки'),
  ])

  // звонки: F — кто ответил, G — длительность в секундах
  for (const r of calls) {
    const date = dayOf(r[2]); if (!inMonth(date)) continue
    const who = String(r[5] ?? '').trim(); if (!names.has(who)) continue
    const sec = num(r[6])
    const d = touch(who, date)
    d.calls++
    d.minutes += sec / 60
    if (sec > 0) d.talks++
  }

  // реакция: D — ответственный, F — минут до первого набора, N — окно
  for (const r of react) {
    const date = dayOf(r[0]); if (!inMonth(date)) continue
    const who = String(r[3] ?? '').trim(); if (!names.has(who)) continue
    const mins = Number(r[5]); if (!Number.isFinite(mins) || mins < 0) continue
    const window = String(r[13] ?? '').trim()
    const d = touch(who, date)
    // «Рабочее время» строгим равенством: «Вне графика» тоже содержит «график»
    const bucket = window === 'Рабочее время' ? '_work' : '_off'
    ;(d as unknown as Record<string, number[]>)[bucket] ??= []
    ;(d as unknown as Record<string, number[]>)[bucket].push(mins)
  }

  // балл за скрипт: B — короткое имя, J — балл ИИ
  for (const r of progress) {
    const date = dayOf(r[0]); if (!inMonth(date)) continue
    const short = String(r[1] ?? '').trim()
    const full = hunters.find(h => shortName(h.name) === short)?.name
    if (!full) continue
    const score = Number(r[9])
    if (Number.isFinite(score) && score > 0) touch(full, date).score = score
  }

  // заявки на хантере — из листа «Лиды»
  const NEW_STAGES = ['Новая заявка (WhatsApp)', 'Новая заявка (Instagram)']
  const seenLead = new Set<string>()
  for (const r of leadRows) {
    if (!inMonth(r.dateKey) || !NEW_STAGES.includes(r.stage) || isTestTitle(r.title)) continue
    if (!names.has(r.responsible)) continue
    if (r.id && seenLead.has(r.id)) continue
    if (r.id) seenLead.add(r.id)
    touch(r.responsible, r.dateKey).leads++
  }

  // назначено и проведено — по карточкам сделок, проведение засчитывается тому, кто назначил
  const deals = dealRows.filter(r => !isTestTitle(r.title) && r.pipeline === 'Собеседование')
  const bookedBy = new Map<string, { who: string; date: string }>()
  for (const r of [...deals].filter(r => r.stage === 'Собеседование назначено').sort((a, b) => a.ts - b.ts)) {
    if (!bookedBy.has(r.id) && names.has(r.responsible)) bookedBy.set(r.id, { who: r.responsible, date: r.dateKey })
  }
  for (const [, b] of bookedBy) if (inMonth(b.date)) touch(b.who, b.date).booked++
  const heldSeen = new Set<string>()
  for (const r of [...deals].filter(r => r.stage === 'Собеседование проведено').sort((a, b) => a.ts - b.ts)) {
    if (heldSeen.has(r.id)) continue
    heldSeen.add(r.id)
    const b = bookedBy.get(r.id)
    if (b && inMonth(r.dateKey)) touch(b.who, r.dateKey).held++
  }

  return {
    monthKey,
    days,
    weeks,
    computedAt: new Date().toISOString(),
    hunters: hunters.map(h => {
      const m = byName.get(h.name) ?? new Map<string, HunterDay>()
      return {
        name: h.name,
        short: shortName(h.name),
        share: h.share,
        days: days.map(date => {
          const d = m.get(date) ?? emptyDay(date)
          const raw = d as unknown as Record<string, number[] | undefined>
          return {
            ...d,
            minutes: Math.round(d.minutes),
            reactWork: median(raw._work ?? []),
            reactOff: median(raw._off ?? []),
            _work: undefined,
            _off: undefined,
          } as HunterDay
        }),
      }
    }),
  }
}

export function getHunterReport(monthKey: string): Promise<HunterReport> {
  return unstable_cache(
    () => computeHunters(monthKey),
    ['crm-hunters', monthKey],
    { revalidate: HUNTER_CACHE_SECONDS, tags: ['crm', `crm-hunters:${monthKey}`] },
  )()
}
