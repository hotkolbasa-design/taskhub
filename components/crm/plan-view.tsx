'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  PLAN_METRICS, planMetrics, throughput, buildWeekPlan, buildCapacity, neededHunters, neededSlots, planGap,
  applyMetricEdit, convDrift, monthFact, planToDate, metricStatus, forecastMonth, DEFAULT_PLAN,
} from '@/lib/crm/plan'
import type { DashData, MonthPlan, PlanMetricKey, PlanMetrics, MetricStatus, HunterStat, WeekPlanRow } from '@/lib/crm/types'
import { t, tc, plural, INTL_LOCALE, LOCALE } from '@/lib/i18n'

const TODAY = new Date().toISOString().slice(0, 10)
const NF = new Intl.NumberFormat(INTL_LOCALE)
const DEC = LOCALE === 'en' ? '.' : ','

const n = (v: number) => NF.format(Math.round(v))

const thousands = (v: number) => NF.format(Math.round(v / 1000)) + tc('crm', 'к')
const pct = (v: number) => String(Math.round(v * 10) / 10).replace('.', DEC) + ' %'

function fmt(key: PlanMetricKey, v: number): string {
  if (key === 'revenue') return thousands(v)
  if (key === 'budget') return '$' + n(v)
  return n(v)
}

function SectionLabel({ n: num, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text2)', opacity: 0.6 }}>{num} · {label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  )
}

function Field({ label, value, hint, onChange, disabled }: {
  label: string; value: string; hint: string; onChange: (v: string) => void; disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* фиксированная высота подписи держит поля на одной линии, даже когда подпись в две строки */}
      <label className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text2)', opacity: 0.75, minHeight: 30, display: 'flex', alignItems: 'flex-end' }}>{label}</label>
      <input
        type="text" inputMode="decimal" value={value} disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="px-2.5 py-2 rounded-lg text-sm outline-none w-full"
        style={{
          background: disabled ? 'transparent' : 'var(--surface2)',
          border: `1px solid ${disabled ? 'transparent' : 'var(--border)'}`,
          color: disabled ? 'var(--text2)' : 'var(--text)',
          fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
        }}
      />
      <span className="text-[10px]" style={{ color: 'var(--text2)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{hint}</span>
    </div>
  )
}

/** Совпадает ли черновик с сохранённым планом — по значениям, без оглядки на порядок ключей. */
function samePlan(a: MonthPlan, b: MonthPlan): boolean {
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-9
  return near(a.target, b.target)
    && near(a.check, b.check)
    && near(a.cpl, b.cpl)
    && a.mode === b.mode
    && (['lead2app', 'app2held', 'held2pre', 'pre2paid'] as const).every(k => near(a.conv[k], b.conv[k]))
    && (['hunters', 'cap', 'slots', 'callable'] as const).every(k => near(a.capacity[k], b.capacity[k]))
    && JSON.stringify(a.weights ?? {}) === JSON.stringify(b.weights ?? {})
    && JSON.stringify(a.manual ?? null) === JSON.stringify(b.manual ?? null)
}

function StatusMark({ status }: { status: MetricStatus }) {
  if (!status) return null
  const color = status === 'ok' ? 'var(--green)' : status === 'near' ? 'var(--yellow)' : 'var(--red)'
  const title = status === 'ok' ? t('план на сегодня выполнен') : status === 'near' ? t('почти по плану') : t('отстаём от плана на сегодня')
  return (
    <span title={title} aria-label={title} className="inline-flex items-center justify-center shrink-0"
      style={{ width: 14, height: 14, borderRadius: 7, background: color, color: '#fff', fontSize: 9, lineHeight: '14px', fontWeight: 700 }}>
      {status === 'behind' ? '✕' : status === 'near' ? '≈' : '✓'}
    </span>
  )
}

/**
 * Плитка метрики: план редактируется по клику, под ним факт месяца со значком.
 * Значок сравнивает факт не с планом месяца, а с планом на сегодня — иначе
 * первого числа всё было бы красным.
 */
