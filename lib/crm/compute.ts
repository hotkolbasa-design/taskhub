import { readSheetRows } from './read-sheet'
import { loadPipelineDefinitions, buildPipelineStats } from './pipelines'
import { buildMarketingStats } from './marketing'
import { readSpendMap, readRateMap } from './spend'
import { getMergedGroups, getMonthPlans } from './settings'
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

export async function computeDashboardData(monthKey: string): Promise<DashData> {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1  // 0-indexed

  const days = getMonthDays(year, month)
  const weeks = getWeekGroups(days)

  // Fetch all data in parallel (including auto exchange rate)
  const [pipelineDefs, leadsRows, dealsRows, spendMap, rateMap, groups, autoRate, monthPlans] = await Promise.all([
    loadPipelineDefinitions(),
    readSheetRows('Лиды'),
    readSheetRows('Сделки'),
    readSpendMap(),
    readRateMap(),
    getMergedGroups(),
    fetchUsdKztRate(),
    getMonthPlans(),
  ])

  const plan = monthPlans[monthKey] ?? 0

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

  return {
    monthKey,
    days: days.map(formatDay),
    daysIso: days,
    weeks: weeks.map(formatWeek),
    weekDays: weeks,
    pipelines,
    marketing,
    rateMap,
    plan,
  }
}

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

export function getAvailableMonths(): { key: string; label: string }[] {
  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    months.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES_RU[m]} ${y}`,
    })
  }
  return months
}
