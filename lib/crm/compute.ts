import { unstable_cache } from 'next/cache'
import { readSheetRows } from './read-sheet'
import { loadPipelineDefinitions, buildPipelineStats } from './pipelines'
import { buildMarketingStats, buildHunterStats, buildToSchoolMapPublic } from './marketing'
import { readSpendMap, readRateMap } from './spend'
import { getMergedGroups, getMonthPlans, getHunters } from './settings'
import { DEFAULT_PLAN } from './plan'
import { getMonthDays, getWeekGroups, formatDay, formatWeek } from './utils'
import type { DashData } from './types'

// Fetch USD→KZT rate from free CDN (fawazahmed0, no API key, updated daily)
async function fetchUsdKztRate(): Promise<number> {
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return 0
    const data = await res.json()
    const kzt = data?.usd?.kzt
    return kzt ? Math.round(kzt) : 0
  } catch {
    return 0
  }
}

/**
 * Тег кэша месяца. Любое сохранение (расход, курс, план, группы, источники)
 * сбрасывает его — иначе правка не появилась бы на экране до истечения срока.
 */
export const crmCacheTag = (monthKey: string) => `crm:${monthKey}`

/**
 * Кэшированный расчёт месяца. Полный пересчёт читает «Лиды», «Сделки», расходы,
 * курс и настройки, а затем строит воронку по дням и неделям для всех источников —
 * это основная статья процессорного времени проекта. Без кэша он повторялся на
 * каждое открытие вкладки, и пять сотрудников давали пять одинаковых пересчётов.
 */
export function getCachedDashboard(monthKey: string): Promise<DashData> {
  return unstable_cache(
    () => computeDashboardData(monthKey),
    ['crm-dashboard', monthKey],
    { revalidate: CRM_CACHE_SECONDS, tags: ['crm', crmCacheTag(monthKey)] },
  )()
}

export const CRM_CACHE_SECONDS = 300

export async function computeDashboardData(monthKey: string): Promise<DashData> {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1  // 0-indexed

  const days = getMonthDays(year, month)
  const weeks = getWeekGroups(days)

  // Fetch all data in parallel (including auto exchange rate)
  // Прошлые месяцы живут снапшотами: 3-го числа их фиксирует /api/cron/freeze,
  // 4-го скрипт Битрикса уносит строки в архив. Здесь — только рабочие листы
  const [pipelineDefs, leadsRows, dealsRows, spendMap, rateMap, groups, autoRate, monthPlans, hunterList] = await Promise.all([
    loadPipelineDefinitions(),
    readSheetRows('Лиды'),
    readSheetRows('Сделки'),
    readSpendMap(),
    readRateMap(),
    getMergedGroups(),
    fetchUsdKztRate(),
    getMonthPlans(),
    getHunters(),
  ])

  const plan = monthPlans[monthKey] ?? DEFAULT_PLAN

  // Fill days that have no manually-set rate with the auto-fetched rate
  if (autoRate > 0) {
    for (const day of days) {
      if (!rateMap[day]) rateMap[day] = autoRate
    }
  }

  const pipelines = [
    buildPipelineStats('Лиды', pipelineDefs.leadStages, leadsRows, days, weeks, () => true),
    ...pipelineDefs.dealPipelines.map(dp =>
      buildPipelineStats(dp.name, dp.stages, dealsRows, days, weeks, r => r.pipeline === dp.name)
    ),
  ]

  const marketing = buildMarketingStats(leadsRows, dealsRows, days, weeks, spendMap, rateMap, groups)
  const hunters = buildHunterStats(leadsRows, dealsRows, days, weeks, hunterList, buildToSchoolMapPublic(leadsRows))

  return {
    monthKey,
    days: days.map(formatDay),
    daysIso: days,
    weeks: weeks.map(formatWeek),
    weekDays: weeks,
    pipelines,
    marketing,
    hunters,
    rateMap,
    plan,
    computedAt: new Date().toISOString(),  // из кэша придёт время расчёта, а не ответа
  }
}

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

// Следующий месяц идёт первым, чтобы план можно было выставить до его начала.
// Он помечен future: дашборд по умолчанию открывает всё равно текущий месяц.
export function getAvailableMonths(): { key: string; label: string; future?: boolean }[] {
  const months: { key: string; label: string; future?: boolean }[] = []
  const now = new Date()
  for (let i = -1; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const future = i < 0
    months.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES_RU[m]} ${y}${future ? ' · план' : ''}`,
      ...(future ? { future: true } : {}),
    })
  }
  return months
}
