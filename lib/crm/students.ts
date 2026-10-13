import { createAdminClient } from '@/lib/supabase/admin'
import { getWeekGroups, formatWeek } from '@/lib/crm/utils'

/** Стадия «Зарегистрировать на платформу» воронки «Зачисление в школу» — сюда попадает пришедший ученик. */
const ENROLL_STAGE = 'C4:PREPARATION'
/** Стадия «Запросили отчисление» воронки «Отчисление из школы» — отсюда начинается уход. */
const EXPEL_STAGE = 'C6:NEW'

/**
 * «Полная оплата есть» — стадия воронки «Продажи», откуда робот переносит сделку в зачисление.
 * Настоящий новый ученик приходит только отсюда. В ту же стадию зачисления сделку заводят
 * руками из «Неразобранное» и «Новые написавшие номера», она возвращается из «Дубль» и
 * из более поздних стадий — такие переходы учеников не прибавляют.
 */
const PAID_STAGE = 'WON'

/**
 * Стадии, на которых человек числится учеником. Уход с них в «Запросили отчисление» —
 * настоящее отчисление, всё остальное — наведение порядка в карточках.
 *
 * Зачем список. 7–8 октября 2026 в отчисление разом отправили 40 старых сделок из
 * «Выбышие должники» и получили −47 учеников за два дня: эти люди давно не учились,
 * а часть из них уже проходила «Запросили отчисление» в 2025 году. Счётчик вычитал тех,
 * кого никогда не прибавлял. Поэтому список белый: незнакомая стадия ученика не убавляет,
 * а попадает в таблицу с причиной — так ошибка видна, а цифра не врёт.
 */
const STUDYING_STAGES = new Set([
  // Воронка «Все ученики» — человек числится учащимся, даже если с ним проблемы
  'C10:NEW',            // Все ученики
  'C10:UC_4H8JFQ',      // Перевод в школу
  'C10:UC_UX15KV',      // Проблема выявлена
  'C10:UC_PLVD7F',      // НЕ платят но учится
  'C10:UC_VOAXD6',      // Другая проблема
  'C10:UC_FJ1KSC',      // Кунделик проблемы
  'C10:UC_LY04JC',      // Проблема с Документами
  'C10:UC_V0349I',      // Хронические должники
  'C10:FINAL_INVOICE',  // Контроль Троечники
  'C10:UC_A8KV1C',      // Троечник хронические
  'C10:WON',            // Сделка успешна
  // Воронка «Зачисление в школу» — начиная с регистрации на платформе
  'C4:PREPARATION',     // Зарегистрировать на платформу
  'C4:EXECUTING',       // Запросили талон у школы
  'C4:FINAL_INVOICE',   // Талон отправлен родителю
  'C4:PREPAYMENT_INVOICE', // Логин и пароль выданы (платформа)
  'C4:UC_NKHND2',       // Загрузили скан документов
  'C4:UC_2XOB6S',       // Документы в дороге
  'C4:UC_5EE2XE',       // Документы и талон получены
  'C4:UC_WX35SX',       // Документы доставлены в школу
  'C4:UC_K2P3QE',       // Ученик прикреплен в школу
  'C4:WON',             // Зачисление завершено
])

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

/** Вся история стадий по списку сделок — по ней видно, откуда сделка пришла в зачисление. */
async function historyOfDeals(dealIds: string[]): Promise<Map<string, HistoryItem[]>> {
  const map = new Map<string, HistoryItem[]>()

  for (let i = 0; i < dealIds.length; i += 40) {
    const chunk = dealIds.slice(i, i + 40)
    const base: Record<string, string> = { entityTypeId: '2', 'order[ID]': 'ASC' }
    chunk.forEach((id, j) => { base[`filter[OWNER_ID][${j}]`] = id })

    let start = 0
    for (;;) {
      const body = await bitrix<{ result?: { items?: HistoryItem[] }; next?: number }>(
        'crm.stagehistory.list', { ...base, start: String(start) },
      )
      for (const it of body.result?.items ?? []) {
        const key = String(it.OWNER_ID)
        const list = map.get(key) ?? []
        list.push(it)
        map.set(key, list)
      }
      if (body.next === undefined) break
      start = body.next
    }
  }
  return map
}

