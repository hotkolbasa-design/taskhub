'use client'

import { useState, useMemo, useCallback } from 'react'
import { PLAN_METRICS, planMetrics, throughput, buildWeekPlan, buildCapacity, neededHunters, neededSlots, planGap } from '@/lib/crm/plan'
import type { DashData, MonthPlan, PlanMetricKey } from '@/lib/crm/types'

const TODAY = new Date().toISOString().slice(0, 10)
const NF = new Intl.NumberFormat('ru-RU')

const n = (v: number) => NF.format(Math.round(v))
const thousands = (v: number) => NF.format(Math.round(v / 1000)) + 'к'
const pct = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',') + ' %'

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
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Смена месяца или пришедший с сервера план сбрасывают черновик — правка идёт от них
  const [syncedPlan, setSyncedPlan] = useState(data.plan)
  if (syncedPlan !== data.plan) {
    setSyncedPlan(data.plan)
    setDraft(data.plan)
    setDirty(false)
  }

  const patch = useCallback((p: Partial<MonthPlan>) => {
    setDraft(prev => ({ ...prev, ...p }))
    setDirty(true)
    setSaved(false)
  }, [])

  // Правка цели или конверсий означает, что человек хочет расчётную модель.
  // Пока в плане висят ручные значения (например, цель по заявкам из старого формата),
  // они перекрывают расчёт, и на экране цифры не двигаются — поэтому снимаем их.
  const patchModel = useCallback((p: Partial<MonthPlan>) => {
    setDraft(prev => ({ ...prev, ...p, manual: null }))
    setDirty(true)
    setSaved(false)
  }, [])

  const numField = (value: number, apply: (v: number) => void) => ({
    value: String(value).replace('.', ','),
    onChange: (raw: string) => {
      const v = parseFloat(raw.replace(',', '.'))
      if (Number.isFinite(v) && v > 0) apply(v)
    },
  })

  const metrics = useMemo(() => planMetrics(draft), [draft])
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
    try { await onSavePlan(draft); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    finally { setSaving(false) }
  }

  const frozen = data.frozen === true
  const closedCount = rows.filter(r => r.closed).length
  const future = (data.daysIso[0] ?? '') > TODAY

  return (
    <div>
      {/* ── 01 · План на месяц ─────────────────────────────────────────────── */}
      <SectionLabel n="01" label="План на месяц" />

      <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="text-xs leading-relaxed max-w-2xl" style={{ color: 'var(--text2)' }}>
            Цель по сделкам разворачивается вверх по воронке нормативами конверсии.
            {future
              ? ' Месяц ещё не начался — план можно выставить заранее, факт начнёт наполняться с первого числа.'
              : ` ${closedCount} из ${rows.length} недель закрыто — их факт уже учтён в разбивке ниже.`}
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
              {saving ? 'Сохраняем…' : saved ? 'План сохранён' : 'Сохранить план'}
            </button>
          )}
          {frozen && <span className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>Месяц заморожен — только просмотр</span>}
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <Field label="Сделки, цель" hint={`≈ ${Math.round(draft.target * 1.15)} учеников · 1,15 на сделку`} disabled={frozen}
            {...numField(draft.target, v => patchModel({ target: v }))} />
          <Field label="Заявка → назначено" hint="норматив 25 %, цель 30 %" disabled={frozen}
            {...numField(draft.conv.lead2app, v => patchModel({ conv: { ...draft.conv, lead2app: v } }))} />
          <Field label="Назначено → проведено" hint="норматив 75 %" disabled={frozen}
            {...numField(draft.conv.app2held, v => patchModel({ conv: { ...draft.conv, app2held: v } }))} />
          <Field label="Проведено → предоплата" hint="норматив 60–65 %" disabled={frozen}
            {...numField(draft.conv.held2pre, v => patchModel({ conv: { ...draft.conv, held2pre: v } }))} />
          <Field label="Предоплата → оплата" hint="норматив 80 %" disabled={frozen}
            {...numField(draft.conv.pre2paid, v => patchModel({ conv: { ...draft.conv, pre2paid: v } }))} />
          <Field label="Средний чек, ₸" hint="из факта прошлого месяца" disabled={frozen}
            {...numField(draft.check, v => patchModel({ check: v }))} />
          <Field label="CPL, потолок $" hint="цена заявки в CRM" disabled={frozen}
            {...numField(draft.cpl, v => patchModel({ cpl: v }))} />
        </div>

        <div className="grid gap-px mt-4 rounded-xl overflow-hidden" style={{ background: 'var(--border)', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
          {PLAN_METRICS.map(m => {
            const byHand = typeof draft.manual?.[m.key] === 'number'
            return (
              // подпись в две строки не должна опускать цифру: высота подписи фиксирована
              <div key={m.key} className="px-3 py-2.5 flex flex-col" style={{ background: 'var(--surface2)' }}>
                <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text2)', opacity: 0.75, minHeight: 30 }}>{m.name}</div>
                <div className="text-lg font-semibold mt-auto pt-0.5" style={{ color: m.key === 'paid' ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(m.key, metrics[m.key])}
                </div>
                {byHand && <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--yellow)' }}>задано вручную</div>}
              </div>
            )
          })}
        </div>

        <div className="text-xs mt-3" style={{ color: 'var(--text2)' }}>
          Сквозная конверсия заявки → оплата — <b style={{ color: 'var(--text)' }}>{pct(throughput(draft))}</b>.
          {' '}Цена клиента при этом плане — <b style={{ color: 'var(--text)' }}>${(metrics.budget / metrics.paid).toFixed(1).replace('.', ',')}</b>,
          {' '}выручка <b style={{ color: 'var(--text)' }}>{n(metrics.revenue)} ₸</b>.
        </div>
      </div>

      {/* ── 02 · Разбивка по неделям ───────────────────────────────────────── */}
      <SectionLabel n="02" label="Разбивка по неделям" />

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Seg
          value={draft.mode}
          onChange={id => patch({ mode: id as MonthPlan['mode'] })}
          options={[
            { id: 'even', label: 'Ровно по дням' },
            { id: 'catch', label: 'Догонять остатком' },
            { id: 'manual', label: 'Ручные веса' },
          ]}
        />
        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          {draft.mode === 'even' ? 'план делится пропорционально дням, факт на него не влияет'
            : draft.mode === 'catch' ? 'остаток месяца ложится на открытые недели'
            : 'вес недели меняется кликом по множителю в шапке'}
        </span>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
          <thead>
            <tr>
              <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider sticky left-0"
                style={{ color: 'var(--text2)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', minWidth: 190, zIndex: 1 }}>Метрика</th>
              {rows.map(r => (
                <th key={r.key} className="px-3 py-2.5 text-right"
                  style={{ background: r.current ? 'color-mix(in srgb, var(--accent) 10%, var(--surface2))' : 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{r.label}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text2)' }}>
                      {r.days} дн.{r.closed ? ' · закрыта' : r.current ? ' · идёт' : ''}
                    </span>
                    {draft.mode === 'manual' && !r.closed && !frozen && (
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
                      >×{String(r.weight).replace('.', ',')}</button>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider"
                style={{ color: 'var(--text2)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>Месяц</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_METRICS.map(m => (
              <tr key={m.key}>
                <td className="px-3 py-2.5 sticky left-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
                  <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{m.name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text2)' }}>{m.sub}</div>
                </td>
                {rows.map(r => {
                  const planned = r.plan[m.key]
                  const shift = planned - r.even[m.key]
                  const shifted = !r.closed && draft.mode !== 'even' && Math.abs(shift) >= Math.max(1, planned * 0.02)
                  const diff = r.fact[m.key] - planned
                  const factColor = diff >= 0 ? 'var(--green)' : (planned > 0 && r.fact[m.key] / planned >= 0.9 ? 'var(--text2)' : 'var(--red)')
                  return (
                    <td key={r.key} className="px-3 py-2.5 text-right"
                      style={{ borderBottom: '1px solid var(--border)', background: r.current ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent' }}>
                      <div className="text-sm" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: shifted ? 'var(--accent)' : 'var(--text)', fontWeight: shifted ? 600 : 400 }}>
                        {fmt(m.key, planned)}
                      </div>
                      {r.closed ? (
                        <div className="text-[10px] mt-0.5" style={{ color: factColor, fontFamily: 'var(--font-mono)' }}>
                          {fmt(m.key, r.fact[m.key])} · {diff >= 0 ? '+' : '−'}{fmt(m.key, Math.abs(diff))}
                        </div>
                      ) : shifted ? (
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                          {shift > 0 ? '+' : '−'}{fmt(m.key, Math.abs(shift))} к ровному
                        </div>
                      ) : null}
                    </td>
                  )
                })}
                <td className="px-3 py-2.5 text-right" style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                    {fmt(m.key, metrics[m.key])}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {closedCount > 0 && draft.mode !== 'even' && (
        gap > 0
          ? <Alert tone="warn" title={`Отставание ${gap} ${gap === 1 ? 'сделка' : gap < 5 ? 'сделки' : 'сделок'}`}>
              Разложено на {openWeeks} {openWeeks === 1 ? 'оставшуюся неделю' : 'оставшиеся недели'}: каждая получила примерно +{Math.ceil(gap / Math.max(1, openWeeks))} к ровному плану. Цель месяца не снижена.
            </Alert>
          : gap < 0
            ? <Alert tone="good" title={`Опережение на ${Math.abs(gap)}`}>
                Оставшимся неделям план снижен на ту же величину — темп не завышается искусственно.
              </Alert>
            : null
      )}

      <div className="text-xs mt-3 mb-6" style={{ color: 'var(--text2)' }}>
        У закрытой недели план показан для сравнения — в итог месяца идёт её факт. Поэтому сумма чисел по строке
        расходится с планом месяца ровно на величину недобора.
      </div>

      {/* ── 03 · Хватит ли мощности ────────────────────────────────────────── */}
      <SectionLabel n="03" label="Хватит ли мощности" />

      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <Field label="Ставок хантеров" hint="неполный день — долей" disabled={frozen}
            {...numField(draft.capacity.hunters, v => patch({ capacity: { ...draft.capacity, hunters: v } }))} />
          <Field label="Потолок заявок на ставку" hint="в неделю, со звонком" disabled={frozen}
            {...numField(draft.capacity.cap, v => patch({ capacity: { ...draft.capacity, cap: v } }))} />
          <Field label="Слотов собеседований в день" hint="все проводящие вместе" disabled={frozen}
            {...numField(draft.capacity.slots, v => patch({ capacity: { ...draft.capacity, slots: v } }))} />
          <Field label="Доля заявок со звонком, %" hint="остальные — без телефона" disabled={frozen}
            {...numField(draft.capacity.callable, v => patch({ capacity: { ...draft.capacity, callable: v } }))} />
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))' }}>
          {caps.map(c => (
            <div key={c.key} className="rounded-xl p-3.5" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                {c.label}{c.closed ? ' · факт' : ''}
              </div>
              <div className="text-base font-semibold mt-1" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {n(c.needLeads)} заявок
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                потолок {n(c.leadCap)} · загрузка {Math.round(c.leadLoad * 100)}&nbsp;%
              </div>
              <Bar load={c.leadLoad} />
              <div className="text-[10px] mt-2" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                {n(c.needSlots)} собеседований из {n(c.slotCap)} слотов · {Math.round(c.slotLoad * 100)}&nbsp;%
              </div>
              <Bar load={c.slotLoad} />
            </div>
          ))}
        </div>

        {overloaded.length > 0
          ? <Alert tone="bad" title={`Не влезает: ${overloaded.join(', ')}`}>
              Догоняющий план требует больше, чем отдел может обработать.
              {overLeads.length > 0 && <> По заявкам: нужно {String(needHunters).replace('.', ',')} ставки хантеров вместо {String(draft.capacity.hunters).replace('.', ',')}.</>}
              {overSlots.length > 0 && <> По собеседованиям: нужно {needSlots} слотов в день вместо {draft.capacity.slots} — узкое место здесь, а не в обзвоне.</>}
              {' '}Остальные выходы: снять часть заявок со слабого канала, растянуть догон на следующий месяц
              или признать, что цель месяца уезжает.
            </Alert>
          : <Alert tone="good" title="Нагрузка в пределах потолка">
              Пиковая неделя укладывается в {String(draft.capacity.hunters).replace('.', ',')} ставки хантеров
              и сетку в {draft.capacity.slots} слотов. Заявки сверх этого лучше не покупать — они лягут мёртвым грузом.
            </Alert>
        }
      </div>
    </div>
  )
}
