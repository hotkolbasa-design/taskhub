// Asia/Almaty = UTC+5, no DST
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000

export const TEST_REGEX = /тест|test/i

// Google Sheets serial number → "YYYY-MM-DD" in Asia/Almaty timezone
export function serialToDateKey(serial: number): string {
  if (typeof serial !== 'number' || serial < 1) return ''
  const utcMs = (serial - 25569) * 86400 * 1000
  const localMs = utcMs + ALMATY_OFFSET_MS
  const d = new Date(localMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