/** Стадия, с которой сделка пришла в этот переход. null — если предыдущей записи нет. */
function originOf(item: { ID: number; OWNER_ID: number }, history: Map<string, HistoryItem[]>): string | null {
  const list = (history.get(String(item.OWNER_ID)) ?? []).slice().sort((a, b) => a.ID - b.ID)
  const idx = list.findIndex(x => x.ID === item.ID)
  return idx > 0 ? list[idx - 1].STAGE_ID : null
}

/** Была ли по этой сделке отметка об отчислении раньше — после последнего зачисления. */
function expelledBefore(item: { ID: number; OWNER_ID: number }, history: Map<string, HistoryItem[]>): boolean {
  const list = (history.get(String(item.OWNER_ID)) ?? []).slice().sort((a, b) => a.ID - b.ID)
  const idx = list.findIndex(x => x.ID === item.ID)
  if (idx <= 0) return false
  const before = list.slice(0, idx)
  const lastEnroll = before.map(x => x.STAGE_ID).lastIndexOf(ENROLL_STAGE)
  return before.slice(lastEnroll + 1).some(x => x.STAGE_ID === EXPEL_STAGE)
}

/** Человеческие названия стадий — чтобы в причине стояло «Выбышие должники», а не код. */
let stageNamesCache: Map<string, string> | null = null
async function stageNames(): Promise<Map<string, string>> {
  if (stageNamesCache) return stageNamesCache
  const map = new Map<string, string>()
  for (const entity of ['DEAL_STAGE', 'DEAL_STAGE_2', 'DEAL_STAGE_4', 'DEAL_STAGE_6', 'DEAL_STAGE_10']) {
    try {
      const body = await bitrix<{ result?: { STATUS_ID: string; NAME: string }[] }>(
        'crm.status.list', { 'filter[ENTITY_ID]': entity },
      )
      for (const s of body.result ?? []) map.set(s.STATUS_ID, s.NAME)
    } catch {
      // Названия — украшение причины, из-за них синхронизация падать не должна
    }
  }
  stageNamesCache = map
  return map
}

type Decision = { counted: boolean; reason: string | null }

/**
 * Решение, проставленное руками после сверки с выгрузкой платформы, сильнее автоматики:
 * стадия Битрикса говорит, где лежала карточка, а не учился ли человек на самом деле.
 */
function applyManual(auto: Decision, manual: boolean | null | undefined, manualReason: string | null): Decision {
  if (manual === null || manual === undefined) return auto
  return { counted: manual, reason: manual ? null : (manualReason ?? 'снято вручную после сверки') }
}

/**
 * Идёт ли движение в счёт. Правило несимметрично по смыслу, но симметрично по сути:
 * прибавляем только пришедших из оплаты, вычитаем только тех, кто до этого числился учеником.
 */
