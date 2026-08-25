'use client'

import { useMemo, useRef, useEffect } from 'react'
import type { SprintStat, AnalyticsUser } from '@/lib/queries/analytics'
import { computeEfficiency, efficiencyColor } from '@/lib/utils/efficiency'
import { getAvatarColor } from '@/lib/utils/avatar'
import { usePersistedFilter } from '@/lib/hooks/use-persisted-filter'
import UserFilter from '@/components/common/user-filter'

// ——— Работа с неделями (понедельник ISO-недели как ключ) ———
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const shift = (d.getDay() + 6) % 7 // 0 = понедельник
  d.setDate(d.getDate() - shift)
  return ymd(d)
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return ymd(d)
}
function fmtDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

type Cell = { eff: number; active: boolean; tasks: number } | null

const WEEK_W = 60
const CUR_W = 100
const NAME_W = 244

function EffPill({ eff, dim = false }: { eff: number; dim?: boolean }) {
  const color = efficiencyColor(eff)
  return (
    <span
      className="inline-flex items-center justify-center font-mono font-semibold rounded-md"
      style={{
        fontSize: 12, minWidth: 40, padding: '3px 7px',
        color, background: dim ? 'transparent' : `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} ${dim ? 22 : 35}%, transparent)`,
      }}
    >
      {eff}%
    </span>
  )
}

function Sparkline({ values }: { values: (number | null)[] }) {
  if (!values.some(v => v != null)) {
    return <div style={{ height: 22 }} />
  }
  return (
    <div className="flex items-end gap-[2px]" style={{ height: 22 }}>
      {values.map((v, i) => {
        if (v == null) {
          return <div key={i} style={{ width: 4, height: 3, borderRadius: 2, background: 'var(--surface2)' }} />
        }
        return (
          <div key={i} title={`${v}%`}
            style={{ width: 4, height: Math.max(3, Math.round((v / 100) * 22)), borderRadius: 2, background: efficiencyColor(v) }} />
        )
      })}
    </div>
  )
}

function Avatar({ user, size = 32 }: { user: AnalyticsUser; size?: number }) {
  const name = user.full_name || user.login
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-semibold"
      style={{ width: size, height: size, background: getAvatarColor(user.id), color: '#fff', fontSize: size * 0.4 }}>
      {name[0]?.toUpperCase()}
    </div>
  )
}

