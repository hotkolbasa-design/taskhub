import type { MonthPlan, PlanMetricKey, PlanMetrics, WeekPlanRow, CapacityRow, DashData, MetricStatus } from './types'

export const PLAN_METRICS: { key: PlanMetricKey; name: string; sub: string; unit?: 'kzt' | 'usd'; lowerIsBetter?: boolean }[] = [
  { key: 'leads', name: 'Заявки', sub: 'новые лиды' },
  { key: 'app', name: 'Собеседование назначено', sub: 'лист «Лиды»' },
  { key: 'held', name: 'Собеседование проведено', sub: 'воронка «Собеседование»' },
  { key: 'pre', name: 'Предоплата', sub: '3 000 ₸' },
  { key: 'paid', name: 'Оплата', sub: 'сделки' },
  { key: 'revenue', name: 'Выручка', sub: 'по оплаченным сделкам', unit: 'kzt' },
  { key: 'budget', name: 'Рекламный бюджет', sub: 'расход на рекламу', unit: 'usd', lowerIsBetter: true },
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
  const out: PlanMetrics = {
    leads: Math.round(leads),
    app: Math.round(app),
    held: Math.round(held),
    pre: Math.round(pre),
    paid: Math.round(paid),
    revenue: 0,
    budget: 0,
  }

  // Ручные значения ступеней перекрывают расчёт…
  if (plan.manual) {
    for (const k of ['leads', 'app', 'held', 'pre', 'paid'] as const) {
      const v = plan.manual[k]
      if (typeof v === 'number' && v > 0) out[k] = v
    }
  }
  // …и деньги считаются уже от них, иначе бюджет расходится с числом заявок на экране
  out.revenue = manualOr(plan.manual?.revenue, Math.round(out.paid * plan.check))
  out.budget = manualOr(plan.manual?.budget, Math.round(out.leads * plan.cpl))
  return out
}

function manualOr(manual: number | undefined, derived: number): number {
  return typeof manual === 'number' && manual > 0 ? manual : derived
}

// Те же ступени без округления: правка числа пересчитывается по ним, иначе
// округление соседей поползёт при каждом редактировании
function rawMetrics(plan: MonthPlan): { leads: number; app: number; held: number; pre: number; paid: number } {
  const c = plan.conv
  const paid = plan.target
  const pre = paid / (c.pre2paid / 100)
  const held = pre / (c.held2pre / 100)
  const app = held / (c.app2held / 100)
  const leads = app / (c.lead2app / 100)
  return { leads, app, held, pre, paid }
}

/**
 * Правка числа прямо в плитке. Правило: изменение одной суммы не двигает другие
 * суммы — пересчитываются только проценты на стыках этой ступени.
 * Поставили 1500 заявок вместо 1444 — назначенные, проведённые и цель остаются,
 * а конверсия «заявка → назначено» становится 24,1 %.
 * Деньги связаны множителем, поэтому правка выручки меняет чек, а бюджета — CPL.
 */
export function applyMetricEdit(plan: MonthPlan, key: PlanMetricKey, value: number): MonthPlan {
  if (!(value > 0)) return plan
  const m = rawMetrics(plan)
  const conv = { ...plan.conv }
  const next: MonthPlan = { ...plan, conv, manual: null }
  const ratio = (a: number, b: number) => b > 0 ? Math.min(100, a / b * 100) : 100

  switch (key) {
    case 'leads':
      conv.lead2app = ratio(m.app, value)
      break
    case 'app':
      conv.lead2app = ratio(value, m.leads)
      conv.app2held = ratio(m.held, value)
      break
    case 'held':
      conv.app2held = ratio(value, m.app)
      conv.held2pre = ratio(m.pre, value)
      break
    case 'pre':
      conv.held2pre = ratio(value, m.held)
      conv.pre2paid = ratio(m.paid, value)
      break
    case 'paid':
      conv.pre2paid = ratio(value, m.pre)
      next.target = value
      break
    // Деньги делим на то же округлённое число, что человек видит в плитке,
    // иначе введённые $4 000 возвращаются как $3 999
    case 'revenue':
      next.check = value / Math.round(m.paid)
      break
    case 'budget':
      next.cpl = value / Math.round(m.leads)
      break
  }
  return next
}

