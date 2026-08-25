// Утилиты недель: понедельник ISO-недели как ключ, форматирование периода.

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const shift = (d.getDay() + 6) % 7 // 0 = понедельник
  d.setDate(d.getDate() - shift)
  return ymd(d)
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return ymd(d)
}

export function todayYmd(): string {
  return ymd(new Date())
}

/** «01.02» */
export function fmtDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

/** «01.02 – 07.02» — период недели по понедельнику. */
export function fmtWeekRange(mondayStr: string): string {
  return `${fmtDay(mondayStr)} – ${fmtDay(addDays(mondayStr, 6))}`
}