export default function EfficiencySummary({
  users,
  sprintsByUser,
  currentUserId,
  onOpenUser,
}: {
  users: AnalyticsUser[]
  sprintsByUser: Record<string, SprintStat[]>
  currentUserId: string
  onOpenUser: (id: string) => void
}) {
  const [selected, setSelected] = usePersistedFilter<string[]>(`analytics-summary-users-${currentUserId}`, [])
  const [weeksCount, setWeeksCount] = usePersistedFilter<number>(`analytics-summary-weeks-${currentUserId}`, 8)

  const shownUsers = selected.length ? users.filter(u => selected.includes(u.id)) : users

  const currentMon = useMemo(() => mondayOf(ymd(new Date())), [])

  // Непрерывная ось недель: от самой ранней недели с данными до текущей, обрезанная до weeksCount.
  const pastWeeks = useMemo(() => {
    let earliest = currentMon
    for (const u of shownUsers) {
      for (const s of sprintsByUser[u.id] ?? []) {
        const m = mondayOf(s.date_from)
        if (m < earliest) earliest = m
      }
    }
    const weeks: string[] = []
    let cur = earliest
    while (cur < currentMon) { weeks.push(cur); cur = addDays(cur, 7) }
    // Последние (weeksCount - 1) прошлых недель — текущая идёт отдельной липкой колонкой.
    return weeks.slice(Math.max(0, weeks.length - (weeksCount - 1)))
  }, [shownUsers, sprintsByUser, currentMon, weeksCount])

  // Матрица: userId -> (monday -> Cell)
  const matrix = useMemo(() => {
    const map: Record<string, Record<string, Cell>> = {}
    for (const u of shownUsers) {
      const byWeek: Record<string, Cell> = {}
      const grouped: Record<string, SprintStat[]> = {}
      for (const s of sprintsByUser[u.id] ?? []) {
        const m = mondayOf(s.date_from)
        ;(grouped[m] ??= []).push(s)
      }
      for (const [m, sprints] of Object.entries(grouped)) {
        const tasks = sprints.flatMap(s => s.tasks)
        byWeek[m] = {
          eff: computeEfficiency(tasks.map(t => ({
            type: t.type, workflow_status: t.workflow_status,
            time_estimate: t.time_estimate, task_status: t.task_status,
          }))),
          active: sprints.some(s => s.sprint_status === 'active'),
          tasks: sprints.reduce((n, s) => n + s.total_tasks, 0),
        }
      }
      map[u.id] = byWeek
    }
    return map
  }, [shownUsers, sprintsByUser])

  // Сводка по «начал спринт на этой неделе».
  const rows = shownUsers.map(u => {
    const cells = matrix[u.id] ?? {}
    const current = cells[currentMon] ?? null
    const started = !!current
    // Активный спринт, оставшийся с прошлых недель (не начал новый на этой неделе).
    const ongoing = !started && (sprintsByUser[u.id] ?? []).find(s => s.sprint_status === 'active')
    const past = pastWeeks.map(w => cells[w]?.eff ?? null)
    const withCur = [...past, current?.eff ?? null]
    const vals = withCur.filter((v): v is number => v != null)
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
    return { user: u, cells, current, started, ongoing, past, avg }
  })

  const startedCount = rows.filter(r => r.started).length
  const teamAvg = (() => {
    const vals = rows.map(r => r.avg).filter((v): v is number => v != null)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  })()

  // Автопрокрутка матрицы вправо (к свежим неделям).
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [pastWeeks.length, shownUsers.length])

  const filterUsers = users.map(u => ({ id: u.id, full_name: u.full_name, login: u.login }))

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Панель управления */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <UserFilter users={filterUsers} selected={selected} onChange={setSelected} placeholder="Все сотрудники" />

        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {[8, 12, 999].map((n, i) => (
            <button key={n} onClick={() => setWeeksCount(n)}
              className="px-3 py-1.5 text-xs font-medium"
              style={{
                background: weeksCount === n ? 'var(--accent)' : 'transparent',
                color: weeksCount === n ? '#fff' : 'var(--text2)',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
              }}>
              {n === 999 ? 'Всё' : `${n} нед.`}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Чипы-сводка */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'color-mix(in srgb, var(--green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
          <span style={{ color: 'var(--text2)' }}>Начали спринт:</span>
          <span className="font-semibold font-mono" style={{ color: 'var(--green)' }}>{startedCount}/{shownUsers.length}</span>
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
      <div ref={scrollRef} className="flex-1 overflow-auto rounded-xl" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ minWidth: 'fit-content' }}>
          {/* Заголовок */}
          <div className="flex items-stretch sticky top-0 z-30"
            style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center px-4 py-2.5 sticky left-0 z-10"
              style={{ width: NAME_W, flexShrink: 0, background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>Сотрудник</span>
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
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--text2)' }}>{fmtDay(currentMon)}</span>
            </div>
          </div>

          {/* Строки */}
          {rows.map(({ user, current, started, ongoing, past, avg }) => (
            <div key={user.id} className="flex items-stretch"
              style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Сотрудник + спарклайн + среднее (липкая колонка) */}
              <button onClick={() => onOpenUser(user.id)}
                className="flex items-center gap-3 px-4 py-2.5 sticky left-0 z-10 text-left"
                style={{ width: NAME_W, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
                <div className="relative shrink-0">
                  <Avatar user={user} size={32} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
                    title={started ? 'Начал спринт на этой неделе' : ongoing ? 'Спринт с прошлой недели' : 'Спринт не начат'}
                    style={{ background: started ? 'var(--green)' : ongoing ? 'var(--yellow)' : 'var(--text2)', border: '2px solid var(--surface)' }} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{user.full_name || user.login}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Sparkline values={[...past, current?.eff ?? null]} />
                    <span className="font-mono text-xs shrink-0" style={{ color: avg != null ? efficiencyColor(avg) : 'var(--text2)' }}>
                      {avg != null ? `${avg}%` : '—'}
                    </span>
                  </div>
                </div>
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
                ) : ongoing ? (
                  <span className="text-xs px-2 py-1 rounded-md whitespace-nowrap"
                    style={{ color: 'var(--yellow)', background: 'color-mix(in srgb, var(--yellow) 12%, transparent)' }}>
                    идёт с {fmtDay(mondayOf(ongoing.date_from))}
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
              <p className="text-sm" style={{ color: 'var(--text2)' }}>Нет сотрудников для отображения</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