function MetricTile({ metric, plan, fact, due, showFact, editable, onEdit }: {
  metric: { key: PlanMetricKey; name: string; lowerIsBetter?: boolean }
  plan: number
  fact: number
  due: number
  showFact: boolean
  editable: boolean
  onEdit: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  function commit() {
    const v = parseFloat(raw.replace(/\s/g, '').replace(',', '.'))
    if (Number.isFinite(v) && v > 0) onEdit(v)
    setEditing(false)
  }

  const status = showFact ? metricStatus(fact, due, metric.lowerIsBetter) : null

  return (
    <div className="px-3 py-2.5 flex flex-col" style={{ background: 'var(--surface2)' }}>
      {/* подпись в две строки не должна опускать цифру: высота подписи фиксирована */}
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text2)', opacity: 0.75, minHeight: 30 }}>{tc('crm', metric.name)}</div>

      <div className="mt-auto pt-0.5">
        {editing ? (
          <input
            autoFocus type="text" inputMode="decimal" value={raw}
            onChange={e => setRaw(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            className="w-full px-1.5 py-0.5 rounded outline-none text-lg font-semibold"
            style={{
              background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--text)',
              fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
            }}
          />
        ) : (
          <button
            onClick={() => { if (editable) { setRaw(String(Math.round(plan))); setEditing(true) } }}
            title={editable ? t('нажмите, чтобы поставить своё число') : undefined}
            className="text-lg font-semibold text-left w-full"
            style={{
              background: 'none', border: 'none', padding: 0,
              color: metric.key === 'paid' ? 'var(--accent)' : 'var(--text)',
              fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
              cursor: editable ? 'pointer' : 'default',
            }}
          >
            {fmt(metric.key, plan)}
          </button>
        )}
      </div>

      {showFact && (
        <div className="flex items-center gap-1.5 mt-1">
          <StatusMark status={status} />
          <span className="text-[11px]" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {t('факт {v}', { v: fmt(metric.key, fact) })}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Работа хантеров. План месяца делится между ними по долям ставки: у того, кто ещё и
 * проводит собеседования, половина времени уходит на них, поэтому заявок ему положено меньше.
 * Спрашиваем две разные вещи: выполнение своей доли плана и конверсию —
 * вторая не зависит от того, сколько заявок человеку досталось.
 */
function HuntersSection({ hunters, weeks, monthPlan, due, norm, heldNorm, future }: {
  hunters: HunterStat[]
  weeks: WeekPlanRow[]
  monthPlan: PlanMetrics
  due: PlanMetrics
  norm: number
  heldNorm: number
  future: boolean
}) {
  const shareSum = hunters.reduce((s, h) => s + h.share, 0) || 1
  const totalLeads = hunters.reduce((s, h) => s + h.leads.total, 0)
  const totalApp = hunters.reduce((s, h) => s + h.appointed.total, 0)
  const totalBooked = hunters.reduce((s, h) => s + h.bookedDeals, 0)
  const totalHeld = hunters.reduce((s, h) => s + h.heldDeals, 0)

  const cell = (fact: number, dueValue: number, planValue: number) => (
    <div className="flex flex-col items-end">
      <span className="text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
        {n(planValue)}
      </span>
      {!future && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <StatusMark status={metricStatus(fact, dueValue)} />
          <span className="text-[10px]" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
            {t('{a} из {b}', { a: n(fact), b: n(dueValue) })}
          </span>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <SectionLabel n="03" label={tc('crm', 'Хантеры')} />

      <p className="text-xs mb-4" style={{ color: 'var(--text2)' }}>
        {tc('crm', 'Сверху план, под ним факт со значком — как в таблицах выше. План месяца делится по долям ставки, а конверсия и доходимость от доли не зависят: это качество работы с теми заявками, что человеку достались.')}
      </p>

      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t('С начала месяца')}</h3>
        <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
          {t('«из N» — сколько должно быть к сегодняшнему дню, «месяц N» — за весь месяц')}
        </span>
      </div>

      <div className="rounded-2xl overflow-x-auto mb-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
          <thead>
            <tr>
              {['Хантер', 'Доля', 'Заявки', 'Назначено', 'Конверсия', 'Дошли до собеса', 'Должен был'].map((h, i) => (
                <th key={h} className={`px-3 py-2.5 text-[10px] uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}
                  style={{ color: 'var(--text2)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>{tc('crm', h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hunters.map(h => {
              const k = h.share / shareSum
              const conv = h.leads.total > 0 ? h.appointed.total / h.leads.total * 100 : 0
              const owed = h.leads.total * (norm / 100)
              const reach = h.bookedDeals > 0 ? h.heldDeals / h.bookedDeals * 100 : 0
              return (
                <tr key={h.name}>
                  <td className="px-3 py-2.5 text-sm" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{h.name}</td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                    {String(Math.round(k * 100))} %
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ borderBottom: '1px solid var(--border)' }}>
                    {cell(h.leads.total, due.leads * k, monthPlan.leads * k)}
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ borderBottom: '1px solid var(--border)' }}>
                    {cell(h.appointed.total, due.app * k, monthPlan.app * k)}
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="text-sm font-semibold" style={{
                      fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                      color: conv >= norm ? 'var(--green)' : conv >= norm * 0.7 ? 'var(--text)' : 'var(--red)',
                    }}>{pct(conv)}</span>
                    <div className="text-[10px]" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{t('норма {v}', { v: pct(norm) })}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="text-sm font-semibold" style={{
                      fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
                      color: h.bookedDeals === 0 ? 'var(--text2)'
                        : reach >= heldNorm ? 'var(--green)' : reach >= heldNorm * 0.8 ? 'var(--text)' : 'var(--red)',
                    }}>{h.bookedDeals > 0 ? pct(reach) : '—'}</span>
                    <div className="text-[10px]" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                      {h.bookedDeals > 0 ? t('{a} из {b}', { a: n(h.heldDeals), b: n(h.bookedDeals) }) : t('нет назначений')}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="text-sm" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{n(owed)}</span>
                    <div className="text-[10px]" style={{ color: h.appointed.total >= owed ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                      {h.appointed.total >= owed ? '+' : '−'}{n(Math.abs(h.appointed.total - owed))}
                    </div>
                  </td>
                </tr>
              )
            })}
            <tr>
              <td className="px-3 py-2.5 text-sm font-semibold" style={{ background: 'var(--surface2)', color: 'var(--text)' }}>{tc('crm', 'Итого')}</td>
              <td className="px-3 py-2.5 text-right text-xs" style={{ background: 'var(--surface2)', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>100 %</td>
              <td className="px-3 py-2.5 text-right text-sm font-semibold" style={{ background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{n(totalLeads)}</td>
              <td className="px-3 py-2.5 text-right text-sm font-semibold" style={{ background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{n(totalApp)}</td>
              <td className="px-3 py-2.5 text-right text-sm font-semibold" style={{ background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                {pct(totalLeads > 0 ? totalApp / totalLeads * 100 : 0)}
              </td>
              <td className="px-3 py-2.5 text-right text-sm font-semibold" style={{ background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                {totalBooked > 0 ? pct(totalHeld / totalBooked * 100) : '—'}
              </td>
              <td className="px-3 py-2.5 text-right text-sm" style={{ background: 'var(--surface2)', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                {n(totalLeads * (norm / 100))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-baseline justify-between gap-3 mb-2 mt-5 flex-wrap">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t('По неделям')}</h3>
        <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
          {t('назначенные собеседования · у будущих недель стоит только план, факт появится с её началом')}
        </span>
      </div>

      <div className="rounded-2xl overflow-x-auto mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--text2)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {tc('crm', 'Хантер')}
              </th>
              {weeks.map(w => (
                <th key={w.key} className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider"
                  style={{ color: 'var(--text2)', background: w.current ? 'color-mix(in srgb, var(--accent) 10%, var(--surface2))' : 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {w.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hunters.map(h => {
              const k = h.share / shareSum
              return (
                <tr key={h.name}>
                  <td className="px-3 py-2.5 text-sm" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{h.name}</td>
                  {weeks.map((w, i) => {
                    const planned = w.plan.app * k
                    const dueWeek = w.closed ? planned : planned * (w.workdays > 0 ? w.elapsedWork / w.workdays : 0)
                    const fact = h.appointed.weekValues[i] ?? 0
                    const started = w.elapsed > 0
                    return (
                      <td key={w.key} className="px-3 py-2.5 text-right"
                        style={{ borderBottom: '1px solid var(--border)', background: w.current ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent' }}>
                        <div className="text-sm" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                          {n(planned)}
                        </div>
                        {started && !future && (
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <StatusMark status={metricStatus(fact, dueWeek)} />
                            <span className="text-[10px]" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{n(fact)}</span>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Seg({ options, value, onChange }: {
  options: { id: string; label: string }[]; value: string; onChange: (id: string) => void
}) {
  return (
    <div className="inline-flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: value === o.id ? 'var(--accent)' : 'transparent',
            color: value === o.id ? '#fff' : 'var(--text2)',
            border: 'none', cursor: 'pointer',
          }}
        >{o.label}</button>
      ))}
    </div>
  )
}

function Alert({ tone, title, children }: { tone: 'good' | 'warn' | 'bad'; title: string; children: React.ReactNode }) {
  const color = tone === 'good' ? 'var(--green)' : tone === 'warn' ? 'var(--yellow)' : 'var(--red)'
  return (
    <div className="rounded-xl px-4 py-3 mt-3" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
      <div className="text-sm font-semibold mb-0.5" style={{ color }}>{title}</div>
      <div className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{children}</div>
    </div>
  )
}

function Bar({ load }: { load: number }) {
  const color = load > 1 ? 'var(--red)' : load > 0.85 ? 'var(--yellow)' : 'var(--green)'
  return (
    <div className="h-1.5 rounded mt-2 overflow-hidden" style={{ background: 'var(--border)' }}>
      <div className="h-full rounded" style={{ width: `${Math.min(100, Math.round(load * 100))}%`, background: color, transition: 'width .25s ease' }} />
    </div>
  )
}

export function PlanView({ data, onSavePlan }: { data: DashData; onSavePlan: (plan: MonthPlan) => Promise<void> }) {
  const [draft, setDraft] = useState<MonthPlan>(data.plan)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Смена месяца или пришедший с сервера план сбрасывают черновик — правка идёт от них
  const [syncedPlan, setSyncedPlan] = useState(data.plan)
  if (syncedPlan !== data.plan) {
    setSyncedPlan(data.plan)
    setDraft(data.plan)
  }

  // Кнопка живёт от сравнения с сохранённым, а не от флага: после «Вернуть нормативы»
  // значения снова совпадают с серверными, и сохранять нечего
  const dirty = !samePlan(draft, data.plan)

  const patch = useCallback((p: Partial<MonthPlan>) => {
    setDraft(prev => ({ ...prev, ...p }))
    setSaved(false)
  }, [])

  // Правка цели или конверсий означает, что человек хочет расчётную модель.
  // Пока в плане висят ручные значения (например, цель по заявкам из старого формата),
  // они перекрывают расчёт, и на экране цифры не двигаются — поэтому снимаем их.
  const patchModel = useCallback((p: Partial<MonthPlan>) => {
    setDraft(prev => ({ ...prev, ...p, manual: null }))
    setSaved(false)
  }, [])

  // Показываем два знака: после правки заявок конверсия приходит как 24,074074074074076.
  // Округляем только на экране — в модели точное значение, иначе соседние ступени сдвинутся.
  const numField = (value: number, apply: (v: number) => void) => ({
    value: String(Math.round(value * 100) / 100).replace('.', DEC),
    onChange: (raw: string) => {
      const v = parseFloat(raw.replace(',', '.'))
      if (Number.isFinite(v) && v > 0) apply(v)
    },
  })

  const metrics = useMemo(() => planMetrics(draft), [draft])
  const fact = useMemo(() => monthFact(data), [data])
  const due = useMemo(() => planToDate(draft, data, TODAY), [draft, data])
  const forecast = useMemo(() => forecastMonth(fact, data, TODAY), [fact, data])
  const drift = useMemo(() => convDrift(draft), [draft])
  const rows = useMemo(() => buildWeekPlan(data, draft, TODAY), [data, draft])
  const caps = useMemo(() => buildCapacity(rows, draft), [rows, draft])
  const { gap, openWeeks } = useMemo(() => planGap(rows), [rows])
  const needHunters = useMemo(() => neededHunters(rows, draft), [rows, draft])
  const needSlots = useMemo(() => neededSlots(rows), [rows])
  const overLeads = caps.filter(c => !c.closed && c.leadLoad > 1)
  const overSlots = caps.filter(c => !c.closed && c.slotLoad > 1)
  const overloaded = [...new Set([...overLeads, ...overSlots].map(c => c.label))]

  async function save() {
    setSaving(true)
    try { await onSavePlan(draft); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    finally { setSaving(false) }
  }

  const frozen = data.frozen === true
  const closedCount = rows.filter(r => r.closed).length
  const future = (data.daysIso[0] ?? '') > TODAY

  return (
    <div>
      {/* ── 01 · План на месяц ─────────────────────────────────────────────── */}
      <SectionLabel n="01" label={t('План на месяц')} />

      <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="text-xs leading-relaxed max-w-2xl" style={{ color: 'var(--text2)' }}>
            {t('Цель по сделкам разворачивается вверх по воронке нормативами конверсии.')}
            {future
              ? t(' Месяц ещё не начался — план можно выставить заранее, факт начнёт наполняться с первого числа.')
              : t(' {closed} из {total} недель закрыто — их факт уже учтён в разбивке ниже.', { closed: closedCount, total: rows.length })}
          </div>
          {!frozen && (
            <button onClick={save} disabled={!dirty || saving}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              style={{
                background: dirty ? 'var(--accent)' : 'var(--surface2)',
                color: dirty ? '#fff' : 'var(--text2)',
                border: '1px solid ' + (dirty ? 'var(--accent)' : 'var(--border)'),
                cursor: dirty && !saving ? 'pointer' : 'default',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              {saving ? t('Сохраняем…') : saved ? t('План сохранён') : t('Сохранить план')}
            </button>
          )}
          {frozen && <span className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{t('Месяц заморожен — только просмотр')}</span>}
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <Field label={t('Сделки, цель')} hint={t('≈ {n} учеников · 1,15 на сделку', { n: Math.round(draft.target * 1.15) })} disabled={frozen}
            {...numField(draft.target, v => patchModel({ target: v }))} />
          <Field label={tc('crm', 'Заявка → назначено')} hint={t('норматив 25 %, цель 30 %')} disabled={frozen}
            {...numField(draft.conv.lead2app, v => patchModel({ conv: { ...draft.conv, lead2app: v } }))} />
          <Field label={t('Назначено → проведено')} hint={t('норматив 75 %')} disabled={frozen}
            {...numField(draft.conv.app2held, v => patchModel({ conv: { ...draft.conv, app2held: v } }))} />
          <Field label={t('Проведено → предоплата')} hint={t('норматив 60–65 %')} disabled={frozen}
            {...numField(draft.conv.held2pre, v => patchModel({ conv: { ...draft.conv, held2pre: v } }))} />
          <Field label={t('Предоплата → оплата')} hint={t('норматив 80 %')} disabled={frozen}
            {...numField(draft.conv.pre2paid, v => patchModel({ conv: { ...draft.conv, pre2paid: v } }))} />
          <Field label={t('Средний чек, ₸')} hint={t('из факта прошлого месяца')} disabled={frozen}
            {...numField(draft.check, v => patchModel({ check: v }))} />
          <Field label={t('CPL, потолок $')} hint={tc('crm', 'цена заявки в CRM')} disabled={frozen}
            {...numField(draft.cpl, v => patchModel({ cpl: v }))} />
        </div>

        <div className="grid gap-px mt-4 rounded-xl overflow-hidden" style={{ background: 'var(--border)', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
          {PLAN_METRICS.map(m => (
            <MetricTile
              key={m.key}
              metric={m}
              plan={metrics[m.key]}
              fact={fact[m.key]}
              due={due[m.key]}
              showFact={!future}
              editable={!frozen}
              onEdit={v => patch(applyMetricEdit(draft, m.key, v))}
            />
          ))}
        </div>

        <div className="text-xs mt-3" style={{ color: 'var(--text2)' }}>
          {tc('crm', 'Сквозная конверсия заявки → оплата —')} <b style={{ color: 'var(--text)' }}>{pct(throughput(draft))}</b>.
          {' '}{t('Цена клиента при этом плане —')} <b style={{ color: 'var(--text)' }}>${(metrics.budget / metrics.paid).toFixed(1).replace('.', DEC)}</b>,
          {' '}{tc('crm', 'выручка')} <b style={{ color: 'var(--text)' }}>{n(metrics.revenue)} ₸</b>.
          {!future && fact.leads > 0 && (
            <> {t('При сегодняшнем темпе месяц закончится на')} <b style={{ color: forecast.paid >= metrics.paid ? 'var(--green)' : 'var(--red)' }}>{n(forecast.paid)} {plural(Math.round(forecast.paid), 'сделке', 'сделках', 'сделках', 'crm')}</b> {t('против плана {n}.', { n: n(metrics.paid) })}</>
          )}
        </div>

        {drift.length > 0 && !frozen && (
          <div className="flex items-start gap-2 mt-3 flex-wrap text-xs" style={{ color: 'var(--text2)' }}>
            <span>
              {t('Ручная правка увела конверсии от норматива:')}{' '}
              {drift.map((d, i) => (
                <span key={d.key}>
                  {i > 0 && ', '}
                  <b style={{ color: 'var(--yellow)' }}>{tc('crm', d.label)} {pct(d.value)}</b> {t('вместо {v}', { v: pct(d.norm) })}
                </span>
              ))}.
            </span>
            <button onClick={() => patch({ conv: { ...DEFAULT_PLAN.conv } })}
              className="px-2 py-0.5 rounded text-[11px]"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
            >
              {t('Вернуть нормативы')}
            </button>
          </div>
        )}
      </div>

      {/* ── 02 · Разбивка по неделям ───────────────────────────────────────── */}
      <SectionLabel n="02" label={t('Разбивка по неделям')} />

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Seg
          value={draft.mode}
          onChange={id => patch({ mode: id as MonthPlan['mode'] })}
          options={[
            { id: 'even', label: t('Ровно по дням') },
            { id: 'catch', label: t('Догонять остатком') },
            { id: 'manual', label: t('Ручные веса') },
          ]}
        />
        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          {draft.mode === 'even' ? t('план делится пропорционально дням, факт на него не влияет')
            : draft.mode === 'catch' ? t('остаток месяца ложится на открытые недели')
            : t('вес недели меняется кликом по множителю в шапке')}
        </span>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
          <thead>
            <tr>
              <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider sticky left-0"
                style={{ color: 'var(--text2)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', minWidth: 190, zIndex: 1 }}>{tc('crm', 'Метрика')}</th>
              {rows.map(r => (
                <th key={r.key} className="px-3 py-2.5 text-right"
                  style={{ background: r.current ? 'color-mix(in srgb, var(--accent) 10%, var(--surface2))' : 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{r.label}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text2)' }}>
                      {t('{n} дн.', { n: r.days })}{r.closed ? t(' · закрыта') : r.current ? t(' · идёт') : ''}
                    </span>
                    {/* множитель виден и у закрытой недели: он объясняет её план */}
                    {draft.mode === 'manual' && !frozen && (
                      <button
                        onClick={() => {
                          const cycle = [1, 1.25, 1.5, 0.5]
                          const next = cycle[(cycle.indexOf(r.weight) + 1) % cycle.length]
                          patch({ weights: { ...draft.weights, [r.key]: next } })
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          background: r.weight !== 1 ? 'var(--accent)' : 'transparent',
                          color: r.weight !== 1 ? '#fff' : 'var(--text2)',
                          border: '1px solid ' + (r.weight !== 1 ? 'var(--accent)' : 'var(--border)'),
                          cursor: 'pointer',
                        }}
                      >×{String(r.weight).replace('.', DEC)}</button>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--text2)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>{tc('crm', 'Месяц')}</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_METRICS.map(m => (
              <tr key={m.key}>
                <td className="px-3 py-2.5 sticky left-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
                  <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{tc('crm', m.name)}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text2)' }}>{tc('crm', m.sub)}</div>
                </td>
                {rows.map(r => {
                  const planned = r.plan[m.key]
                  const shift = planned - r.even[m.key]
                  const shifted = !r.closed && draft.mode !== 'even' && Math.abs(shift) >= Math.max(1, planned * 0.02)
                  const factValue = r.fact[m.key]
                  const diff = factValue - planned
                  // У идущей недели спрашиваем не весь её план, а долю по прошедшим дням.
                  // Для продаж день считается только будний: в выходные их не бывает
                  const unitsTotal = m.everyDay ? r.days : r.workdays
                  const unitsPassed = m.everyDay ? r.elapsed : r.elapsedWork
                  const weekDue = r.closed ? planned : planned * (unitsTotal > 0 ? unitsPassed / unitsTotal : 0)
                  const started = r.elapsed > 0
                  return (
                    <td key={r.key} className="px-3 py-2.5 text-right"
                      style={{ borderBottom: '1px solid var(--border)', background: r.current ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent' }}>
                      <div className="text-sm" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: shifted ? 'var(--accent)' : 'var(--text)', fontWeight: shifted ? 600 : 400 }}>
                        {fmt(m.key, planned)}
                      </div>

                      {started && (
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <StatusMark status={metricStatus(factValue, weekDue, m.lowerIsBetter)} />
                          <span className="text-[10px]" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                            {fmt(m.key, factValue)}
                            {r.closed && <> · {diff >= 0 ? '+' : '−'}{fmt(m.key, Math.abs(diff))}</>}
                          </span>
                        </div>
                      )}

                      {!r.closed && shifted && (
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text2)', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
                          {shift > 0 ? '+' : '−'}{fmt(m.key, Math.abs(shift))} {t('к ровному')}
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-2.5 text-right" style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                    {fmt(m.key, metrics[m.key])}
                  </span>
                  {!future && (
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <StatusMark status={metricStatus(fact[m.key], due[m.key], m.lowerIsBetter)} />
                      <span className="text-[10px]" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                        {fmt(m.key, fact[m.key])}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {closedCount > 0 && draft.mode !== 'even' && (
        gap > 0
          ? <Alert tone="warn" title={t('Отставание {n} {deals}', { n: gap, deals: gap === 1 ? tc('crm', 'сделка') : gap < 5 ? tc('crm', 'сделки') : tc('crm', 'сделок') })}>
              {t('Разложено на {n} {weeks}: каждая получила примерно +{x} к ровному плану. Цель месяца не снижена.', { n: openWeeks, weeks: openWeeks === 1 ? t('оставшуюся неделю') : t('оставшиеся недели'), x: Math.ceil(gap / Math.max(1, openWeeks)) })}
            </Alert>
          : gap < 0
            ? <Alert tone="good" title={t('Опережение на {n}', { n: Math.abs(gap) })}>
                {t('Оставшимся неделям план снижен на ту же величину — темп не завышается искусственно.')}
              </Alert>
            : null
      )}

      <div className="text-xs mt-3 mb-6" style={{ color: 'var(--text2)' }}>
        {t('У закрытой недели план показан для сравнения — в итог месяца идёт её факт. Поэтому сумма чисел по строке расходится с планом месяца ровно на величину недобора.')}
      </div>

      {/* ── 03 · Хантеры ───────────────────────────────────────────────────── */}
      {data.hunters?.length > 0 && (
        <HuntersSection
          hunters={data.hunters}
          weeks={rows}
          monthPlan={metrics}
          due={due}
          norm={draft.conv.lead2app}
          heldNorm={draft.conv.app2held}
          future={future}
        />
      )}

      {/* ── 04 · Хватит ли мощности ────────────────────────────────────────── */}
      <SectionLabel n="04" label={t('Хватит ли мощности')} />

      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <Field label={t('Ставок хантеров')} hint={t('неполный день — долей')} disabled={frozen}
            {...numField(draft.capacity.hunters, v => patch({ capacity: { ...draft.capacity, hunters: v } }))} />
          <Field label={tc('crm', 'Потолок заявок на ставку')} hint={t('в неделю, со звонком')} disabled={frozen}
            {...numField(draft.capacity.cap, v => patch({ capacity: { ...draft.capacity, cap: v } }))} />
          <Field label={t('Слотов собеседований в день')} hint={t('все проводящие вместе')} disabled={frozen}
            {...numField(draft.capacity.slots, v => patch({ capacity: { ...draft.capacity, slots: v } }))} />
          <Field label={tc('crm', 'Доля заявок со звонком, %')} hint={t('остальные — без телефона')} disabled={frozen}
            {...numField(draft.capacity.callable, v => patch({ capacity: { ...draft.capacity, callable: v } }))} />
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))' }}>
          {caps.map(c => (
            <div key={c.key} className="rounded-xl p-3.5" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                {c.label}{c.closed ? t(' · факт') : ''}
              </div>
              <div className="text-base font-semibold mt-1" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {tc('crm', '{n} заявок', { n: n(c.needLeads) })}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                {t('потолок {cap} · загрузка {load}', { cap: n(c.leadCap), load: Math.round(c.leadLoad * 100) })}&nbsp;%
              </div>
              <Bar load={c.leadLoad} />
              <div className="text-[10px] mt-2" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                {t('{need} собеседований из {cap} слотов · {load}', { need: n(c.needSlots), cap: n(c.slotCap), load: Math.round(c.slotLoad * 100) })}&nbsp;%
              </div>
              <Bar load={c.slotLoad} />
            </div>
          ))}
        </div>

        {overloaded.length > 0
          ? <Alert tone="bad" title={t('Не влезает: {weeks}', { weeks: overloaded.join(', ') })}>
              {t('Догоняющий план требует больше, чем отдел может обработать.')}
              {overLeads.length > 0 && <> {tc('crm', 'По заявкам: нужно {need} ставки хантеров вместо {have}.', { need: String(needHunters).replace('.', DEC), have: String(draft.capacity.hunters).replace('.', DEC) })}</>}
              {overSlots.length > 0 && <> {t('По собеседованиям: нужно {need} слотов в день вместо {have} — узкое место здесь, а не в обзвоне.', { need: needSlots, have: draft.capacity.slots })}</>}
              {' '}{tc('crm', 'Остальные выходы: снять часть заявок со слабого канала, растянуть догон на следующий месяц или признать, что цель месяца уезжает.')}
            </Alert>
          : <Alert tone="good" title={t('Нагрузка в пределах потолка')}>
              {tc('crm', 'Пиковая неделя укладывается в {fte} ставки хантеров и сетку в {slots} слотов. Заявки сверх этого лучше не покупать — они лягут мёртвым грузом.', { fte: String(draft.capacity.hunters).replace('.', DEC), slots: draft.capacity.slots })}
            </Alert>
        }
      </div>
    </div>
  )
}
