export const TEST_REGEX = /тест|test/i

// Returns true for test leads: contain "тест"/"test" in title,
// or phone number consists entirely of 7s (e.g. 777777777, +7(777)777-77-77)
export function isTestTitle(title: string): boolean {
  if (TEST_REGEX.test(title)) return true
  const digits = title.replace(/\D/g, '')
  return digits.length >= 3 && /^7+$/.test(digits)
}

// Google Sheets serial number → "YYYY-MM-DD"
// Bitrix24 writes timestamps in Almaty local time, so the serial already
// represents the local date — no timezone offset needed.
export function serialToDateKey(serial: number): string {
  if (typeof serial !== 'number' || serial < 1) return ''
  const ms = (serial - 25569) * 86400 * 1000
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// "YYYY-MM-DD" → Google Sheets serial (00:00 того дня)
export function dateKeyToSerial(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return 0
  return Date.UTC(y, m - 1, d) / 86400000 + 25569
}

// "…/crm/lead/details/50962/" → "lead-50962"; одна и та же карточка во всех своих событиях
export function entityIdFromLink(link: string): string {
  const m = link.match(/\/crm\/(lead|deal)\/details\/(\d+)/)
  return m ? `${m[1]}-${m[2]}` : ''
}

// Returns ["YYYY-MM-DD", ...] for every day in the given month
export function getMonthDays(year: number, month: number): string[] {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const days: string[] = []
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`)
  }
  return days
}

// Groups days into Mon–Sun weeks; returns arrays of dateKey strings
export function getWeekGroups(days: string[]): string[][] {
  const map = new Map<string, string[]>()
  const order: string[] = []
  for (const dateKey of days) {
    const [y, m, d] = dateKey.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const dow = (date.getUTCDay() + 6) % 7  // 0 = Monday
    const mondayMs = date.getTime() - dow * 86400 * 1000
    const mon = new Date(mondayMs)
    const key = `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}`
    if (!map.has(key)) { map.set(key, []); order.push(key) }
    map.get(key)!.push(dateKey)
  }
  return order.map(k => map.get(k)!)
}

// "2026-07-01" → "01.07"
export function formatDay(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${d}.${m}`
}

export function formatWeek(weekDays: string[]): string {
  return `${formatDay(weekDays[0])}–${formatDay(weekDays[weekDays.length - 1])}`
}

export function safeDiv(a: number, b: number): number {
  return b ? a / b : 0
}

export function stripPipeline(name: string): string {
  return name.replace(/\s*\(воронка\)\s*$/i, '').trim()
}
