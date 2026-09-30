import type { MonthPlan, PlanMetricKey, PlanMetrics, WeekPlanRow, CapacityRow, DashData } from './types'

export const PLAN_METRICS: { key: PlanMetricKey; name: string; sub: string; unit?: 'kzt' | 'usd' }[] = [
  { key: 'leads', name: 'Заявки', sub: 'новые лиды' },
  { key: 'app', name: 'Собеседование назначено', sub: 'лист «Лиды»' },
  { key: 'held', name: 'Собеседование проведено', sub: 'воронка «Собеседование»' },
  { key: 'pre', name: 'Предоплата', sub: '3 000 ₸' },
  { key: 'paid', name: 'Оплата', sub: 'сделки' },
  { key: 'revenue', name: 'Выручка', sub: 'по оплаченным сделкам', unit: 'kzt' },
  { key: 'budget', name: 'Рекламный бюджет', sub: 'расход на рекламу', unit: 'usd' },
]

export const DEFAULT_PLAN: MonthPlan = {
  target: 130,
  conv: { lead2app: 25, app2held: 75, held2pre: 60, pre2paid: 80 },
  check: 132000,
  cpl: 2.35,
  mode: 'catch',
  manual: null,
  weights: {},
  capacity: { hunters: 3, cap: 80, slots: 20, callable: 65 },
}

// Старый формат: план хранился одним числом — целью по заявкам.
// Читаем его как ручное переопределение метрики «заявки», остальное достраиваем нормативами.
export function normalizePlan(raw: unknown): MonthPlan {
  if (typeof raw === 'number') {
    return raw > 0 ? { ...DEFAULT_PLAN, manual: { leads: raw } } : { ...DEFAULT_PLAN }
  }
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PLAN }
  const p = raw as Partial<MonthPlan>
  return {
    target: num(p.target, DEFAULT_PLAN.target),
    conv: {
      lead2app: num(p.conv?.lead2app, DEFAULT_PLAN.conv.lead2app),
      app2held: num(p.conv?.app2held, DEFAULT_PLAN.conv.app2held),
      held2pre: num(p.conv?.held2pre, DEFAULT_PLAN.conv.held2pre),
      pre2paid: num(p.conv?.pre2paid, DEFAULT_PLAN.conv.pre2paid),
    },
    check: num(p.check, DEFAULT_PLAN.check),
    cpl: num(p.cpl, DEFAULT_PLAN.cpl),
    mode: p.mode === 'even' || p.mode === 'manual' ? p.mode : 'catch',
    manual: p.manual && typeof p.manual === 'object' ? p.manual : null,
    weights: p.weights && typeof p.weights === 'object' ? p.weights : {},
    capacity: {
      hunters: num(p.capacity?.hunters, DEFAULT_PLAN.capacity.hunters),
      cap: num(p.capacity?.cap, DEFAULT_PLAN.capacity.cap),
      slots: num(p.capacity?.slots, DEFAULT_PLAN.capacity.slots),
      callable: num(p.capacity?.callable, DEFAULT_PLAN.capacity.callable),
    },
  }
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Цель по сделкам разворачивается вверх по воронке нормативами конверсии.
 * Ручные значения (manual) перекрывают рассчитанные: план может приходить сверху,
 * а не выводиться из конверсий.
 */
export function planMetrics(plan: MonthPlan): PlanMetrics {
  const c = plan.conv
  const paid = plan.target
  const pre = paid / (c.pre2paid / 100)
  const held = pre / (c.held2pre / 100)
  const app = held / (c.app2held / 100)
  const leads = app / (c.lead2app / 100)
  const derived: PlanMetrics = {
    leads: Math.round(leads),
    app: Math.round(app),
    held: Math.round(held),
    pre: Math.round(pre),
    paid: Math.round(paid),
    revenue: Math.round(paid * plan.check),
    budget: Math.round(leads * plan.cpl),
  }
  if (!plan.manual) return derived
  const out = { ...derived }
  for (const k of Object.keys(plan.manual) as PlanMetricKey[]) {
    const v = plan.manual[k]
    if (typeof v === 'number' && v > 0) out[k] = v
  }
  return out
}

export function throughput(plan: MonthPlan): number {
  const c = plan.conv
  return (c.lead2app / 100) * (c.app2held / 100) * (c.held2pre / 100) * (c.pre2paid / 100) * 100
}

// Факт недели берётся из уже посчитанного дашборда — вводить руками ничего не нужно
function weekFacts(data: DashData): PlanMetrics[] {
  const ms = data.marketing.overall.milestones
  const byName = (name: string) => ms.find(m => m.name === name)?.weekValues ?? []
  const leads = ms[0]?.weekValues ?? []
  const app = byName('Собеседование назначено')
  const held = byName('Собеседование проведено')
  const pre = byName('Предоплата получена')
  const paid = byName('Полная оплата есть')
  const revenue = data.marketing.overall.revenue?.weekValues ?? []
  const budget = data.marketing.overall.spend?.spent.weekValues ?? []
  return data.weekDays.map((_, i) => ({
    leads: leads[i] ?? 0,
    app: app[i] ?? 0,
    held: held[i] ?? 0,
    pre: pre[i] ?? 0,
    paid: paid[i] ?? 0,
    revenue: revenue[i] ?? 0,
    budget: budget[i] ?? 0,
  }))
}

