import { createAdminClient } from '@/lib/supabase/admin'

/** Стадия «Зарегистрировать на платформу» воронки «Зачисление в школу» — сюда попадает пришедший ученик. */
const ENROLL_STAGE = 'C4:PREPARATION'
/** Стадия «Запросили отчисление» воронки «Отчисление из школы» — отсюда начинается уход. */
const EXPEL_STAGE = 'C6:NEW'

/**
 * Поля «ФИО ученика 1…4» в сделке. В портале полно полей-дублей с теми же подписями,
 * поэтому коды зафиксированы явно, а не подбираются по названию.
 */
const FIO_FIELDS = [
  'UF_CRM_1761043335819',            // ФИО ученика 1 — Bitrix24
  'UF_CRM_1773315741761',            // ФИО ученика 2 — Bitrix24 [1]
  'UF_CRM_DEAL_AMO_NEAWBPRTCSDSACBA',// ФИО ученика 3
  'UF_CRM_DEAL_AMO_BBHGSHFHYFTCYIGD',// ФИО ученика 4 — AMO
]

type BitrixDeal = Record<string, string | null | undefined> & { ID: string; TITLE?: string }

async function webhookBase(): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin.from('app_settings').select('value').eq('key', 'bitrix_webhook').maybeSingle()
  if (!data?.value) throw new Error('Не задан вебхук Битрикса (app_settings.bitrix_webhook)')
  return data.value.replace(/\/$/, '')
}

async function bitrix<T>(method: string, params: Record<string, string>): Promise<T> {
  const base = await webhookBase()
  const res = await fetch(`${base}/${method}.json?${new URLSearchParams(params)}`, { cache: 'no-store' })
  const body = await res.json()
  if (body.error) throw new Error(`${method}: ${body.error_description ?? body.error}`)
  return body as T
}

type HistoryItem = { ID: number; OWNER_ID: number; CREATED_TIME: string; STAGE_ID: string }

async function stageHistory(stageId: string, fromIso: string): Promise<HistoryItem[]> {
  const out: HistoryItem[] = []
  let start = 0
  for (;;) {
    const body = await bitrix<{ result?: { items?: HistoryItem[] }; next?: number }>('crm.stagehistory.list', {
      entityTypeId: '2',
      'filter[STAGE_ID]': stageId,
      'filter[>=CREATED_TIME]': fromIso,
      'order[ID]': 'ASC',
      start: String(start),
    })
    out.push(...(body.result?.items ?? []))
    if (body.next === undefined) break
    start = body.next
  }
  return out
}

async function dealsByIds(ids: string[]): Promise<Map<string, BitrixDeal>> {
  const map = new Map<string, BitrixDeal>()
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const params: Record<string, string> = {}
    chunk.forEach((id, j) => { params[`filter[ID][${j}]`] = id })
    ;['ID', 'TITLE', ...FIO_FIELDS].forEach((f, j) => { params[`select[${j}]`] = f })
    const body = await bitrix<{ result?: BitrixDeal[] }>('crm.deal.list', params)
    for (const d of body.result ?? []) map.set(String(d.ID), d)
  }
  return map
}

function studentsOf(deal: BitrixDeal | undefined): string[] {
  if (!deal) return []
  return FIO_FIELDS
    .map(f => String(deal[f] ?? '').trim())
    .filter(Boolean)
}

/**
 * Забирает из Битрикса новые переходы по двум стадиям и пишет их в student_moves.
 * Повторный запуск безопасен: history_id уникален, уже известные переходы пропускаются.
 */
