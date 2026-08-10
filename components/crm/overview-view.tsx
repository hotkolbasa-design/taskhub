'use client'

import { useState, useEffect } from 'react'
import { getWeekGroups } from '@/lib/crm/utils'
import type { DashData } from '@/lib/crm/types'

const PALETTE = ['#7C5CF6', '#2DD4A0', '#F75C6E', '#F7C04F', '#60A5FA', '#FB923C', '#A78BFA', '#34D399', '#F472B6', '#94A3B8']
const TODAY = typeof window !== 'undefined' ? new Date().toISOString().slice(0, 10) : ''

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text2)', opacity: 0.6 }}>{n} · {label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  )
}

// ─── Weekly line chart ────────────────────────────────────────────────────────

function WeeklyLineChart({ weekLabels, factValues, forecastValues, planPerWeek, currentWeekIdx }: {
  weekLabels: string[]
  factValues: number[]
  forecastValues: number[]
  planPerWeek: number
  currentWeekIdx: number
}) {
  const n = weekLabels.length
  if (n < 1) return null
  const W = 560, H = 200
  const pad = { t: 24, r: 24, b: 40, l: 44 }
  const pw = W - pad.l - pad.r
  const ph = H - pad.t - pad.b

  const allVals = [...factValues, ...forecastValues, planPerWeek].filter(v => v > 0)
  const maxV = Math.max(...allVals, 10) * 1.15
  const xi = (i: number) => n === 1 ? pad.l + pw / 2 : pad.l + (i / (n - 1)) * pw
  const yi = (v: number) => pad.t + (1 - Math.min(v / maxV, 1)) * ph

  const factPath = factValues.length > 0
    ? `M${factValues.map((v, i) => `${xi(i)},${yi(v)}`).join('L')}`
    : ''

  // forecast starts at currentWeekIdx
  const fPts = forecastValues.map((v, i) => `${xi(currentWeekIdx + i)},${yi(v)}`)
  const forecastPath = fPts.length > 1 ? `M${fPts.join('L')}` : ''

  const planY = yi(planPerWeek)
  const maxTick = Math.ceil(maxV / 10) * 10
  const yTicks = [0, Math.round(maxTick / 2), maxTick]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {currentWeekIdx > 0 && (
        <rect x={pad.l} y={pad.t} width={xi(currentWeekIdx) - pad.l} height={ph}
          fill="var(--accent)" opacity="0.04" />
      )}
      {yTicks.map(v => (
        <line key={v} x1={pad.l} y1={yi(v)} x2={pad.l + pw} y2={yi(v)} stroke="var(--border)" strokeWidth="1" />
      ))}
      {yTicks.map(v => (
        <text key={v} x={pad.l - 8} y={yi(v)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--text2)">{v}</text>
      ))}
      {weekLabels.map((w, i) => (
        <text key={i} x={xi(i)} y={H - pad.b + 16} textAnchor="middle" fontSize="9"
          fill="var(--text2)" opacity={i > currentWeekIdx ? 0.5 : 1}>{w}</text>
      ))}
      <path d={`M${pad.l},${planY}L${pad.l + pw},${planY}`} stroke="var(--green)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
      {forecastPath && (
        <path d={forecastPath} stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 4"
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {factPath && (
        <path d={factPath} stroke="var(--accent)" strokeWidth="2.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round" />
      )}
      {factValues.map((v, i) => (
        <circle key={i} cx={xi(i)} cy={yi(v)} r="4.5" fill="var(--accent)" />
      ))}
      {forecastValues.slice(1).map((v, i) => (
        <circle key={i} cx={xi(currentWeekIdx + 1 + i)} cy={yi(v)} r="4.5"
          fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      ))}
    </svg>
  )
}

// ─── 01 · Plan ────────────────────────────────────────────────────────────────

function PlanSection({ data, onSavePlan }: { data: DashData; onSavePlan: (plan: number) => void }) {
  const serverPlan = data.plan > 0 ? data.plan : 300
  const [plan, setPlan] = useState(serverPlan)
  const [planInput, setPlanInput] = useState(String(serverPlan))

  useEffect(() => {
    const v = data.plan > 0 ? data.plan : 300
    setPlan(v)
    setPlanInput(String(v))
  }, [data.plan, data.monthKey])

  function commitPlan() {
    const n = parseInt(planInput)
    if (n > 0) { setPlan(n); onSavePlan(n) }
    else setPlanInput(String(plan))
  }

  const leads = data.marketing.overall.milestones[0]
  const totalLeads = leads.total
  const daysIso = data.daysIso
  const totalDays = daysIso.length
  const daysElapsed = Math.max(1, daysIso.filter(d => d <= TODAY).length)
  const pace = totalLeads / daysElapsed
  const forecast = Math.round(pace * totalDays)
  const progressPct = Math.min(totalLeads / plan * 100, 100)
  const todayMarkerPct = Math.min((daysElapsed / totalDays) * 100, 100)

  const status = forecast >= plan * 1.05 ? 'ahead' : forecast >= plan * 0.9 ? 'on' : 'behind'
  const statusLabel = { ahead: 'Опережаем план', on: 'Идём по плану', behind: 'Отстаём от плана' }[status]
  const statusColor = { ahead: 'var(--green)', on: 'var(--accent)', behind: 'var(--red)' }[status]
  const statusBg = { ahead: 'rgba(45,212,160,0.12)', on: 'rgba(124,92,246,0.12)', behind: 'rgba(247,92,110,0.12)' }[status]

  const weekGroups = getWeekGroups(daysIso)
  const weekLabels = data.weeks

  let currentWeekIdx = weekGroups.findIndex(wk => wk[0] <= TODAY && wk[wk.length - 1] >= TODAY)
  if (currentWeekIdx === -1) currentWeekIdx = TODAY < daysIso[0] ? 0 : weekGroups.length - 1

  const factValues = leads.weekValues.slice(0, currentWeekIdx + 1)
  const forecastValues: number[] = [
    leads.weekValues[currentWeekIdx] ?? 0,
    ...weekGroups.slice(currentWeekIdx + 1).map(wk => Math.round(pace * wk.length)),
  ]
  const planPerWeek = plan / weekGroups.length

  let trendText = '', trendGood = true
  if (currentWeekIdx >= 2) {
    const [w1, w2, w3] = [leads.weekValues[currentWeekIdx - 2], leads.weekValues[currentWeekIdx - 1], leads.weekValues[currentWeekIdx]]
    if (w1 > 0 && w2 > 0) {
      const g1 = Math.round((w2 - w1) / w1 * 100), g2 = Math.round((w3 - w2) / w2 * 100)
      trendText = `${g1 >= 0 ? '+' : ''}${g1}%, затем ${g2 >= 0 ? '+' : ''}${g2}%`
      trendGood = g2 >= 0
    }
  } else if (currentWeekIdx >= 1 && leads.weekValues[currentWeekIdx - 1] > 0) {
    const g = Math.round((leads.weekValues[currentWeekIdx] - leads.weekValues[currentWeekIdx - 1]) / leads.weekValues[currentWeekIdx - 1] * 100)
    trendText = `${g >= 0 ? '+' : ''}${g}% к прошлой неделе`
    trendGood = g >= 0
  }

  const [, month] = data.monthKey.split('-')
  const monthNames = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь']
  const monthLabel = monthNames[parseInt(month) - 1]

  return (
    <div>
      <SectionLabel n="01" label="Идем ли по плану" />

      <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold" style={{ fontSize: 48, lineHeight: 1, color: 'var(--text)' }}>{totalLeads}</span>
              <span className="text-xl" style={{ color: 'var(--text2)' }}>из {plan} заявок</span>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
              Прошло {daysElapsed} из {totalDays} дня месяца · {Math.round(daysElapsed / totalDays * 100)}%
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="px-3 py-1.5 rounded-full text-sm font-semibold" style={{ background: statusBg, color: statusColor }}>
              {status === 'ahead' ? '↗ ' : status === 'behind' ? '↘ ' : ''}{statusLabel}
            </span>
            <span className="text-xs" style={{ color: 'var(--text2)' }}>
              Прогноз на {totalDays}.{month}: <strong style={{ color: 'var(--text)' }}>{forecast} заявки</strong>
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mt-2">
          <div style={{ position: 'absolute', left: `${todayMarkerPct}%`, top: -18, transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: 'var(--text2)', letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            СЕГОДНЯ
          </div>
          <div className="relative rounded-full overflow-visible" style={{ height: 36, background: 'var(--surface2)' }}>
            <div className="h-full rounded-full flex items-center px-3 transition-all duration-500"
              style={{ width: `${Math.max(progressPct, 4)}%`, background: statusColor }}>
              <span className="text-sm font-bold text-white whitespace-nowrap">{Math.round(progressPct)}% плана</span>
            </div>
            <div style={{ position: 'absolute', left: `${todayMarkerPct}%`, top: 0, bottom: 0, width: 2, background: 'var(--text)', opacity: 0.6, transform: 'translateX(-50%)', borderRadius: 1 }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs" style={{ color: 'var(--text2)' }}>0</span>
            <span className="text-xs" style={{ color: 'var(--text2)' }}>цель {plan}</span>
          </div>
        </div>

        {/* Plan input */}
        <div className="flex items-center gap-3 mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-sm" style={{ color: 'var(--text2)' }}>План на {monthLabel}, заявок</span>
          <input
            type="text" value={planInput}
            onChange={e => setPlanInput(e.target.value)}
            onBlur={commitPlan}
            onKeyDown={e => e.key === 'Enter' && commitPlan()}
            className="text-sm font-medium rounded-lg px-3 py-2 text-center"
            style={{ width: 80, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none' }}
          />
          <span className="text-sm" style={{ color: 'var(--text2)' }}>— поменяйте цифру, всё пересчитается</span>
        </div>
      </div>

      {/* Weekly chart */}
      <div className="rounded-2xl p-6 mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Динамика по неделям</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>Пунктир — неделя ещё не закончена, сравнивать с ней нельзя</p>
          </div>
          {trendText && (
            <span className="text-sm font-semibold" style={{ color: trendGood ? 'var(--green)' : 'var(--red)' }}>{trendText}</span>
          )}
        </div>
        <WeeklyLineChart weekLabels={weekLabels} factValues={factValues} forecastValues={forecastValues} planPerWeek={planPerWeek} currentWeekIdx={currentWeekIdx} />
        <div className="flex items-center justify-center gap-6 mt-3">
          {[
            { solid: true, hollow: false, color: 'var(--accent)', label: 'Факт' },
            { solid: false, hollow: true, color: 'var(--accent)', label: 'Прогноз' },
            { solid: false, hollow: false, color: 'var(--green)', label: 'План' },
          ].map(({ solid, hollow, color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <circle cx="6" cy="6" r="5" fill={hollow ? 'var(--surface)' : color} stroke={color} strokeWidth={hollow ? '2' : '0'} />
              </svg>
              <span className="text-xs" style={{ color: 'var(--text2)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 02 · Spend ───────────────────────────────────────────────────────────────

function SpendSection({ data, onGoMarketing }: { data: DashData; onGoMarketing: () => void }) {
  const spend = data.marketing.overall.spend
  const hasSpend = (spend?.budgetKzt?.total ?? 0) > 0
  const [, month] = data.monthKey.split('-')
  const monthNames = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь']
  const totalLeads = data.marketing.summary.totalLeads

  return (
    <div>
      <SectionLabel n="02" label="Куда уходят деньги" />
      <div className="rounded-2xl p-6 mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {!hasSpend ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ color: 'var(--text2)', opacity: 0.35 }}>
              <rect x="6" y="11" width="32" height="22" rx="3" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M6 18h32" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M14 27h6M24 27h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M30 6L14 38" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <div className="text-center">
              <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Расходы не внесены</p>
              <p className="text-sm" style={{ color: 'var(--text2)' }}>
                {totalLeads} заявок пришли — но неизвестно, за сколько.<br />
                Пока здесь пусто, CAC и ROMI посчитать нельзя.
              </p>
            </div>
            <button onClick={onGoMarketing}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}>
              Внести расходы за {monthNames[parseInt(month) - 1]}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Расходы по неделям</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>Бюджет в тенге · красная линия — цена лида</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>{Math.round(spend?.budgetKzt?.total ?? 0).toLocaleString('ru-RU')} ₸</div>
                <div className="text-xs" style={{ color: 'var(--text2)' }}>итого за месяц</div>
              </div>
            </div>
            <SpendBarChart weekLabels={data.weeks} spendValues={spend?.budgetKzt?.weekValues ?? []} leadValues={data.marketing.overall.milestones[0].weekValues} />
          </div>
        )}
      </div>
    </div>
  )
}

function SpendBarChart({ weekLabels, spendValues, leadValues }: { weekLabels: string[]; spendValues: number[]; leadValues: number[] }) {
  const n = weekLabels.length
  const W = 560, H = 200
  const pad = { t: 24, r: 56, b: 40, l: 72 }
  const pw = W - pad.l - pad.r
  const ph = H - pad.t - pad.b

  const maxSpend = Math.max(...spendValues, 1)
  const cplValues = spendValues.map((s, i) => leadValues[i] > 0 ? s / leadValues[i] : 0)
  const maxCpl = Math.max(...cplValues, 1)

  const barW = (pw / n) * 0.55
  const xi = (i: number) => pad.l + i * (pw / n) + (pw / n) * 0.225
  const yS = (v: number) => pad.t + (1 - v / maxSpend) * ph
  const yC = (v: number) => pad.t + (1 - v / maxCpl) * ph

  const spendTicks = [0, Math.round(maxSpend / 2 / 1000) * 1000, Math.round(maxSpend / 1000) * 1000]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {spendTicks.map(v => (
        <line key={v} x1={pad.l} y1={yS(v)} x2={pad.l + pw} y2={yS(v)} stroke="var(--border)" strokeWidth="1" />
      ))}
      {spendTicks.map(v => (
        <text key={v} x={pad.l - 6} y={yS(v)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="var(--text2)">
          {v >= 1000 ? `${Math.round(v / 1000)}к` : v}
        </text>
      ))}
      {spendValues.map((v, i) => {
        const bh = (v / maxSpend) * ph
        return <rect key={i} x={xi(i)} y={pad.t + ph - bh} width={barW} height={bh} rx="3" fill="var(--accent)" opacity="0.45" />
      })}
      {cplValues.some(v => v > 0) && (
        <>
          <path
            d={cplValues.map((v, i) => `${i === 0 ? 'M' : 'L'}${xi(i) + barW / 2},${yC(v)}`).join('')}
            stroke="var(--red)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {cplValues.map((v, i) => v > 0 && (
            <circle key={i} cx={xi(i) + barW / 2} cy={yC(v)} r="3.5" fill="var(--red)" />
          ))}
          <text x={W - pad.r + 6} y={pad.t} fontSize="9" fill="var(--red)" dominantBaseline="hanging">₸/лид</text>
        </>
      )}
      {weekLabels.map((w, i) => (
        <text key={i} x={xi(i) + barW / 2} y={H - pad.b + 16} textAnchor="middle" fontSize="9" fill="var(--text2)">{w}</text>
      ))}
    </svg>
  )
}

// ─── 03 · Funnel matrix ───────────────────────────────────────────────────────

function FunnelMatrix({ data }: { data: DashData }) {
  if (!data.marketing) return null
  const allSources = [
    ...data.marketing.sources.map(s => ({
      name: s.source,
      leads: s.milestones[0]?.total ?? 0,
      interviews: s.milestones[1]?.total ?? 0,
      spend: s.spend?.budgetKzt?.total ?? 0,
    })),
    ...data.marketing.groups.map(g => ({
      name: g.source,
      leads: g.milestones[0]?.total ?? 0,
      interviews: g.milestones[1]?.total ?? 0,
      spend: g.spend?.budgetKzt?.total ?? 0,
    })),
  ].filter(s => s.leads > 0)

  if (allSources.length === 0) {
    return (
      <div>
        <SectionLabel n="03" label="Какая воронка работает" />
        <div className="rounded-2xl p-6 mb-8 flex items-center justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)', minHeight: 120 }}>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Нет данных по источникам</p>
        </div>
      </div>
    )
  }

  const avgLeads = allSources.reduce((s, x) => s + x.leads, 0) / allSources.length
  const threshold = Math.max(3, Math.round(avgLeads * 0.15))
  const big = allSources.filter(s => s.leads >= threshold).slice(0, 8)
  const small = allSources.filter(s => s.leads < threshold)

  interface Bubble { name: string; leads: number; pct: number; spend: number; color: string }
  const bubbles: Bubble[] = big.map((s, i) => ({
    name: s.name,
    leads: s.leads,
    pct: s.leads > 0 ? s.interviews / s.leads * 100 : 0,
    spend: s.spend,
    color: PALETTE[i % PALETTE.length],
  }))
  if (small.length > 0) {
    const tl = small.reduce((s, x) => s + x.leads, 0)
    const ti = small.reduce((s, x) => s + x.interviews, 0)
    bubbles.push({ name: `Остальные ${small.length}`, leads: tl, pct: tl > 0 ? ti / tl * 100 : 0, spend: small.reduce((s, x) => s + x.spend, 0), color: '#94A3B8' })
  }

  const W = 640, H = 300
  const pad = { t: 20, r: 24, b: 50, l: 60 }
  const pw = W - pad.l - pad.r
  const ph = H - pad.t - pad.b

  const maxLeads = Math.max(...bubbles.map(s => s.leads)) * 1.25
  const maxPct = Math.max(...bubbles.map(s => s.pct), 5) * 1.3
  const maxSpend = Math.max(...bubbles.map(s => s.spend), 1)

  const xi = (v: number) => pad.l + (v / maxLeads) * pw
  const yi = (v: number) => pad.t + (1 - v / maxPct) * ph
  const ri = (v: number) => v > 0 ? 10 + Math.sqrt(v / maxSpend) * 24 : 10

  const sortedLeads = [...bubbles.map(s => s.leads)].sort((a, b) => a - b)
  const sortedPct = [...bubbles.map(s => s.pct)].sort((a, b) => a - b)
  const medLeads = sortedLeads[Math.floor(sortedLeads.length / 2)]
  const medPct = sortedPct[Math.floor(sortedPct.length / 2)]

  const xTicks = Array.from({ length: 5 }, (_, i) => Math.round(maxLeads / 4 * i))
  const yStep = maxPct <= 30 ? 10 : maxPct <= 60 ? 20 : 25
  const yTicks = Array.from({ length: Math.floor(maxPct / yStep) + 1 }, (_, i) => i * yStep)

  const named = bubbles.filter(s => !s.name.startsWith('Остальные'))
  const topRight = named.filter(s => s.leads >= medLeads && s.pct >= medPct)
  const botRight = named.filter(s => s.leads >= medLeads && s.pct < medPct)
  const botLeft = named.filter(s => s.leads < medLeads && s.pct < medPct)

  const recs: { title: string; desc: string; color: string; bg: string }[] = []
  if (topRight.length > 0) {
    const b = topRight.sort((a, c) => c.pct - a.pct)[0]
    recs.push({ title: '↗ Масштабировать', desc: `${b.name}: ${b.leads} заявки, ${Math.round(b.pct)}% до собеса — лучшее качество. Лить сюда бюджет.`, color: 'var(--green)', bg: 'rgba(45,212,160,0.08)' })
  }
  if (botRight.length > 0) {
    const b = botRight.sort((a, c) => c.leads - a.leads)[0]
    recs.push({ title: '△ Чинить квалификацию', desc: `${b.name}: ${b.leads} заявок, до собеса ${Math.round(b.pct)}%. Объём есть, качество нет — фильтровать на входе.`, color: 'var(--yellow)', bg: 'rgba(247,192,79,0.08)' })
  }
  if (botLeft.length > 0) {
    const b = botLeft.sort((a, c) => a.pct - c.pct)[0]
    recs.push({ title: '✕ Под вопросом', desc: `${b.name}: ${b.leads} заявки, ${Math.round(b.pct)}% до собеса. Либо переделать, либо выключить.`, color: 'var(--red)', bg: 'rgba(247,92,110,0.08)' })
  }

  return (
    <div>
      <SectionLabel n="03" label="Какая воронка работает" />
      <div className="rounded-2xl p-6 mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="font-semibold mb-0.5" style={{ color: 'var(--text)' }}>Матрица воронок</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text2)' }}>Вправо — больше заявок. Вверх — лучше доходят до собеседования. Размер круга — расход.</p>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
          <rect x={xi(medLeads)} y={pad.t} width={pad.l + pw - xi(medLeads)} height={yi(medPct) - pad.t} fill="var(--green)" opacity="0.05" />
          <rect x={xi(medLeads)} y={yi(medPct)} width={pad.l + pw - xi(medLeads)} height={pad.t + ph - yi(medPct)} fill="var(--yellow)" opacity="0.05" />
          <rect x={pad.l} y={yi(medPct)} width={xi(medLeads) - pad.l} height={pad.t + ph - yi(medPct)} fill="var(--red)" opacity="0.04" />
          {yTicks.map(v => <line key={v} x1={pad.l} y1={yi(v)} x2={pad.l + pw} y2={yi(v)} stroke="var(--border)" strokeWidth="1" />)}
          {xTicks.map(v => <line key={v} x1={xi(v)} y1={pad.t} x2={xi(v)} y2={pad.t + ph} stroke="var(--border)" strokeWidth="1" />)}
          {yTicks.map(v => <text key={v} x={pad.l - 6} y={yi(v)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="var(--text2)">{v}%</text>)}
          {xTicks.map(v => <text key={v} x={xi(v)} y={H - pad.b + 16} textAnchor="middle" fontSize="9" fill="var(--text2)">{v}</text>)}
          <text x={pad.l - 52} y={pad.t + ph / 2} textAnchor="middle" fontSize="9" fill="var(--text2)" transform={`rotate(-90 ${pad.l - 52} ${pad.t + ph / 2})`}>% до собеседования</text>
          <text x={pad.l + pw / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--text2)">Заявок за месяц</text>
          {[...bubbles].sort((a, b) => b.spend - a.spend).map(s => (
            <g key={s.name}>
              <circle cx={xi(s.leads)} cy={yi(s.pct)} r={ri(s.spend)} fill={s.color} opacity="0.65" />
              {ri(s.spend) > 16 && (
                <text x={xi(s.leads)} y={yi(s.pct)} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="white" fontWeight="600">{s.leads}</text>
              )}
            </g>
          ))}
        </svg>
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 justify-center">
          {bubbles.map(s => (
            <div key={s.name} className="flex items-center gap-1.5">
              <div className="rounded-full shrink-0" style={{ width: 10, height: 10, background: s.color }} />
              <span className="text-xs" style={{ color: 'var(--text2)' }}>{s.name}</span>
            </div>
          ))}
        </div>
        {recs.length > 0 && (
          <div className="grid gap-3 mt-5" style={{ gridTemplateColumns: recs.length === 1 ? '1fr' : recs.length === 2 ? '1fr 1fr' : '1fr 1fr' }}>
            {recs.map(r => (
              <div key={r.title} className="rounded-xl p-4" style={{ background: r.bg, border: `1px solid ${r.color}33` }}>
                <div className="font-semibold text-sm mb-1" style={{ color: r.color }}>{r.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{r.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── export ───────────────────────────────────────────────────────────────────

export function OverviewView({ data, onGoMarketing, onSavePlan }: { data: DashData; onGoMarketing: () => void; onSavePlan: (plan: number) => void }) {
  return (
    <div>
      <PlanSection data={data} onSavePlan={onSavePlan} />
      <SpendSection data={data} onGoMarketing={onGoMarketing} />
      <FunnelMatrix data={data} />
    </div>
  )
}
