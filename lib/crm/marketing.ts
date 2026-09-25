import type { SheetRow, MilestoneDef, MilestoneStat, ValuesSet, SpendMetrics, SourceData, GroupSourceData, MergedGroup, SpendMap, RateMap } from './types'
import { isTestTitle, safeDiv } from './utils'

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

const NEW_REQUEST_STAGES = ['Новая заявка (WhatsApp)', 'Новая заявка (Instagram)']
const TO_SCHOOL_STAGE = 'Перенести в зачисление'

// Последняя отметка «Перенести в зачисление» по каждому лиду.
// Туда колл-центр уводит тех, кто после звонка оказался нашим же учеником.
function buildToSchoolMap(leadsRows: SheetRow[]): Map<string, number> {
  const latest = new Map<string, number>()
  for (const r of leadsRows) {
    if (r.stage !== TO_SCHOOL_STAGE || !r.id) continue
    const prev = latest.get(r.id)
    if (prev === undefined || r.ts > prev) latest.set(r.id, r.ts)
  }
  return latest
}

/**
 * Лист «Лиды» — журнал событий, одна карточка проходит стадию по несколько раз
 * (из «Новое обращение» лид уезжает в «Новая заявка» автоматически, и так по кругу).
 * Оставляем одно событие на карточку — самое раннее, за его днём лид и числится.
 * Для «Новой заявки» вдобавок убираем тех, кого ПОСЛЕ неё увели в «Перенести в зачисление»:
 * заявка засчиталась авансом, а звонок показал, что клиент уже учится у нас.
 * Отметка до заявки не в счёт — такого лида вернули в работу, и он честно новый.
 */
function uniqueLeads(rows: SheetRow[], toSchool: Map<string, number>, dropMovedToSchool: boolean): SheetRow[] {
  const firstByLead = new Map<string, SheetRow>()
  const withoutId: SheetRow[] = []

  for (const r of rows) {
    if (!r.id) { withoutId.push(r); continue }  // без ссылки карточку не опознать — считаем как есть
    const prev = firstByLead.get(r.id)
    if (!prev || r.ts < prev.ts) firstByLead.set(r.id, r)
  }

  const kept = dropMovedToSchool
    ? [...firstByLead.values()].filter(r => {
        const movedAt = toSchool.get(r.id)
        return movedAt === undefined || movedAt < r.ts
      })
    : [...firstByLead.values()]

  return [...kept, ...withoutId]
}

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
  list: MilestoneDef[],
  toSchool: Map<string, number>
): MilestoneStat[] {
  const daySet = new Set(days)
  return list.map(m => {
    const rows = m.source === 'leads' ? leadsRows : dealsRows
    const names = Array.isArray(m.name) ? m.name : [m.name]
    let matching = rows.filter(r => {
      const pipelineOk = m.pipeline ? r.pipeline === m.pipeline : true
      const sourceOk = m.noSourceFilter ? true : (sourceFilter ? sourceFilter(r) : true)
      return names.includes(r.stage) && pipelineOk && sourceOk && !isTestTitle(r.title)
    })
    if (m.source === 'leads') {
      // Уникальность считаем внутри месяца: иначе лид, заходивший в прошлом месяце,
      // выпал бы из текущего, а цифры месяца зависели бы от соседнего
      matching = uniqueLeads(
        matching.filter(r => daySet.has(r.dateKey)),
        toSchool,
        names.some(n => NEW_REQUEST_STAGES.includes(n)),
      )
    }
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
    !isTestTitle(r.title) && (sourceFilter ? sourceFilter(r) : true)
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
  rateMap: RateMap,
  groups: MergedGroup[] = []
) {
  const sources = collectSources(leadsRows, dealsRows)

  const toSchool = buildToSchoolMap(leadsRows)

  const monthDaySet = new Set(days)
  const totalLeads = uniqueLeads(
    leadsRows.filter(r =>
      monthDaySet.has(r.dateKey) &&
      NEW_REQUEST_STAGES.includes(r.stage) &&
      !isTestTitle(r.title)
    ),
    toSchool,
    true,
  ).length
  const totalSalesRows = dealsRows.filter(r =>
    monthDaySet.has(r.dateKey) &&
    r.stage === REVENUE_STAGE &&
    !isTestTitle(r.title)
  )
  const totalRevenue = totalSalesRows.reduce((s, r) => s + r.amount, 0)

  const overallMilestones = buildMilestones(leadsRows, dealsRows, days, weeks, null, OVERALL_MILESTONES, toSchool)
  const overallRevenue = buildRevenue(dealsRows, days, weeks, null)
  const overallSpend = buildSpend(null, days, weeks, spendMap, rateMap, overallMilestones[0], overallMilestones[overallMilestones.length - 1], overallRevenue)

  const sourceStats: SourceData[] = sources.map(src => {
    const filter = makeSourceFilter(src)
    const list = getMilestonesForSource(src)
    const milestones = buildMilestones(leadsRows, dealsRows, days, weeks, filter, list, toSchool)
    const revenue = buildRevenue(dealsRows, days, weeks, filter)
    const spend = buildSpend(src, days, weeks, spendMap, rateMap, milestones[0], milestones[milestones.length - 1], revenue)
    return { source: src, milestones, revenue, spend }
  })

  const zero = (): ValuesSet => ({
    dayValues: days.map(() => 0),
    weekValues: weeks.map(() => 0),
    total: 0,
  })

  const groupStats: GroupSourceData[] = groups.map(group => {
    const groupSources = sourceStats.filter(s => group.sources.includes(s.source))

    const templateMilestones = groupSources[0]?.milestones ?? MARKETING_MILESTONES.map(m => ({
      name: typeof m.name === 'string' ? m.name : (m.label ?? (m.name as string[])[0]),
      dayValues: days.map(() => 0),
      weekValues: weeks.map(() => 0),
      total: 0,
    }))

    const mergedMilestones: MilestoneStat[] = templateMilestones.map((m, idx) => ({
      name: m.name,
      dayValues: days.map((_, di) => groupSources.reduce((s, src) => s + (src.milestones[idx]?.dayValues[di] ?? 0), 0)),
      weekValues: weeks.map((_, wi) => groupSources.reduce((s, src) => s + (src.milestones[idx]?.weekValues[wi] ?? 0), 0)),
      total: groupSources.reduce((s, src) => s + (src.milestones[idx]?.total ?? 0), 0),
    }))

    const mergedRevenue: ValuesSet = groupSources.length > 0 ? {
      dayValues: days.map((_, di) => groupSources.reduce((s, src) => s + (src.revenue?.dayValues[di] ?? 0), 0)),
      weekValues: weeks.map((_, wi) => groupSources.reduce((s, src) => s + (src.revenue?.weekValues[wi] ?? 0), 0)),
      total: groupSources.reduce((s, src) => s + (src.revenue?.total ?? 0), 0),
    } : zero()

    const leadsMilestone = mergedMilestones[0] ?? { name: '', dayValues: days.map(() => 0), weekValues: weeks.map(() => 0), total: 0 }
    const salesMilestone = mergedMilestones[mergedMilestones.length - 1] ?? leadsMilestone

    return {
      source: group.name,
      sources: group.sources,
      milestones: mergedMilestones,
      revenue: mergedRevenue,
      spend: buildSpend(group.name, days, weeks, spendMap, rateMap, leadsMilestone, salesMilestone, mergedRevenue),
    }
  })

  return {
    summary: { totalLeads, totalSales: totalSalesRows.length, totalRevenue },
    overall: { milestones: overallMilestones, revenue: overallRevenue, spend: overallSpend },
    sources: sourceStats,
    groups: groupStats,
  }
}