/** Конверсии, уведённые от норматива руками: о них стоит сказать вслух. */
export function convDrift(plan: MonthPlan): { key: keyof MonthPlan['conv']; label: string; value: number; norm: number }[] {
  const labels: Record<keyof MonthPlan['conv'], string> = {
    lead2app: 'заявка → назначено',
    app2held: 'назначено → проведено',
    held2pre: 'проведено → предоплата',
    pre2paid: 'предоплата → оплата',
  }
  return (Object.keys(labels) as (keyof MonthPlan['conv'])[])
    .filter(k => Math.abs(plan.conv[k] - DEFAULT_PLAN.conv[k]) >= 0.05)
    .map(k => ({ key: k, label: labels[k], value: plan.conv[k], norm: DEFAULT_PLAN.conv[k] }))
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

/** Накопленный факт месяца — из уже посчитанной общей карточки. */
export function monthFact(data: DashData): PlanMetrics {
  const ms = data.marketing.overall.milestones
  return {
    leads: ms[0]?.total ?? 0,
    app: ms[1]?.total ?? 0,
    held: ms[2]?.total ?? 0,
    pre: ms[3]?.total ?? 0,
    paid: ms[ms.length - 1]?.total ?? 0,
    revenue: data.marketing.overall.revenue?.total ?? 0,
    budget: data.marketing.overall.spend?.spent.total ?? 0,
  }
}

/**
 * Сколько должно быть к сегодняшнему дню. Считается по ровному темпу, а не по
 * догоняющему: иначе провал первой недели задерёт планку текущей и отставание
 * посчитается дважды. Сегодняшний день входит в срок — норму дня надо делать сегодня.
 */
export function planToDate(plan: MonthPlan, data: DashData, todayIso: string): PlanMetrics {
  const metrics = planMetrics(plan)
  const total = data.daysIso.length
  const passed = data.daysIso.filter(d => d <= todayIso).length
  const share = total > 0 ? Math.min(1, passed / total) : 0
  const out = {} as PlanMetrics
  for (const { key } of PLAN_METRICS) out[key] = metrics[key] * share
  return out
}

/**
 * Галочка, если дошли до плана на сегодня; крестик, если недобор больше десятой части.
 * Для расхода знак обратный: уложиться в бюджет — хорошо, перебрать — плохо.
 */
export function metricStatus(fact: number, due: number, lowerIsBetter = false): MetricStatus {
  if (due <= 0) return null
  const ratio = fact / due
  if (lowerIsBetter) {
    if (ratio <= 1) return 'ok'
    if (ratio <= 1.1) return 'near'
    return 'behind'
  }
  if (ratio >= 1) return 'ok'
  if (ratio >= 0.9) return 'near'
  return 'behind'
}

/** Чем кончится месяц, если темп не изменится. */
export function forecastMonth(fact: PlanMetrics, data: DashData, todayIso: string): PlanMetrics {
  const total = data.daysIso.length
  const passed = Math.max(1, data.daysIso.filter(d => d <= todayIso).length)
  const k = total / passed
  const out = {} as PlanMetrics
  for (const { key } of PLAN_METRICS) out[key] = fact[key] * k
  return out
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
    elapsed: days.filter(d => d <= todayIso).length,
    workdays: workdays(days),
    closed: closed[i],
    current: i === current,
    weight: plan.weights[weekKey(days)] ?? 1,
    plan: emptyMetrics(),
    even: emptyMetrics(),
    fact: facts[i] ?? emptyMetrics(),
  }))

  // Ручной вес принадлежит неделе, а не её состоянию: неделя с множителем 0,5
  // держит свой половинный план и после закрытия, иначе задним числом окажется,
  // что она провалила план, которого ей не ставили
  const weightOf = (i: number) => rows[i].days * (plan.mode === 'manual' ? rows[i].weight : 1)
  const weightSum = rows.reduce((s, _, i) => s + weightOf(i), 0)

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
      if (r.closed) { r.plan[key] = weightSum > 0 ? total * (weightOf(i) / weightSum) : r.even[key]; done += r.fact[key] }
      else open.push(i)
    })

    const rest = Math.max(0, total - done)
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
