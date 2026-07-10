import { sheetValues } from './sheets'
import { stripPipeline, TEST_REGEX } from './utils'
import type { SheetRow, MilestoneStat, PipelineStat, PipelineDefinitions } from './types'

export async function loadPipelineDefinitions(): Promise<PipelineDefinitions> {
  const data = await sheetValues('Воронки', 'A2:B')
  const leadStages: string[] = []
  const dealPipelines: { name: string; stages: string[] }[] = []
  let current: { name: string; stages: string[] } | null = null
  let inLeads = false

  for (const row of data) {
    const name = stripPipeline(String(row[0] ?? ''))
    const id = String(row[1] ?? '').trim()
    const isPipeline = id === 'LEADS' || id === '0' || /^[0-9]+$/.test(id)

    if (isPipeline) {
      if (id === 'LEADS') { inLeads = true; current = null }
      else { inLeads = false; current = { name, stages: [] }; dealPipelines.push(current) }
      continue
    }
    if (!name && !id) continue
    if (inLeads) leadStages.push(name)
    else if (current) current.stages.push(name)
  }

  return { leadStages, dealPipelines }
}

function countOnDay(rows: SheetRow[], dateKey: string): number {
  return rows.filter(r => r.dateKey === dateKey).length
}

function sumForWeek(rows: SheetRow[], weekDays: string[]): number {
  const set = new Set(weekDays)
  return rows.filter(r => set.has(r.dateKey)).length
}

export function buildPipelineStats(
  name: string,
  stages: string[],
  rows: SheetRow[],
  days: string[],
  weeks: string[][],
  pipelineFilter: (r: SheetRow) => boolean
): PipelineStat {
  const stageStats: MilestoneStat[] = stages.map(stageName => {
    const matching = rows.filter(r =>
      r.stage === stageName && pipelineFilter(r) && !TEST_REGEX.test(r.title)
    )
    const dayValues = days.map(d => countOnDay(matching, d))
    const weekValues = weeks.map(w => sumForWeek(matching, w))
    const total = dayValues.reduce((a, b) => a + b, 0)
    return { name: stageName, dayValues, weekValues, total }
  })
  return { name, stages: stageStats }
}