// Воскресенье — выходной: слоты собеседований считаются по рабочим дням недели
function workdays(days: string[]): number {
  return days.filter(d => {
    const [y, m, dd] = d.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, dd)).getUTCDay() !== 0
  }).length
}

export function weekKey(days: string[]): string {
  return days[0] ?? ''
}

/**
 * Недельная разбивка. Прошедшие недели закрыты: их план остаётся как исторический
 * ориентир, а в итог месяца идёт факт. Остаток цели раскладывается на открытые недели,
 * поэтому план впереди всегда сходится с целью месяца, даже если начало провалено.
 */
export function buildWeekPlan(data: DashData, plan: MonthPlan, todayIso: string): WeekPlanRow[] {
  const metrics = planMetrics(plan)
  const facts = weekFacts(data)
  const weeks = data.weekDays
  const totalDays = weeks.reduce((s, w) => s + w.length, 0) || 1

  const closed = weeks.map(w => (w[w.length - 1] ?? '') < todayIso || data.frozen === true)
  const current = weeks.findIndex(w => (w[0] ?? '') <= todayIso && todayIso <= (w[w.length - 1] ?? ''))

  const rows: WeekPlanRow[] = weeks.map((days, i) => ({
    key: weekKey(days),
    label: data.weeks[i] ?? '',
    days: days.length,
    workdays: workdays(days),
    closed: closed[i],
    current: i === current,
    weight: plan.weights[weekKey(days)] ?? 1,
    plan: emptyMetrics(),
    even: emptyMetrics(),
    fact: facts[i] ?? emptyMetrics(),
  }))

  for (const { key } of PLAN_METRICS) {
    const total = metrics[key]
    weeks.forEach((days, i) => { rows[i].even[key] = total * (days.length / totalDays) })

    if (plan.mode === 'even') {
      weeks.forEach((_, i) => { rows[i].plan[key] = rows[i].even[key] })
      continue
    }

    let done = 0
    const open: number[] = []
    rows.forEach((r, i) => {
      if (r.closed) { r.plan[key] = r.even[key]; done += r.fact[key] }
      else open.push(i)
    })

    const rest = Math.max(0, total - done)
    const weightOf = (i: number) => rows[i].days * (plan.mode === 'manual' ? rows[i].weight : 1)
    const wsum = open.reduce((s, i) => s + weightOf(i), 0)
    open.forEach(i => { rows[i].plan[key] = wsum > 0 ? rest * (weightOf(i) / wsum) : 0 })
  }

  return rows
}

function emptyMetrics(): PlanMetrics {
  return { leads: 0, app: 0, held: 0, pre: 0, paid: 0, revenue: 0, budget: 0 }
}

/**
 * Догоняющий план проверяется об ограничения отдела: потолок заявок на ставку хантера
 * и сетку слотов собеседований. Неделя, которая не влезает, — не план, а требование,
 * которое некому выполнить.
 */
export function buildCapacity(rows: WeekPlanRow[], plan: MonthPlan): CapacityRow[] {
  const c = plan.capacity
  const leadCap = c.hunters * c.cap / (c.callable / 100)
  return rows.map(r => {
    const useFact = r.closed
    const needLeads = useFact ? r.fact.leads : r.plan.leads
    const needSlots = useFact ? r.fact.app : r.plan.app
    const slotCap = c.slots * r.workdays
    return {
      key: r.key,
      label: r.label,
      closed: r.closed,
      needLeads,
      leadCap,
      leadLoad: leadCap > 0 ? needLeads / leadCap : 0,
      needSlots,
      slotCap,
      slotLoad: slotCap > 0 ? needSlots / slotCap : 0,
    }
  })
}

// Сколько ставок хантеров требует самая тяжёлая открытая неделя
export function neededHunters(rows: WeekPlanRow[], plan: MonthPlan): number {
  const c = plan.capacity
  const peak = Math.max(0, ...rows.filter(r => !r.closed).map(r => r.plan.leads))
  const need = peak * (c.callable / 100) / c.cap
  return Math.ceil(need * 8) / 8
}

// Сколько слотов собеседований в день требует самая тяжёлая открытая неделя.
// Узкое место бывает здесь, а не в хантерах: заявок мало, но все они просятся на встречу.
export function neededSlots(rows: WeekPlanRow[]): number {
  const open = rows.filter(r => !r.closed && r.workdays > 0)
  return Math.ceil(Math.max(0, ...open.map(r => r.plan.app / r.workdays)))
}

export function planGap(rows: WeekPlanRow[]): { gap: number; openWeeks: number } {
  const closed = rows.filter(r => r.closed)
  const gap = closed.reduce((s, r) => s + (r.plan.paid - r.fact.paid), 0)
  return { gap: Math.round(gap), openWeeks: rows.filter(r => !r.closed).length }
}
