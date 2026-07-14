import { readSheetRows } from './read-sheet'
import { loadPipelineDefinitions, buildPipelineStats } from './pipelines'
import { buildMarketingStats } from './marketing'
import { readSpendMap, readRateMap } from './spend'
import { getMergedGroups } from './settings'
import { getMonthDays, getWeekGroups, formatDay, formatWeek } from './utils'
import type { DashData } from './types'

export async function computeDashboardData(monthKey: string): Promise<DashData> {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr) - 1  // 0-indexed

  const days = getMonthDays(year, month)
  const weeks = getWeekGroups(days)

  // Fetch all data in parallel
  const [pipelineDefs, leadsRows, dealsRows, spendMap, rateMap, groups] = await Promise.all([
    loadPipelineDefinitions(),
    readSheetRows('Лиды'),
    readSheetRows('Сделки'),
    readSpendMap(),
    readRateMap(),
    getMergedGroups(),
  ])

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
    daysIso: days,  // already "YYYY-MM-DD"
    weeks: weeks.map(formatWeek),
    pipelines,
    marketing,
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
