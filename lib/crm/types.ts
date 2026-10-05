export type SheetRow = {
  dateKey: string  // "YYYY-MM-DD" in Asia/Almaty timezone
  id: string       // ID лида/сделки из ссылки на Битрикс — один и тот же у всех событий карточки
  ts: number       // время события (serial) — по нему восстанавливается порядок внутри дня
  title: string
  stage: string
  pipeline: string
  amount: number
  source: string
  tags: string
}

export type ValuesSet = {
  dayValues: number[]
  weekValues: number[]
  total: number
}

export type MilestoneStat = {
  name: string
  dayValues: number[]
  weekValues: number[]
  total: number
}

export type SpendRecord = {
  spent: number
  impressions: number
  clicks: number
  fbLeads: number
}

export type SpendMetrics = {
  spent: ValuesSet
  impressions: ValuesSet
  clicks: ValuesSet
  ctr: ValuesSet
  costPerClick: ValuesSet
  fbLeads: ValuesSet
  costPerLeadAnalytics: ValuesSet
  budgetKzt: ValuesSet
  costPerLeadCrm: ValuesSet
  costPerClient: ValuesSet
  costPerClientKzt: ValuesSet
  romi: ValuesSet
}

export type SourceData = {
  source: string
  milestones: MilestoneStat[]
  revenue?: ValuesSet
  spend?: SpendMetrics
}

export type PipelineStat = {
  name: string
  stages: MilestoneStat[]
}

export type PlanMetricKey = 'leads' | 'app' | 'held' | 'pre' | 'paid' | 'revenue' | 'budget'
export type PlanMetrics = Record<PlanMetricKey, number>

export type MonthPlan = {
  target: number                       // цель по сделкам, от неё считается вся воронка
  conv: { lead2app: number; app2held: number; held2pre: number; pre2paid: number }  // %
  check: number                        // средний чек, ₸
  cpl: number                          // потолок цены заявки, $
  mode: 'even' | 'catch' | 'manual'    // как план делится по неделям
  manual: Partial<PlanMetrics> | null  // метрики, вписанные руками поверх расчёта
  weights: Record<string, number>      // множитель недели, ключ — ISO её первого дня
  capacity: { hunters: number; cap: number; slots: number; callable: number }
}

export type WeekPlanRow = {
  key: string
  label: string
  days: number
  elapsed: number       // сколько дней недели прошло, включая сегодняшний
  workdays: number
  closed: boolean
  current: boolean
  weight: number
  plan: PlanMetrics
  even: PlanMetrics     // ровная разбивка — с ней сравнивается догоняющий план
  fact: PlanMetrics
}

export type MetricStatus = 'ok' | 'near' | 'behind' | null

export type CapacityRow = {
  key: string
  label: string
  closed: boolean
  needLeads: number
  leadCap: number
  leadLoad: number
  needSlots: number
  slotCap: number
  slotLoad: number
}

export type DashData = {
  monthKey: string
  days: string[]
  daysIso: string[]
  weeks: string[]
  weekDays: string[][]
  pipelines: PipelineStat[]
  marketing: {
    summary: { totalLeads: number; totalSales: number; totalRevenue: number }
    sources: SourceData[]
    overall: { source?: string; milestones: MilestoneStat[]; revenue?: ValuesSet; spend?: SpendMetrics }
    groups: GroupSourceData[]
  }
  rateMap: Record<string, number>
  plan: MonthPlan
  frozen?: boolean
  computedAt?: string   // когда данные посчитаны: ответ может прийти из кэша
}

export type MilestoneDef = {
  name: string | string[]
  label?: string
  source: 'leads' | 'deals'
  pipeline?: string
  noSourceFilter?: boolean
}

export type PipelineDefinitions = {
  leadStages: string[]
  dealPipelines: { name: string; stages: string[] }[]
}

export type MergedGroup = { name: string; sources: string[] }
export type GroupSourceData = SourceData & { sources: string[] }

export type SpendMap = Record<string, SpendRecord>
export type RateMap = Record<string, number>
