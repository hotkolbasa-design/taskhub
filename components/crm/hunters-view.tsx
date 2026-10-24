'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { HunterReport, HunterDay, HunterPlan } from '@/lib/crm/types'
import { t, tc, INTL_LOCALE, LOCALE } from '@/lib/i18n'

const COLORS = ['var(--accent)', 'var(--green)', 'var(--yellow)']
const NF = new Intl.NumberFormat(INTL_LOCALE)
const DEC = LOCALE === 'en' ? '.' : ','
const n = (v: number) => NF.format(Math.round(v))
const TONE = { ok: 'var(--green)', near: 'var(--yellow)', bad: 'var(--red)' } as const
type Status = keyof typeof TONE | null

const isoWeekday = (iso: string) => (new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7
const isWeekend = (iso: string) => isoWeekday(iso) >= 5
const workDaysIn = (list: string[]) => list.filter(d => !isWeekend(d)).length

type Row = {
  key: string
  label: string
  get?: (d: HunterDay) => number | null
  num?: (d: HunterDay) => number
  den?: (d: HunterDay) => number
  agg: 'sum' | 'avg' | 'med' | 'ratio'
  plan?: keyof HunterPlan
  normKey?: keyof HunterPlan
  lower?: boolean
  decimals?: number
  suffix?: string
  conv?: boolean
}

const GROUPS: { title: string; hint: string; rows: Row[] }[] = [
  { title: 'Звонки', hint: 'сколько набрал, сколько раз поговорил и сколько наговорил минут', rows: [
    { key: 'calls', label: 'наборов', get: d => d.calls, agg: 'sum', plan: 'calls' },
    { key: 'talks', label: 'разговоров', get: d => d.talks, agg: 'sum', plan: 'talks' },
    { key: 'minutes', label: 'минут', get: d => d.minutes, agg: 'sum', plan: 'minutes' },
    { key: 'dozvon', label: 'дозвон', agg: 'ratio', num: d => d.talks, den: d => d.calls, normKey: 'dozvon', suffix: ' %', conv: true },
  ] },
  { title: 'Собеседования', hint: 'от полученной заявки до состоявшейся встречи, с конверсией на каждом переходе', rows: [
    { key: 'leads', label: 'лидов получил', get: d => d.leads, agg: 'sum', plan: 'leads' },
    { key: 'conv1', label: '→ назначил', agg: 'ratio', num: d => d.booked, den: d => d.leads, normKey: 'conv1', suffix: ' %', conv: true },
    { key: 'booked', label: 'назначено', get: d => d.booked, agg: 'sum', plan: 'booked' },
    { key: 'conv2', label: '→ дошли', agg: 'ratio', num: d => d.held, den: d => d.booked, normKey: 'conv2', suffix: ' %', conv: true },
    { key: 'held', label: 'проведено', get: d => d.held, agg: 'sum' },
  ] },
  { title: 'Качество работы', hint: 'скорость первого набора в рабочее время и оценка разговора по скрипту', rows: [
    { key: 'reactWork', label: 'реакция, мин', get: d => d.reactWork, agg: 'med', normKey: 'reactWork', lower: true },
    { key: 'score', label: 'балл за скрипт', get: d => d.score, agg: 'avg', normKey: 'score', decimals: 1 },
  ] },
]

const PLAN_FIELDS: { key: keyof HunterPlan; label: string }[] = [
  { key: 'leads', label: 'Лидов' }, { key: 'calls', label: 'Наборов' },
  { key: 'talks', label: 'Разговоров' }, { key: 'minutes', label: 'Минут' }, { key: 'booked', label: 'Назначено' },
]
const NORM_FIELDS: { key: keyof HunterPlan; label: string }[] = [
  { key: 'dozvon', label: 'Дозвон, %' }, { key: 'conv1', label: 'Лид → назначил, %' },
  { key: 'conv2', label: 'Назначено → дошли, %' }, { key: 'reactWork', label: 'Реакция, мин' }, { key: 'score', label: 'Балл' },
]

export function HuntersView({ monthKey }: { monthKey: string }) {
  const [report, setReport] = useState<HunterReport | null>(null)
  const [plans, setPlans] = useState<Record<string, HunterPlan>>({})
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (fresh = false) => {
    setBusy(true); setError('')
    try {
      const r = await fetch(`/api/crm?action=hunters&month=${monthKey}${fresh ? '&fresh=1' : ''}`).then(x => x.json())
      if (r?.error) { setError(String(r.error)); return }
      setReport(r); setPlans(r.plans ?? {})
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }, [monthKey])

  // Загрузка отвязана от рендера: состояние меняется уже после ответа сервера
  useEffect(() => {
    let alive = true
    fetch(`/api/crm?action=hunters&month=${monthKey}`)
      .then(x => x.json())
      .then(r => {
        if (!alive) return
        if (r?.error) setError(String(r.error))
        else { setReport(r); setPlans(r.plans ?? {}) }
      })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)) })
    return () => { alive = false }
  }, [monthKey])

  const savePlans = useCallback(async (next: Record<string, HunterPlan>) => {
    setPlans(next); setSaving(true)
    try {
      await fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveHunterPlans', plans: next }) })
    } finally { setSaving(false) }
  }, [])

  // Дни, в которые хоть кто-то звонил: пустые числа месяца не рисуем,
  // иначе будущее выглядит как провал плана
  const days = useMemo(() => {
    if (!report) return []
    return report.days.filter(d => report.hunters.some(h => (h.days.find(x => x.date === d)?.calls ?? 0) > 0))
  }, [report])

  const weeks = useMemo(() => {
    const out: { key: string; days: string[] }[] = []
    days.forEach(iso => {
      const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - isoWeekday(iso))
      const key = d.toISOString().slice(0, 10)
      const w = out.find(x => x.key === key)
      if (w) w.days.push(iso); else out.push({ key, days: [iso] })
    })
    return out.sort((a, b) => a.key.localeCompare(b.key))
  }, [days])

  if (!report && !error) return (
    <div className="flex items-center justify-center py-20 gap-3">
      <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
      <span className="text-sm" style={{ color: 'var(--text2)' }}>{t('Собираем звонки и разборы…')}</span>
    </div>
  )
  if (error) return <p className="text-sm py-6" style={{ color: 'var(--red)' }}>{t('Не удалось загрузить: {error}', { error })}</p>
  if (!report || !report.hunters.length) return <p className="text-sm py-6" style={{ color: 'var(--text2)' }}>{t('Хантеры не заданы в настройках.')}</p>

  const planOf = (name: string, key: keyof HunterPlan) => plans[name]?.[key] ?? 0
  const live = (d?: HunterDay) => Boolean(d && d.calls > 0)

  function dayVal(h: HunterReport['hunters'][0], row: Row, iso: string): number | null {
    const d = h.days.find(x => x.date === iso)
    if (!live(d)) return null
    if (row.agg === 'ratio') { const den = row.den!(d!); return den ? row.num!(d!) / den * 100 : null }
    return row.get!(d!)
  }
  function rangeVal(h: HunterReport['hunters'][0], row: Row, list: string[]): number | null {
    const ds = list.map(iso => h.days.find(x => x.date === iso)).filter(live) as HunterDay[]
    if (!ds.length) return null
    if (row.agg === 'ratio') {
      const den = ds.reduce((s, d) => s + row.den!(d), 0)
      return den ? ds.reduce((s, d) => s + row.num!(d), 0) / den * 100 : null
    }
    const vals = ds.map(row.get!).filter((v): v is number => v != null)
    if (!vals.length) return null
    if (row.agg === 'sum') return vals.reduce((s, v) => s + v, 0)
    if (row.agg === 'avg') return vals.reduce((s, v) => s + v, 0) / vals.length
    const s = [...vals].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]
  }
  const fmt = (row: Row, v: number | null) => v == null ? ''
    : row.agg === 'ratio' ? Math.round(v) + (row.suffix ?? '')
    : row.decimals ? String(Math.round(v * 10) / 10).replace('.', DEC) : n(v)

  function targetFor(row: Row, list: string[], name: string): number | null {
    if (row.plan && planOf(name, row.plan) > 0) return planOf(name, row.plan) * Math.max(1, workDaysIn(list))
    if (row.normKey && planOf(name, row.normKey) > 0) return planOf(name, row.normKey)
    return null
  }
  function statusOf(row: Row, v: number | null, list: string[], name: string): Status {
    if (v == null) return null
    const t = targetFor(row, list, name)
    if (t == null) return null
    const ratio = row.lower ? t / v : v / t
    return ratio >= 1 ? 'ok' : ratio >= 0.7 ? 'near' : 'bad'
  }
  const cellBg = (st: Status, weekend: boolean, strength: number) =>
    weekend ? 'transparent' : st ? `color-mix(in srgb, ${TONE[st]} ${strength}%, transparent)` : 'transparent'

  return (
    <div>
      <PlanPanel
        hunters={report.hunters} plans={plans} saving={saving} days={days}
        onChange={(name, key, value) => savePlans({ ...plans, [name]: { ...plans[name], [key]: value } })}
      />

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(224px,1fr))' }}>
        {report.hunters.map((h, hi) => {
          const calls = rangeVal(h, GROUPS[0].rows[0], days) ?? 0
          const target = targetFor(GROUPS[0].rows[0], days, h.name)
          const share = target ? Math.round(calls / target * 100) : null
          const st = statusOf(GROUPS[0].rows[0], calls, days, h.name)
          const booked = rangeVal(h, GROUPS[1].rows[2], days) ?? 0
          const held = rangeVal(h, GROUPS[1].rows[4], days) ?? 0
          return (
            <div key={h.name} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${COLORS[hi % 3]}` }}>
              <div className="font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{h.short}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{n(calls)}</span>
                <span className="text-xs" style={{ color: 'var(--text2)' }}>{tc('crm', 'наборов')}{target ? t(' из {n}', { n: n(target) }) : ''}</span>
              </div>
              {share != null && (
                <>
                  <div className="h-1.5 rounded mt-2 mb-1.5 overflow-hidden" style={{ background: 'var(--surface2)' }}>
                    <div className="h-full rounded" style={{ width: `${Math.min(100, share)}%`, background: st ? TONE[st] : COLORS[hi % 3] }} />
                  </div>
                  <div className="text-xs" style={{ color: st ? TONE[st] : 'var(--text2)' }}>{t('{share} % плана по звонкам', { share })}</div>
                </>
              )}
              <div className="text-xs mt-1.5" style={{ color: 'var(--text2)' }}>
                {tc('crm', 'собеседований')} <b style={{ color: 'var(--text)' }}>{n(booked)}</b> {tc('crm', '→ дошло')} <b style={{ color: 'var(--text)' }}>{n(held)}</b>
                {booked ? ` · ${Math.round(held / booked * 100)} %` : ''}
              </div>
            </div>
          )
        })}
      </div>

      {GROUPS.map(group => (
        <div key={group.title} className="mb-4">
          <div className="flex items-baseline gap-2.5 flex-wrap mb-2">
            <b className="text-sm" style={{ color: 'var(--text)' }}>{tc('crm', group.title)}</b>
            <span className="text-xs" style={{ color: 'var(--text2)' }}>{tc('crm', group.hint)}</span>
          </div>
          <div className="rounded-2xl overflow-x-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1020 }}>
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider sticky left-0" style={{ color: 'var(--text2)', background: 'var(--surface2)', zIndex: 3, minWidth: 148, borderBottom: '1px solid var(--border)' }}>{tc('crm', 'Хантер')}</th>
                  <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider sticky" style={{ left: 148, color: 'var(--text2)', background: 'var(--surface2)', zIndex: 3, minWidth: 96, borderBottom: '1px solid var(--border)' }}>{tc('crm', 'Показатель')}</th>
                  {weeks.map((w, wi) => (
                    <WeekHead key={w.key} week={w} index={wi} />
                  ))}
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider" style={{ color: 'var(--text2)', background: 'color-mix(in srgb, var(--accent) 20%, var(--surface2))', minWidth: 64, borderBottom: '1px solid var(--border)' }}>{tc('crm', 'месяц')}</th>
                </tr>
              </thead>
              <tbody>
                {report.hunters.map((h, hi) => group.rows.map((row, ri) => {
                  const lastRow = ri === group.rows.length - 1
                  const bb = lastRow ? '2px solid var(--border)' : '1px solid var(--border)'
                  return (
                    <tr key={h.name + row.key}>
                      {ri === 0 && (
                        <td rowSpan={group.rows.length} className="px-3 py-2.5 sticky left-0" style={{ background: 'var(--surface)', zIndex: 2, borderBottom: '2px solid var(--border)', verticalAlign: 'middle' }}>
                          <span className="flex items-center gap-2 whitespace-nowrap font-medium text-sm">
                            <i style={{ width: 9, height: 9, borderRadius: 5, background: COLORS[hi % 3], flex: 'none' }} />{h.short}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-2.5 sticky text-left whitespace-nowrap" style={{ left: 148, background: 'var(--surface)', zIndex: 2, borderBottom: bb, fontSize: 11.5, color: 'var(--text2)', paddingLeft: row.conv ? 20 : 12, fontStyle: row.conv ? 'italic' : 'normal' }}>{tc('crm', row.label)}</td>
                      {weeks.map(w => (
                        <WeekCells key={w.key} week={w} bb={bb}
                          dayCell={(iso, di) => {
                            const v = dayVal(h, row, iso)
                            const st = statusOf(row, v, [iso], h.name)
                            return (
                              <td key={iso} className="text-center" style={{ padding: '5px 3px', borderBottom: bb, borderLeft: di === 0 ? '2px solid var(--text2)' : undefined, background: cellBg(st, isWeekend(iso), 34), opacity: isWeekend(iso) ? 0.4 : 1 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmt(row, v)}</span>
                              </td>
                            )
                          }}
                          totalCell={() => {
                            const wv = rangeVal(h, row, w.days)
                            const wst = statusOf(row, wv, w.days, h.name)
                            return (
                              <td className="text-center font-semibold" style={{ borderBottom: bb, borderLeft: '2px solid var(--accent)', background: cellBg(wst, false, 58) || 'color-mix(in srgb, var(--accent) 7%, transparent)' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmt(row, wv) || '—'}</span>
                              </td>
                            )
                          }} />
                      ))}
                      {(() => {
                        const mv = rangeVal(h, row, days)
                        const mst = statusOf(row, mv, days, h.name)
                        return (
                          <td className="px-3 text-right" style={{ borderBottom: bb, fontWeight: 700, background: cellBg(mst, false, 62) }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{fmt(row, mv) || '—'}</span>
                          </td>
                        )
                      })()}
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="mt-5">
        <div className="flex items-baseline gap-2.5 flex-wrap mb-2">
          <b className="text-sm" style={{ color: 'var(--text)' }}>{t('Выполнение плана за месяц')}</b>
          <span className="text-xs" style={{ color: 'var(--text2)' }}>{t('доля от личного плана; у реакции меньше — лучше, поэтому считается наоборот')}</span>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(262px,1fr))' }}>
          {GROUPS.flatMap(g => g.rows.map(row => (
            <div key={g.title + row.key} className="rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '13px 14px' }}>
              <b className="text-xs block mb-2" style={{ color: 'var(--text)' }}>{tc('crm', g.title)} · {tc('crm', row.label).replace('→ ', '')}</b>
              {report.hunters.map((h, hi) => {
                const v = rangeVal(h, row, days)
                const t = targetFor(row, days, h.name)
                const share = (v == null || !t) ? null : (row.lower ? t / v : v / t) * 100
                const st = statusOf(row, v, days, h.name)
                const col = st ? TONE[st] : COLORS[hi % 3]
                return (
                  <div key={h.name} className="mb-2">
                    <div className="flex justify-between items-baseline gap-2" style={{ fontSize: 11.5 }}>
                      <span className="flex items-center gap-1.5" style={{ color: 'var(--text2)' }}>
                        <i style={{ width: 8, height: 8, borderRadius: 4, background: COLORS[hi % 3] }} />{h.short}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        <b>{fmt(row, v) || '—'}</b>{t ? <span style={{ color: 'var(--text2)' }}> / {fmt(row, t)}</span> : null}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 rounded overflow-hidden" style={{ height: 7, background: 'var(--surface2)' }}>
                        <div style={{ width: `${share == null ? 0 : Math.min(100, Math.max(2, share))}%`, height: '100%', background: col }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, width: 38, textAlign: 'right', color: st ? col : 'var(--text2)' }}>
                        {share == null ? '—' : Math.round(share) + '%'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )))}
        </div>
      </div>

      <p className="text-xs mt-4" style={{ color: 'var(--text2)' }}>
        {t('Зелёная ячейка — план взят, жёлтая 70–99 %, красная ниже 70 %. Суббота и воскресенье приглушены: план с них не спрашивается.')}
        {report.computedAt && <> {t('Данные на {time}.', { time: new Date(report.computedAt).toLocaleTimeString(INTL_LOCALE, { hour: '2-digit', minute: '2-digit' }) })}</>}
        {' '}<button onClick={() => load(true)} disabled={busy} style={{ background: 'none', border: 0, padding: 0, color: 'var(--accent)', cursor: busy ? 'default' : 'pointer', font: 'inherit', opacity: busy ? 0.6 : 1 }}>{busy ? t('Считаем…') : tc('crm', 'Пересчитать')}</button>
      </p>
    </div>
  )
}

function WeekHead({ week, index }: { week: { key: string; days: string[] }; index: number }) {
  return (
    <>
      {week.days.map((iso, di) => (
        <th key={iso} className="text-center text-[10px]" style={{ padding: '6px 3px', minWidth: 30, color: 'var(--text2)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', borderLeft: di === 0 ? '2px solid var(--text2)' : undefined, opacity: isWeekend(iso) ? 0.5 : 1 }}>{iso.slice(8)}</th>
      ))}
      <th className="text-center text-[10px] uppercase tracking-wider" style={{ minWidth: 56, color: 'var(--text2)', borderLeft: '2px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 22%, var(--surface2))', borderBottom: '1px solid var(--border)' }}>{t('итог н{n}', { n: index + 1 })}</th>
    </>
  )
}

function WeekCells({ week, dayCell, totalCell }: {
  week: { key: string; days: string[] }
  bb: string
  dayCell: (iso: string, di: number) => React.ReactNode
  totalCell: () => React.ReactNode
}) {
  return <>{week.days.map((iso, di) => dayCell(iso, di))}{totalCell()}</>
}

function PlanPanel({ hunters, plans, saving, days, onChange }: {
  hunters: HunterReport['hunters']
  plans: Record<string, HunterPlan>
  saving: boolean
  days: string[]
  onChange: (name: string, key: keyof HunterPlan, value: number) => void
}) {
  const rowStyle = (count: number) => ({ display: 'grid', gridTemplateColumns: `96px repeat(${count}, 1fr)`, gap: 8, alignItems: 'center', marginBottom: 7 })
  const field = (h: HunterReport['hunters'][0], f: { key: keyof HunterPlan; label: string }) => (
    <input key={f.key} type="text" inputMode="decimal" aria-label={`${h.short}, ${tc('crm', f.label)}`}
      defaultValue={String(plans[h.name]?.[f.key] ?? '').replace('.', DEC)}
      onBlur={e => {
        const v = parseFloat(e.target.value.replace(',', '.'))
        if (Number.isFinite(v) && v > 0) onChange(h.name, f.key, v)
        else e.target.value = String(plans[h.name]?.[f.key] ?? '').replace('.', DEC)
      }}
      style={{ font: 'inherit', fontFamily: 'var(--font-mono)', fontSize: 13, padding: '6px 8px', borderRadius: 8,
        border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', width: '100%', outline: 'none' }} />
  )

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2.5 flex-wrap mb-2.5">
        <b className="text-sm" style={{ color: 'var(--text)' }}>{t('План на один рабочий день')}</b>
        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          {saving ? t('Сохраняем…') : t('Меняется на ходу, сохраняется сразу для всех')}
        </span>
      </div>
      <div style={{ ...rowStyle(PLAN_FIELDS.length), marginBottom: 6, alignItems: 'end' }}>
        <span />{PLAN_FIELDS.map(f => <span key={f.key} className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text2)' }}>{tc('crm', f.label)}</span>)}
      </div>
      {hunters.map((h, hi) => (
        <div key={h.name} style={rowStyle(PLAN_FIELDS.length)}>
          <span className="flex items-center gap-2 text-sm whitespace-nowrap">
            <i style={{ width: 9, height: 9, borderRadius: 5, background: COLORS[hi % 3] }} />{h.short}
          </span>
          {PLAN_FIELDS.map(f => field(h, f))}
        </div>
      ))}

      <div style={{ margin: '14px 0 8px', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <b className="text-sm" style={{ color: 'var(--text)' }}>{t('Нормативы качества')}</b>{' '}
        <span className="text-xs" style={{ color: 'var(--text2)' }}>{t('не зависят от доли ставки и не умножаются на дни')}</span>
      </div>
      <div style={{ ...rowStyle(NORM_FIELDS.length), marginBottom: 6, alignItems: 'end' }}>
        <span />{NORM_FIELDS.map(f => <span key={f.key} className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text2)' }}>{tc('crm', f.label)}</span>)}
      </div>
      {hunters.map((h, hi) => (
        <div key={h.name} style={rowStyle(NORM_FIELDS.length)}>
          <span className="flex items-center gap-2 text-sm whitespace-nowrap">
            <i style={{ width: 9, height: 9, borderRadius: 5, background: COLORS[hi % 3] }} />{h.short}
          </span>
          {NORM_FIELDS.map(f => field(h, f))}
        </div>
      ))}
      <p className="text-xs" style={{ color: 'var(--text2)' }}>
        {t('Рабочих дней в месяце: {days}. За месяц это {list} наборов.', { days: workDaysIn(days), list: hunters.map(h => `${h.short} — ${n((plans[h.name]?.calls ?? 0) * workDaysIn(days))}`).join(' · ') })}
      </p>
    </div>
  )
}
