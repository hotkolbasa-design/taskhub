// Язык интерфейса задаётся при сборке: NEXT_PUBLIC_LOCALE=en стоит только у демо-проекта Vercel
// (показ иностранным работодателям). В бою переменной нет — t() возвращает русскую строку как есть,
// поэтому обёртка t() не меняет поведение прода ни в одной ветке кода.
//
// Ключ словаря — сам русский текст: не нужно придумывать ключи, а строка без перевода остаётся
// русской и находится проверкой демо: на английской странице не должно остаться кириллицы.
import { EN, EN_PLURALS } from './en'

export type Locale = 'ru' | 'en'

export const LOCALE: Locale = process.env.NEXT_PUBLIC_LOCALE === 'en' ? 'en' : 'ru'

/** Локаль для toLocaleDateString, toLocaleString, Intl.NumberFormat. */
export const INTL_LOCALE = LOCALE === 'en' ? 'en-US' : 'ru-RU'

/**
 * Строка интерфейса: t('Мои задачи'). Переменные — фигурными скобками в самом тексте:
 * t('{n} задач из всех проектов', { n: 181 }).
 */
export function t(ru: string, params?: Record<string, string | number>): string {
  const s = LOCALE === 'en' ? (EN[ru] ?? ru) : ru
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m))
}

/**
 * То же, что t(), но для слова, которое в разных разделах переводится по-разному:
 * tc('crm', 'заявка') → lead, tc('expenses', 'заявка') → request. Ищет «контекст|строка»,
 * потом просто строку. В русском возвращает строку как есть.
 */
export function tc(ctx: string, ru: string, params?: Record<string, string | number>): string {
  if (LOCALE !== 'en') return t(ru, params)
  const key = `${ctx}|${ru}`
  return key in EN ? t(key, params) : t(ru, params)
}

/**
 * Дата, которую русский интерфейс пишет цифрами (24.10.2026, 24.10.26, 24.10): в русском — переданный
 * текст как есть, в английском — «Oct 24, 2026» или «Oct 24»: 03.11 американец прочтёт как 11 марта.
 * utc — для дат-ключей CRM («2026-10-24»), которые хранятся без часового пояса.
 */
export function numericDate(ru: string, d: Date, withYear: boolean, utc = false): string {
  if (LOCALE !== 'en') return ru
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), ...(utc ? { timeZone: 'UTC' } : {}),
  })
}

/**
 * Слово в форме для числа: plural(5, 'задача', 'задачи', 'задач') → «задач».
 * В английском две формы — из EN_PLURALS по первой русской форме (или «контекст|форма», если
 * передан ctx: plural(n, 'заявка', 'заявки', 'заявок', 'crm') → lead / leads).
 */
export function plural(n: number, one: string, few: string, many: string, ctx?: string): string {
  if (LOCALE === 'en') {
    const en = (ctx && EN_PLURALS[`${ctx}|${one}`]) || EN_PLURALS[one]
    if (en) return Math.abs(n) === 1 ? en[0] : en[1]
  }
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}
