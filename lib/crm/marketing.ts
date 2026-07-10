import type { SheetRow, MilestoneDef, MilestoneStat, ValuesSet, SpendMetrics, SourceData, SpendMap, RateMap } from './types'
import { TEST_REGEX, safeDiv } from './utils'

const MARKETING_MILESTONES: MilestoneDef[] = [
  { name: 'Новая заявка (WhatsApp)', source: 'leads' },
  { name: 'Собеседование назначено', source: 'leads' },
  { name: 'Собеседование проведено', source: 'deals', pipeline: 'Собеседование' },
  { name: 'Предоплата получена', source: 'deals', pipeline: 'Собеседование' },
  { name: 'Одобрен педсоветом', source: 'deals', pipeline: 'Продажи' },
  { name: 'Полная оплата есть', source: 'deals', pipeline: 'Продажи' },
]

const OVERALL_MILESTONES: MilestoneDef[] = [
  { name: ['Новая заявка (WhatsApp)', 'Новая заявка (Instagram)'], label: 'Новая заявка (WhatsApp)', source: 'leads' },
  { name: 'Собеседование назначено', source: 'leads' },
  { name: 'Собеседование проведено', source: 'deals', pipeline: 'Собеседование' },
  { name: 'Предоплата получена', source: 'deals', pipeline: 'Собеседование' },
  { name: 'Одобрен педсоветом', source: 'deals', pipeline: 'Продажи' },
  { name: 'Полная оплата есть', source: 'deals', pipeline: 'Продажи' },
]

const REVENUE_STAGE = 'Полная оплата есть'
const REVENUE_PIPELINE = 'Продажи'

function getMilestonesForSource(src: string): MilestoneDef[] {
  if (src === 'Instagram') {
    return [
      { name: 'Новая заявка (Instagram)', source: 'leads', noSourceFilter: true },
      ...MARKETING_MILESTONES.slice(1),
    ]
  }
  return MARKETING_MILESTONES
}

function makeSourceFilter(src: string): (r: SheetRow) => boolean {
  if (src === 'Instagram') return r => /instagram/i.test(r.tags)
  return r => r.source === src
}

function countOnDay(rows: SheetRow[], dateKey: string): number {
  return rows.filter(r => r.dateKey === dateKey).length
}

function sumForWeek(rows: SheetRow[], weekDays: string[]): number {
  const set = new Set(weekDays)
  return rows.filter(r => set.has(r.dateKey)).length
}

function sumAmountOnDay(rows: SheetRow[], dateKey: string): number {
  return rows.filter(r => r.dateKey === dateKey).reduce((s, r) => s + r.amount, 0)
}

function sumAmountForWeek(rows: SheetRow[], weekDays: string[]): number {
  const set = new Set(weekDays)
  return rows.filter(r => set.has(r.dateKey)).reduce((s, r) => s + r.amount, 0)
}

function buildMilestones(
  leadsRows: SheetRow[],
  dealsRows: SheetRow[],
  days: string[],
  weeks: string[][],
  sourceFilter: ((r: SheetRow) => boolean) | null,
  list: MilestoneDef[]
): MilestoneStat[] {
  return list.map(m => {
    const rows = m.source === 'leads' ? leadsRows : dealsRows
    const names = Array.isArray(m.name) ? m.name : [m.name]
    const matching = rows.filter(r => {
      const pipelineOk = m.pipeline ? r.pipeline === m.pipeline : true
      const sourceOk = m.noSourceFilter ? true : (sourceFilter ? sourceFilter(r) : true)
      return names.includes(r.stage) && pipelineOk && sourceOk && !TEST_REGEX.test(r.title)
    })
    const dayValues = days.map(d => countOnDay(matching, d))
    const weekValues = weeks.map(w => sumForWeek(matching, w))
    const total = dayValues.reduce((a, b) => a + b, 0)
    return { name: m.label ?? names[0], dayValues, weekValues, total }
  })
}

function buildRevenue(
  dealsRows: SheetRow[],
  days: string[],
  weeks: string[][],
  sourceFilter: ((r: SheetRow) => boolean) | null
): ValuesSet {
  const matching = dealsRows.filter(r =>
    r.stage === REVENUE_STAGE && r.pipeline === REVENUE_PIPELINE &&
    !TEST_REGEX.test(r.title) && (sourceFilter ? sourceFilter(r) : true)
  )
  const dayValues = days.map(d => sumAmountOnDay(matching, d))
  const weekValues = weeks.map(w => sumAmountForWeek(matching, w))
  return { dayValues, weekValues, total: dayValues.reduce((a, b) => a + b, 0) }
}

