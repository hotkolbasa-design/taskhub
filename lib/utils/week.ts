// Утилиты недель: понедельник ISO-недели как ключ, форматирование периода.
import { LOCALE } from '@/lib/i18n'

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

/** «01.02»; в английском «Feb 1» — у американского 02/01 день и месяц читаются наоборот */
export function fmtDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return LOCALE === 'en'
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

/** «01.02 – 07.02» — период недели по понедельнику. */
export function fmtWeekRange(mondayStr: string): string {
  return `${fmtDay(mondayStr)} – ${fmtDay(addDays(mondayStr, 6))}`
}
