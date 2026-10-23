// Excluded sources stored in МаркетингРасходы sheet, cells K1:L1
// K1 = "excludedSources", L1 = JSON array string
// Merged groups stored in K2:L2
// K2 = "mergedGroups", L2 = JSON array string
import { sheetValues, updateRange } from './sheets'
import { normalizePlan } from './plan'
import type { MergedGroup, MonthPlan, Hunter, HunterPlan } from './types'

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

// Доля ставки: у хантера-эксперта половина времени уходит на собеседования, поэтому
// заявок ей положено меньше — план между хантерами делится по этим долям
const DEFAULT_HUNTERS: Hunter[] = [
  { name: 'Хантер Один', share: 1 },
  { name: 'Хантер Два', share: 1 },
  { name: 'Хантер Три', share: 0.375 },
]

export async function getHunters(): Promise<Hunter[]> {
  try {
    const values = await sheetValues(SHEET, 'K5:L5')
    if (values[0]?.[0] === 'hunters' && values[0]?.[1]) {
      const raw = JSON.parse(String(values[0][1]))
      if (Array.isArray(raw) && raw.length) {
        return raw
          .filter((h: Hunter) => h && typeof h.name === 'string' && h.name.trim())
          .map((h: Hunter) => ({ name: h.name.trim(), share: Number(h.share) > 0 ? Number(h.share) : 1 }))
      }
    }
  } catch {}
  return DEFAULT_HUNTERS
}

export async function saveHunters(hunters: Hunter[]): Promise<void> {
  await updateRange(SHEET, 'K5:L5', [['hunters', JSON.stringify(hunters)]], 'RAW')
}

// Планы хантеров: дневные нормы и нормативы качества, общие для всех,
// кто смотрит раздел. В браузере их держать нельзя — у РОПа и у Марлена
// должна быть одна планка
const DEFAULT_HUNTER_PLAN: HunterPlan = {
  leads: 16, calls: 250, talks: 35, minutes: 50, booked: 3,
  dozvon: 25, conv1: 25, conv2: 75, reactWork: 30, score: 4.5,
}

export async function getHunterPlans(): Promise<Record<string, HunterPlan>> {
  let stored: Record<string, Partial<HunterPlan>> = {}
  try {
    const values = await sheetValues(SHEET, 'K6:L6')
    if (values[0]?.[0] === 'hunterPlans' && values[0]?.[1]) stored = JSON.parse(String(values[0][1]))
  } catch {}

  const hunters = await getHunters()
  const out: Record<string, HunterPlan> = {}
  for (const h of hunters) {
    const saved = stored[h.name] ?? {}
    out[h.name] = { ...DEFAULT_HUNTER_PLAN, ...saved } as HunterPlan
    // Дневные нормы по умолчанию — от доли ставки: у хантера на 0,375 ставки требовать
    // с неё полную норму звонков значит красить её красным круглый месяц
    if (!stored[h.name]) {
      for (const k of ['leads', 'calls', 'talks', 'minutes', 'booked'] as const) {
        out[h.name][k] = Math.round(DEFAULT_HUNTER_PLAN[k] * h.share)
      }
    }
  }
  return out
}

export async function saveHunterPlans(plans: Record<string, HunterPlan>): Promise<void> {
  await updateRange(SHEET, 'K6:L6', [['hunterPlans', JSON.stringify(plans)]], 'RAW')
}

export async function saveMonthPlan(monthKey: string, plan: MonthPlan): Promise<void> {
  const plans = await getMonthPlans()
  plans[monthKey] = normalizePlan(plan)
  await updateRange(SHEET, 'K3:L3', [['monthPlans', JSON.stringify(plans)]])
}