function decideMove(
  kind: 'enroll' | 'expel',
  opts: {
    deal: BitrixDeal | undefined
    names: string[]
    origin: string | null
    repeated: boolean
    active: Set<string>
    names2label: Map<string, string>
  },
): Decision {
  const { deal, names, origin, repeated, active, names2label } = opts
  const label = (code: string) => names2label.get(code) ?? code

  if (!deal) return { counted: false, reason: 'сделка удалена или объединена' }
  if (names.length === 0) return { counted: false, reason: 'в сделке не заполнено ни одного ФИО ученика' }

  if (kind === 'enroll') {
    if (origin !== PAID_STAGE) {
      return {
        counted: false,
        reason: origin
          ? `сделка пришла из «${label(origin)}», а не из «Полная оплата есть»`
          : 'у сделки нет предыдущей стадии — не из оплаты',
      }
    }
    if (names.every(n => active.has(normalizeName(n)))) {
      return { counted: false, reason: 'эти ученики уже числятся — похоже, дубль сделки' }
    }
    return { counted: true, reason: null }
  }

  // Отчисление. Если ученика прибавляли мы сами — вычитаем без оглядки на стадии
  if (names.some(n => active.has(normalizeName(n)))) return { counted: true, reason: null }
  if (!origin) return { counted: false, reason: 'у сделки нет предыдущей стадии — неизвестно, числился ли учеником' }
  if (!STUDYING_STAGES.has(origin)) {
    return { counted: false, reason: `пришёл из «${label(origin)}» — там ученик уже не числится` }
  }
  if (repeated) return { counted: false, reason: 'отчисление по этой сделке уже отмечали раньше' }
  return { counted: true, reason: null }
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

/** Сравниваем ФИО без учёта регистра и лишних пробелов — в Битриксе их пишут по-разному. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * ФИО детей из сделки, без повторов: одно и то же имя нередко вписано в два поля
 * (так «Ахметова Айжан» считалась за двоих), а два ребёнка с совпадающим ФИО не встречаются.
 */
function studentsOf(deal: BitrixDeal | undefined): string[] {
  if (!deal) return []
  const seen = new Set<string>()
  return FIO_FIELDS
    .map(f => String(deal[f] ?? '').trim())
    .filter(name => {
      if (!name) return false
      const key = normalizeName(name)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
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

    const dealIds = [...new Set(fresh.map(i => String(i.OWNER_ID)))]
    const deals = await dealsByIds(dealIds)
    // Откуда сделка пришла, важно в обе стороны: прибавляет только оплата,
    // убавляет только уход с тех стадий, где человек числился учеником
    const history = await historyOfDeals(dealIds)
    const labels = await stageNames()

    // Кто уже числится зачисленным: по этим именам повторный приход — дубль сделки,
    // а не второй ученик. В Битриксе дубли создаются и объединяются постоянно
    const { data: prior } = await admin
      .from('student_moves')
      .select('kind, happened_at, student_names')
      .eq('counted', true)
      .order('happened_at', { ascending: true })

    const active = new Set<string>()
    for (const m of (prior ?? []) as { kind: string; student_names: string[] }[]) {
      for (const name of m.student_names ?? []) {
        if (m.kind === 'enroll') active.add(normalizeName(name))
        else active.delete(normalizeName(name))
      }
    }

    const rows = fresh
      .sort((a, b) => a.CREATED_TIME.localeCompare(b.CREATED_TIME))
      .map(i => {
        const deal = deals.get(String(i.OWNER_ID))
        const names = studentsOf(deal)
        const origin = originOf(i, history)

        const { counted, reason: skipReason } = decideMove(kind, {
          deal, names, origin,
          repeated: kind === 'expel' && expelledBefore(i, history),
          active, names2label: labels,
        })

        if (counted) {
          for (const n of names) {
            if (kind === 'enroll') active.add(normalizeName(n))
            else active.delete(normalizeName(n))
          }
        }

        return {
          history_id: i.ID,
          deal_id: i.OWNER_ID,
          kind,
          happened_at: i.CREATED_TIME,
          students: counted ? names.length : 0,
          student_names: names,
          deal_title: deal?.TITLE ?? null,
          counted,
          skip_reason: skipReason,
          origin_stage: origin,
        }
      })

    const { error } = await admin.from('student_moves').upsert(rows, { onConflict: 'history_id' })
    if (error) throw new Error(error.message)

    if (kind === 'enroll') result.enroll += rows.reduce((s, r) => s + r.students, 0)
    else result.expel += rows.reduce((s, r) => s + r.students, 0)
  }

  await reviewRecentMoves()

  return result
}

/**
 * Пересчитывает все движения после отметки по текущим правилам.
 *
 * Нужна по двум причинам. Первая: сделку могли удалить или объединить уже ПОСЛЕ того,
 * как мы записали её переход. Вторая: правила меняются, и записанное вчера должно
 * пересчитаться сегодня — иначе в счёте остаются цифры по старому правилу.
 *
 * Идём строго по времени: решение по отчислению зависит от того, числится ли ученик,
 * а это зависит от предыдущих движений. Движений здесь немного — счёт ведётся от отметки.
 */
export async function reviewRecentMoves(): Promise<void> {
  const admin = createAdminClient()

  const { data: baseline } = await admin
    .from('student_baseline')
    .select('as_of')
    .order('as_of', { ascending: false })
    .limit(1)
    .maybeSingle()
  const since = baseline?.as_of ? `${baseline.as_of}T00:00:00+05:00` : '2026-09-30T00:00:00+05:00'

  const { data: recorded } = await admin
    .from('student_moves')
    .select('history_id, deal_id, kind, counted, students, skip_reason, origin_stage, manual_counted')
    .gte('happened_at', since)
    .order('happened_at', { ascending: true })
  if (!recorded || recorded.length === 0) return

  type Row = {
    history_id: number; deal_id: number; kind: 'enroll' | 'expel'
    counted: boolean; students: number; skip_reason: string | null; origin_stage: string | null
    manual_counted: boolean | null
  }
  const rows = recorded as Row[]
  const dealIds = [...new Set(rows.map(r => String(r.deal_id)))]
  const alive = await dealsByIds(dealIds)
  const history = await historyOfDeals(dealIds)
  const labels = await stageNames()

  const active = new Set<string>()

  for (const r of rows) {
    const deal = alive.get(String(r.deal_id))
    const names = studentsOf(deal)
    const item = { ID: r.history_id, OWNER_ID: r.deal_id }
    const origin = originOf(item, history)

    const { counted, reason } = applyManual(
      decideMove(r.kind, {
        deal, names, origin,
        repeated: r.kind === 'expel' && expelledBefore(item, history),
        active, names2label: labels,
      }),
      r.manual_counted,
      r.skip_reason,
    )

    if (counted) {
      for (const n of names) {
        if (r.kind === 'enroll') active.add(normalizeName(n))
        else active.delete(normalizeName(n))
      }
    }

    const students = counted ? names.length : 0
    const changed = r.counted !== counted || r.students !== students
      || r.skip_reason !== reason || r.origin_stage !== origin
    if (!changed) continue

    await admin
      .from('student_moves')
      .update({ counted, students, student_names: names, skip_reason: reason, origin_stage: origin })
      .eq('history_id', r.history_id)
  }
}

export type StudentMove = {
  id: string
  deal_id: number
  kind: 'enroll' | 'expel'
  happened_at: string
  students: number
  student_names: string[]
  deal_title: string | null
  counted: boolean
  skip_reason: string | null
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
  /** Те же данные, свёрнутые в недели пн–вс — как в остальных разрезах CRM */
  weeks: { label: string; from: string; to: string; enrolled: number; expelled: number; total: number }[]
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
    .select('id, deal_id, kind, happened_at, students, student_names, deal_title, counted, skip_reason')
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
    // До отметки численность неизвестна, а после сегодняшнего дня её ещё нет
    if (day > today || day < baselineDate) continue
    const d = perDay.get(day) ?? { enrolled: 0, expelled: 0 }
    reversed.push({ date: day, enrolled: d.enrolled, expelled: d.expelled, total: running })
    running -= d.enrolled - d.expelled
  }

  const days = reversed.reverse()

  // Недели считаем по тем же дням: приходы и уходы складываем,
  // численность берём на последний показанный день недели
  const byDay = new Map(days.map(d => [d.date, d]))
  const weeks = getWeekGroups(dayKeys)
    .map(group => {
      const shown = group.filter(d => byDay.has(d))
      if (shown.length === 0) return null
      const enrolledSum = shown.reduce((s, d) => s + (byDay.get(d)?.enrolled ?? 0), 0)
      const expelledSum = shown.reduce((s, d) => s + (byDay.get(d)?.expelled ?? 0), 0)
      return {
        label: formatWeek(group),
        from: group[0],
        to: group[group.length - 1],
        enrolled: enrolledSum,
        expelled: expelledSum,
        total: byDay.get(shown[shown.length - 1])?.total ?? 0,
      }
    })
    .filter((w): w is NonNullable<typeof w> => w !== null)

  return {
    baselineTotal,
    baselineDate,
    current,
    enrolled,
    expelled,
    net: enrolled - expelled,
    days,
    weeks,
    moves: monthMoves,
  }
}
