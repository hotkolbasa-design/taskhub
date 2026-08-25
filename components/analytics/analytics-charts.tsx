'use client'

import { useMemo } from 'react'
import type { SprintStat, AnalyticsUser, ProjectAnalytics } from '@/lib/queries/analytics'
import { efficiencyColor } from '@/lib/utils/efficiency'
import { getAvatarColor } from '@/lib/utils/avatar'
import { mondayOf, fmtDay } from '@/lib/utils/week'

type Pt = { mon: string; eff: number; active: boolean }

// ——— SVG-линейный график эффективности по неделям ———
function LineChart({ points }: { points: Pt[] }) {
  const W = 260, H = 72, padX = 6, padTop = 8, padBottom = 16
  if (!points.length) {
    return <div className="flex items-center justify-center text-xs" style={{ height: H, color: 'var(--text2)' }}>Нет данных</div>
  }
  const innerW = W - padX * 2
  const innerH = H - padTop - padBottom
  const n = points.length
  const x = (i: number) => padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => padTop + innerH - (v / 100) * innerH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.eff).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${x(n - 1).toFixed(1)},${(padTop + innerH).toFixed(1)} L${x(0).toFixed(1)},${(padTop + innerH).toFixed(1)} Z`
  const lastColor = efficiencyColor(points[n - 1].eff)
  const gradId = `g-${points[0].mon}-${n}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lastColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={lastColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* сетка 50% */}
      <line x1={padX} x2={W - padX} y1={y(50)} y2={y(50)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={lastColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.mon}>
          <circle cx={x(i)} cy={y(p.eff)} r={p.active ? 3.5 : 2.5}
            fill={efficiencyColor(p.eff)} stroke="var(--surface)" strokeWidth="1.5" />
          <title>{`${fmtDay(p.mon)}: ${p.eff}%${p.active ? ' (текущая)' : ''}`}</title>
        </g>
      ))}
    </svg>
  )
}

function ChartCard({
  title, subtitle, color, points,
}: { title: string; subtitle?: string; color: string; points: Pt[] }) {
  const vals = points.map(p => p.eff)
  const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  const last = points.length ? points[points.length - 1].eff : null

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{title}</span>
          {subtitle && <span className="text-xs" style={{ color: 'var(--text2)' }}>{subtitle}</span>}
        </div>
        {last != null && (
          <span className="font-mono text-lg font-bold shrink-0" style={{ color: efficiencyColor(last) }}>{last}%</span>
        )}
      </div>
      <LineChart points={points} />
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text2)' }}>
        <span>{points.length ? `${points.length} нед.` : '—'}</span>
        {avg != null && <span>среднее <span className="font-mono font-semibold" style={{ color: efficiencyColor(avg) }}>{avg}%</span></span>}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide px-1" style={{ color: 'var(--text2)' }}>{label}</span>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {children}
      </div>
    </div>
  )
}

export default function AnalyticsCharts({
  projects,
  users,
  sprintsByUser,
}: {
  projects: ProjectAnalytics[]
  users: AnalyticsUser[]
  sprintsByUser: Record<string, SprintStat[]>
}) {
  // Понедельные точки по каждому проекту (по возрастанию даты).
  const projectCharts = useMemo(() => projects.map(p => ({
    id: p.project_id,
    name: p.project_name,
    points: [...p.weekly]
      .sort((a, b) => a.date_from.localeCompare(b.date_from))
      .map(w => ({ mon: mondayOf(w.date_from), eff: w.efficiency, active: w.sprint_status === 'active' })),
  })), [projects])

  // Понедельные точки по каждому сотруднику (агрегируем задачи недели → берём эффективность спринтов).
  const userCharts = useMemo(() => users.map(u => {
    const byWeek: Record<string, { effSum: number; count: number; active: boolean }> = {}
    for (const s of sprintsByUser[u.id] ?? []) {
      const m = mondayOf(s.date_from)
      const e = byWeek[m] ?? { effSum: 0, count: 0, active: false }
      e.effSum += s.efficiency
      e.count += 1
      e.active = e.active || s.sprint_status === 'active'
      byWeek[m] = e
    }
    const points: Pt[] = Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mon, e]) => ({ mon, eff: Math.round(e.effSum / e.count), active: e.active }))
    return { user: u, points }
  }), [users, sprintsByUser])

  return (
    <div className="flex flex-col gap-6">
      <Section label="График по проектам">
        {projectCharts.map(p => (
          <ChartCard key={p.id} title={p.name || 'Без названия'} color={getAvatarColor(p.id)} points={p.points} />
        ))}
      </Section>

      <Section label="График по сотрудникам">
        {userCharts.map(({ user, points }) => (
          <ChartCard key={user.id}
            title={user.full_name || user.login}
            subtitle={user.full_name ? `@${user.login}` : undefined}
            color={getAvatarColor(user.id)}
            points={points} />
        ))}
      </Section>
    </div>
  )
}
