'use client'

import { useMemo, useRef, useEffect } from 'react'
import { efficiencyColor } from '@/lib/utils/efficiency'
import { mondayOf, addDays, todayYmd, fmtDay, fmtWeekRange } from '@/lib/utils/week'

// Универсальная строка сводки — может быть проектом или сотрудником.
export type SummaryRow = {
  id: string
  name: string
  subtitle?: string
  color: string
  avatarText: string
  isProject: boolean
  cells: Record<string, { eff: number; active: boolean } | undefined> // ключ = понедельник
  ongoingFrom?: string // понедельник активного спринта с прошлых недель («идёт с»)
}

const WEEK_W = 60
const CUR_W = 116
const NAME_W = 244

function EffPill({ eff }: { eff: number }) {
  const color = efficiencyColor(eff)
  return (
    <span
      className="inline-flex items-center justify-center font-mono font-semibold rounded-md"
      style={{
        fontSize: 12, minWidth: 40, padding: '3px 7px',
        color, background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {eff}%
    </span>
  )
}

function Sparkline({ values }: { values: (number | null)[] }) {
  if (!values.some(v => v != null)) return <div style={{ height: 22 }} />
  return (
    <div className="flex items-end gap-[2px]" style={{ height: 22 }}>
      {values.map((v, i) =>
        v == null
          ? <div key={i} style={{ width: 4, height: 3, borderRadius: 2, background: 'var(--surface2)' }} />
          : <div key={i} title={`${v}%`} style={{ width: 4, height: Math.max(3, Math.round((v / 100) * 22)), borderRadius: 2, background: efficiencyColor(v) }} />
      )}
    </div>
  )
}

function RowAvatar({ row, started }: { row: SummaryRow; started: boolean }) {
  return (
    <div className="relative shrink-0">
      <div className="flex items-center justify-center font-semibold"
        style={{
          width: 32, height: 32,
          borderRadius: row.isProject ? 8 : '9999px',
          background: row.color, color: '#fff', fontSize: 13,
        }}>
        {row.isProject
          ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3l1.2 1.5H12.5A1.5 1.5 0 0 1 14 7v4.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-6Z" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" /></svg>
          : row.avatarText}
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
        title={started ? 'Начал спринт на этой неделе' : row.ongoingFrom ? 'Спринт с прошлой недели' : 'Спринт не начат'}
        style={{ background: started ? 'var(--green)' : row.ongoingFrom ? 'var(--yellow)' : 'var(--text2)', border: '2px solid var(--surface)' }} />
    </div>
  )
}

export default function EfficiencySummary({
  rows,
  weeksCount,
  entityLabel,
  onOpenRow,
}: {
  rows: SummaryRow[]
  weeksCount: number
  entityLabel: string
  onOpenRow: (id: string, isProject: boolean) => void
}) {
  const currentMon = useMemo(() => mondayOf(todayYmd()), [])

  // Непрерывная ось прошлых недель.
  const pastWeeks = useMemo(() => {
    let earliest = currentMon
    for (const r of rows) for (const k of Object.keys(r.cells)) if (k < earliest) earliest = k
    const weeks: string[] = []
    let cur = earliest
    while (cur < currentMon) { weeks.push(cur); cur = addDays(cur, 7) }
    return weeks.slice(Math.max(0, weeks.length - (weeksCount - 1)))
  }, [rows, currentMon, weeksCount])

  const computed = rows.map(r => {
    const current = r.cells[currentMon]
    const started = !!current
    const past = pastWeeks.map(w => r.cells[w]?.eff ?? null)
    const withCur = [...past, current?.eff ?? null]
    const vals = withCur.filter((v): v is number => v != null)
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
    return { row: r, current, started, past, avg }
  })

  const startedCount = computed.filter(c => c.started).length
  const teamAvg = (() => {
    const vals = computed.map(c => c.avg).filter((v): v is number => v != null)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  })()

  // Автопрокрутка матрицы вправо (к свежим неделям).
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [pastWeeks.length, rows.length])

  return (
    <div className="flex flex-col gap-3">
      {/* Чипы-сводка */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'color-mix(in srgb, var(--green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
          <span style={{ color: 'var(--text2)' }}>Начали спринт:</span>
          <span className="font-semibold font-mono" style={{ color: 'var(--green)' }}>{startedCount}/{rows.length}</span>
        </div>
        {teamAvg != null && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text2)' }}>Средняя:</span>
            <span className="font-semibold font-mono" style={{ color: efficiencyColor(teamAvg) }}>{teamAvg}%</span>
          </div>
        )}
      </div>

      {/* Матрица — единый горизонтальный скролл, крайние колонки липкие */}
      <div ref={scrollRef} className="overflow-auto rounded-xl" style={{ border: '1px solid var(--border)', background: 'var(--surface)', maxHeight: '56vh' }}>
        <div style={{ minWidth: 'fit-content' }}>
          {/* Заголовок */}
          <div className="flex items-stretch sticky top-0 z-30"
            style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center px-4 py-2.5 sticky left-0 z-10"
              style={{ width: NAME_W, flexShrink: 0, background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>{entityLabel}</span>
              <span className="text-xs ml-2" style={{ color: 'var(--text2)', opacity: 0.6 }}>· тренд</span>
            </div>
            {pastWeeks.length === 0 ? (
              <div className="flex items-center px-4" style={{ flex: 1, minWidth: 160, color: 'var(--text2)', fontSize: 12 }}>Нет закрытых недель</div>
            ) : pastWeeks.map((w, i) => (
              <div key={w} className="flex flex-col items-center justify-center py-2"
                style={{ width: WEEK_W, flexShrink: 0 }} title={`${fmtDay(w)} — ${fmtDay(addDays(w, 6))}`}>
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtDay(w)}</span>
                {i === 0 && <span style={{ fontSize: 9, color: 'var(--text2)', opacity: 0.6 }}>↤ ранее</span>}
              </div>
            ))}
            <div className="flex flex-col items-center justify-center py-2 sticky right-0 z-10"
              style={{ width: CUR_W, flexShrink: 0, background: 'color-mix(in srgb, var(--accent) 16%, var(--surface2))', borderLeft: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)' }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Текущая</span>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--text2)' }}>{fmtWeekRange(currentMon)}</span>
            </div>
          </div>

          {/* Строки */}
          {computed.map(({ row, current, started, past, avg }) => (
            <div key={row.id} className="flex items-stretch" style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Название + спарклайн + среднее (липкая колонка) */}
              <button onClick={() => onOpenRow(row.id, row.isProject)}
                className="flex items-center gap-3 px-4 py-2.5 sticky left-0 z-10 text-left"
                style={{ width: NAME_W, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,92,246,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
                <RowAvatar row={row} started={started} />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{row.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Sparkline values={[...past, current?.eff ?? null]} />
                    <span className="font-mono text-xs shrink-0" style={{ color: avg != null ? efficiencyColor(avg) : 'var(--text2)' }}>
                      {avg != null ? `${avg}%` : '—'}
                    </span>
                  </div>
                </div>
                {row.isProject && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text2)', opacity: 0.5, flexShrink: 0 }}>
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* Прошлые недели */}
              {pastWeeks.length === 0 ? (
                <div style={{ flex: 1, minWidth: 160 }} />
              ) : past.map((eff, i) => (
                <div key={pastWeeks[i]} className="flex items-center justify-center py-2.5" style={{ width: WEEK_W, flexShrink: 0 }}>
                  {eff != null ? <EffPill eff={eff} /> : <span style={{ color: 'var(--text2)', opacity: 0.35 }}>·</span>}
                </div>
              ))}

              {/* Текущая неделя (липкая) */}
              <div className="flex items-center justify-center py-2.5 sticky right-0 z-10"
                style={{ width: CUR_W, flexShrink: 0, background: started ? 'color-mix(in srgb, var(--green) 8%, var(--surface))' : 'var(--surface)', borderLeft: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
                {started && current ? (
                  <EffPill eff={current.eff} />
                ) : row.ongoingFrom ? (
                  <span className="text-xs px-2 py-1 rounded-md whitespace-nowrap"
                    style={{ color: 'var(--yellow)', background: 'color-mix(in srgb, var(--yellow) 12%, transparent)' }}>
                    идёт с {fmtDay(row.ongoingFrom)}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-md whitespace-nowrap"
                    style={{ color: 'var(--text2)', background: 'var(--surface2)' }}>
                    не начат
                  </span>
                )}
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm" style={{ color: 'var(--text2)' }}>Нет данных для отображения</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
