export type SheetRow = {
  dateKey: string  // "YYYY-MM-DD" in Asia/Almaty timezone
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

export type DashData = {
  monthKey: string
  days: string[]
  daysIso: string[]
  weeks: string[]
  pipelines: PipelineStat[]
  marketing: {
    summary: { totalLeads: number; totalSales: number; totalRevenue: number }
    sources: SourceData[]
    overall: { source?: string; milestones: MilestoneStat[]; revenue?: ValuesSet; spend?: SpendMetrics }
    groups: GroupSourceData[]
  }
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