function buildSpend(
  source: string | null,
  days: string[],
  weeks: string[][],
  spendMap: SpendMap,
  rateMap: RateMap,
  leadsMilestone: MilestoneStat,
  salesMilestone: MilestoneStat,
  revenue: ValuesSet
): SpendMetrics {
  function getRaw(field: keyof SpendMap[string]): ValuesSet {
    const dayValues = days.map(dateKey => {
      if (source === null) {
        const prefix = dateKey + '|'
        return Object.keys(spendMap).filter(k => k.startsWith(prefix)).reduce((s, k) => s + spendMap[k][field], 0)
      }
      return spendMap[dateKey + '|' + source]?.[field] ?? 0
    })
    const weekValues = weeks.map(w =>
      w.reduce((s, d) => { const i = days.indexOf(d); return s + (i >= 0 ? dayValues[i] : 0) }, 0)
    )
    return { dayValues, weekValues, total: dayValues.reduce((a, b) => a + b, 0) }
  }

  const spent = getRaw('spent')
  const impressions = getRaw('impressions')
  const clicks = getRaw('clicks')
  const fbLeads = getRaw('fbLeads')

  const budgetDays = days.map((dateKey, i) => spent.dayValues[i] * (rateMap[dateKey] ?? 0))
  const budgetWeeks = weeks.map(w =>
    w.reduce((s, d) => { const i = days.indexOf(d); return s + (i >= 0 ? budgetDays[i] : 0) }, 0)
  )
  const budgetKzt: ValuesSet = { dayValues: budgetDays, weekValues: budgetWeeks, total: budgetDays.reduce((a, b) => a + b, 0) }

  function metric(a: ValuesSet, b: ValuesSet, mult = 1): ValuesSet {
    return {
      dayValues: days.map((_, i) => safeDiv(a.dayValues[i], b.dayValues[i]) * mult),
      weekValues: weeks.map((_, i) => safeDiv(a.weekValues[i], b.weekValues[i]) * mult),
      total: safeDiv(a.total, b.total) * mult,
    }
  }
  function ms(m: MilestoneStat): ValuesSet {
    return { dayValues: m.dayValues, weekValues: m.weekValues, total: m.total }
  }

  return {
    spent, impressions, clicks, fbLeads,
    ctr: metric(clicks, impressions, 100),
    costPerClick: metric(spent, clicks),
    costPerLeadAnalytics: metric(spent, fbLeads),
    budgetKzt,
    costPerLeadCrm: metric(spent, ms(leadsMilestone)),
    costPerClient: metric(spent, ms(salesMilestone)),
    costPerClientKzt: metric(budgetKzt, ms(salesMilestone)),
    romi: {
      dayValues: days.map((_, i) => safeDiv(revenue.dayValues[i] - budgetKzt.dayValues[i], budgetKzt.dayValues[i]) * 100),
      weekValues: weeks.map((_, i) => safeDiv(revenue.weekValues[i] - budgetKzt.weekValues[i], budgetKzt.weekValues[i]) * 100),
      total: safeDiv(revenue.total - budgetKzt.total, budgetKzt.total) * 100,
    },
  }
}

function collectSources(leadsRows: SheetRow[], dealsRows: SheetRow[]): string[] {
  const all = [...leadsRows, ...dealsRows]
  const set = new Set<string>()
  for (const r of all) { if (r.source) set.add(r.source) }
  if (all.some(r => /instagram/i.test(r.tags))) set.add('Instagram')
  return Array.from(set).sort()
}

export function buildMarketingStats(
  leadsRows: SheetRow[],
  dealsRows: SheetRow[],
  days: string[],
  weeks: string[][],
  spendMap: SpendMap,
  rateMap: RateMap
) {
  const sources = collectSources(leadsRows, dealsRows)

  const totalLeads = leadsRows.filter(r =>
    (r.stage === 'Новая заявка (WhatsApp)' || r.stage === 'Новая заявка (Instagram)') && !TEST_REGEX.test(r.title)
  ).length
  const totalSalesRows = dealsRows.filter(r => r.stage === REVENUE_STAGE && !TEST_REGEX.test(r.title))
  const totalRevenue = totalSalesRows.reduce((s, r) => s + r.amount, 0)

  const overallMilestones = buildMilestones(leadsRows, dealsRows, days, weeks, null, OVERALL_MILESTONES)
  const overallRevenue = buildRevenue(dealsRows, days, weeks, null)
  const overallSpend = buildSpend(null, days, weeks, spendMap, rateMap, overallMilestones[0], overallMilestones[overallMilestones.length - 1], overallRevenue)

  const sourceStats: SourceData[] = sources.map(src => {
    const filter = makeSourceFilter(src)
    const list = getMilestonesForSource(src)
    const milestones = buildMilestones(leadsRows, dealsRows, days, weeks, filter, list)
    const revenue = buildRevenue(dealsRows, days, weeks, filter)
    const spend = buildSpend(src, days, weeks, spendMap, rateMap, milestones[0], milestones[milestones.length - 1], revenue)
    return { source: src, milestones, revenue, spend }
  })

  return {
    summary: { totalLeads, totalSales: totalSalesRows.length, totalRevenue },
    overall: { milestones: overallMilestones, revenue: overallRevenue, spend: overallSpend },
    sources: sourceStats,
  }
}