export async function syncStudentMoves(): Promise<{ enroll: number; expel: number; skipped: number }> {
  const admin = createAdminClient()

  const { data: baseline } = await admin
    .from('student_baseline')
    .select('as_of')
    .order('as_of', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Считаем только то, что произошло после отметки: она уже включает всех прежних учеников
  const from = baseline?.as_of ? `${baseline.as_of}T00:00:00+05:00` : '2026-09-30T00:00:00+05:00'

  const result = { enroll: 0, expel: 0, skipped: 0 }

  for (const [stage, kind] of [[ENROLL_STAGE, 'enroll'], [EXPEL_STAGE, 'expel']] as const) {
    const items = await stageHistory(stage, from)
    if (items.length === 0) continue

    const { data: known } = await admin
      .from('student_moves')
      .select('history_id')
      .in('history_id', items.map(i => i.ID))
    const knownIds = new Set((known ?? []).map((r: { history_id: number }) => Number(r.history_id)))

    const fresh = items.filter(i => !knownIds.has(Number(i.ID)))
    result.skipped += items.length - fresh.length
    if (fresh.length === 0) continue

    const deals = await dealsByIds([...new Set(fresh.map(i => String(i.OWNER_ID)))])

    const rows = fresh.map(i => {
      const deal = deals.get(String(i.OWNER_ID))
      const names = studentsOf(deal)
      return {
        history_id: i.ID,
        deal_id: i.OWNER_ID,
        kind,
        happened_at: i.CREATED_TIME,
        students: names.length,
        student_names: names,
        deal_title: deal?.TITLE ?? null,
      }
    })

    const { error } = await admin.from('student_moves').upsert(rows, { onConflict: 'history_id' })
    if (error) throw new Error(error.message)

    if (kind === 'enroll') result.enroll += rows.reduce((s, r) => s + r.students, 0)
    else result.expel += rows.reduce((s, r) => s + r.students, 0)
  }

  return result
}

export type StudentMove = {
  id: string
  deal_id: number
  kind: 'enroll' | 'expel'
  happened_at: string
  students: number
  student_names: string[]
  deal_title: string | null
}

export type StudentStats = {
  baselineTotal: number
  baselineDate: string
  /** Сколько учеников сейчас: отметка плюс все движения после неё */
  current: number
  /** За выбранный месяц */
  enrolled: number
  expelled: number
  net: number
  /** По дням месяца, для графика */
  days: { date: string; enrolled: number; expelled: number; total: number }[]
  moves: StudentMove[]
}

export async function getStudentStats(monthKey: string): Promise<StudentStats> {
  const admin = createAdminClient()

  const { data: baseline } = await admin
    .from('student_baseline')
    .select('as_of, total')
    .order('as_of', { ascending: false })
    .limit(1)
    .maybeSingle()

  const baselineTotal = baseline?.total ?? 0
  const baselineDate = baseline?.as_of ?? '2026-09-30'

  const { data: all } = await admin
    .from('student_moves')
    .select('id, deal_id, kind, happened_at, students, student_names, deal_title')
    .order('happened_at', { ascending: false })

  const moves = (all ?? []) as StudentMove[]

  const delta = moves.reduce((s, m) => s + (m.kind === 'enroll' ? m.students : -m.students), 0)
  const current = baselineTotal + delta

  const monthMoves = moves.filter(m => m.happened_at.slice(0, 7) === monthKey)
  const enrolled = monthMoves.filter(m => m.kind === 'enroll').reduce((s, m) => s + m.students, 0)
  const expelled = monthMoves.filter(m => m.kind === 'expel').reduce((s, m) => s + m.students, 0)

  // Численность на конец каждого дня месяца: идём от текущего значения назад
  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dayKeys = Array.from({ length: daysInMonth }, (_, i) =>
    `${monthKey}-${String(i + 1).padStart(2, '0')}`)

  const perDay = new Map<string, { enrolled: number; expelled: number }>()
  for (const m of monthMoves) {
    const day = m.happened_at.slice(0, 10)
    const cur = perDay.get(day) ?? { enrolled: 0, expelled: 0 }
    if (m.kind === 'enroll') cur.enrolled += m.students
    else cur.expelled += m.students
    perDay.set(day, cur)
  }

  // Движения ПОСЛЕ этого месяца вычитаем из текущего, чтобы получить значение на конец месяца
  const afterMonth = moves
    .filter(m => m.happened_at.slice(0, 7) > monthKey)
    .reduce((s, m) => s + (m.kind === 'enroll' ? m.students : -m.students), 0)
  let running = current - afterMonth

  const reversed: { date: string; enrolled: number; expelled: number; total: number }[] = []
  const today = new Date().toISOString().slice(0, 10)
  for (const day of [...dayKeys].reverse()) {
    if (day > today) continue
    const d = perDay.get(day) ?? { enrolled: 0, expelled: 0 }
    reversed.push({ date: day, enrolled: d.enrolled, expelled: d.expelled, total: running })
    running -= d.enrolled - d.expelled
  }

  return {
    baselineTotal,
    baselineDate,
    current,
    enrolled,
    expelled,
    net: enrolled - expelled,
    days: reversed.reverse(),
    moves: monthMoves,
  }
}
