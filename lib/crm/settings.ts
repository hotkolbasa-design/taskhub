// Excluded sources stored in МаркетингРасходы sheet, cells K1:L1
// K1 = "excludedSources", L1 = JSON array string
// Merged groups stored in K2:L2
// K2 = "mergedGroups", L2 = JSON array string
import { sheetValues, updateRange } from './sheets'
import { normalizePlan } from './plan'
import type { MergedGroup, MonthPlan } from './types'

const SHEET = 'МаркетингРасходы'

export async function getExcludedSources(): Promise<string[]> {
  try {
    const values = await sheetValues(SHEET, 'K1:L1')
    if (values[0]?.[0] === 'excludedSources' && values[0]?.[1]) {
      return JSON.parse(String(values[0][1]))
    }
  } catch {}
  return []
}

export async function saveExcludedSources(excluded: string[]): Promise<void> {
  await updateRange(SHEET, 'K1:L1', [['excludedSources', JSON.stringify(excluded)]])
}

export async function getMergedGroups(): Promise<MergedGroup[]> {
  try {
    const values = await sheetValues(SHEET, 'K2:L2')
    if (values[0]?.[0] === 'mergedGroups' && values[0]?.[1]) {
      return JSON.parse(String(values[0][1]))
    }
  } catch {}
  return []
}

export async function saveMergedGroups(groups: MergedGroup[]): Promise<void> {
  await updateRange(SHEET, 'K2:L2', [['mergedGroups', JSON.stringify(groups)]])
}

// Планы месяцев: до октября 2026 здесь лежало одно число — цель по заявкам.
// Теперь значение — объект MonthPlan; старые числа нормализуются при чтении.
export async function getMonthPlans(): Promise<Record<string, MonthPlan>> {
  try {
    const values = await sheetValues(SHEET, 'K3:L3')
    if (values[0]?.[0] === 'monthPlans' && values[0]?.[1]) {
      const raw = JSON.parse(String(values[0][1])) as Record<string, unknown>
      const out: Record<string, MonthPlan> = {}
      for (const key of Object.keys(raw)) out[key] = normalizePlan(raw[key])
      return out
    }
  } catch {}
  return {}
}

export async function saveMonthPlan(monthKey: string, plan: MonthPlan): Promise<void> {
  const plans = await getMonthPlans()
  plans[monthKey] = normalizePlan(plan)
  await updateRange(SHEET, 'K3:L3', [['monthPlans', JSON.stringify(plans)]])
}
