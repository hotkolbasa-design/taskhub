import { t } from '@/lib/i18n'

export function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return t('{m} мин', { m })
  if (m === 0) return t('{h} ч', { h })
  return t('{h} ч {m} мин', { h, m })
}

export function displayToMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes
}
