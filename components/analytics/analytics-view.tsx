'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { SprintStat, TaskStat, AnalyticsUser, ProjectAnalytics } from '@/lib/queries/analytics'
import { getAvatarColor } from '@/lib/utils/avatar'
import { usePersistedFilter } from '@/lib/hooks/use-persisted-filter'
import { mondayOf, todayYmd, fmtWeekRange } from '@/lib/utils/week'
import EfficiencySummary from './efficiency-summary'
import AnalyticsCharts from './analytics-charts'

function fmtTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' })
}

function fmtDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function UserAvatar({ user, size = 36 }: { user: AnalyticsUser; size?: number }) {
  const name = user.full_name || user.login
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-semibold"
      style={{ width: size, height: size, background: getAvatarColor(name), color: '#fff', fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase()}
    </div>
  )
}

function TaskStatusBadge({ task }: { task: TaskStat }) {
  const today = new Date().toISOString().slice(0, 10)
  const overdue = task.deadline && task.deadline < today && task.workflow_status !== 'done' && task.task_status !== 'deleted'

  if (task.workflow_status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ background: 'rgba(45,212,160,0.1)', color: 'var(--green)' }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Выполнено
      </span>
    )
  }
  if (task.task_status === 'deleted') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(136,146,164,0.1)', color: 'var(--text2)' }}>
        Удалено
      </span>
    )
  }
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ background: 'rgba(247,192,79,0.1)', color: 'var(--yellow)' }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1L5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="5" cy="7.5" r="0.75" fill="currentColor" />
        </svg>
        Просрочено
      </span>
    )
  }
  const labels: Record<string, string> = {
    new: 'Новая', in_progress: 'В работе', review: 'На проверке', cancelled: 'Отменено',
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
      {labels[task.workflow_status] ?? task.workflow_status}
    </span>
  )
}

function StatCard({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-4 px-3 rounded-xl flex-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <span className="text-2xl font-bold font-mono" style={{ color: color ?? 'var(--text)' }}>{value}</span>
      <span className="text-xs mt-1 uppercase tracking-wide font-medium" style={{ color: 'var(--text2)' }}>{label}</span>
    </div>
  )
}

function SprintHistoryRow({ sprint, showProject }: { sprint: SprintStat; showProject: boolean }) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? sprint.tasks : sprint.tasks.slice(0, 5)

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        className="flex items-center gap-4 px-5 py-3 cursor-pointer"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Период */}
        <div className="flex items-center gap-2" style={{ width: 220, flexShrink: 0 }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: sprint.sprint_status === 'active' ? 'var(--green)' : 'var(--text2)' }} />
          <span className="font-mono text-sm" style={{ color: 'var(--text)' }}>
            {fmtDate(sprint.date_from)} — {fmtDate(sprint.date_to)}
          </span>
          {sprint.is_fixed && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--yellow)', flexShrink: 0 }}>
              <path d="M9 5V4a3 3 0 1 0-6 0v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          )}
        </div>

        {showProject && (
          <span className="text-xs px-2 py-0.5 rounded truncate max-w-[110px]"
            style={{ background: 'var(--surface2)', color: 'var(--text2)', flexShrink: 0 }}>
            {sprint.project_name}
          </span>
        )}

        {/* Задач */}
        <span className="font-mono text-sm text-right" style={{ width: 50, flexShrink: 0, color: 'var(--text)' }}>
          {sprint.total_tasks}
        </span>

        {/* Объём */}
        <span className="font-mono text-sm text-right" style={{ width: 70, flexShrink: 0, color: 'var(--text)' }}>
          {sprint.total_time > 0 ? fmtTime(sprint.total_time) : '—'}
        </span>

        {/* Выполнено */}
        <span className="font-mono text-sm text-right" style={{ width: 70, flexShrink: 0, color: sprint.done_count > 0 ? 'var(--green)' : 'var(--text2)' }}>
          {sprint.done_count}
        </span>

        {/* Отменено */}
        <span className="font-mono text-sm text-right" style={{ width: 60, flexShrink: 0, color: sprint.cancelled_count > 0 ? 'var(--yellow)' : 'var(--text2)' }}>
          {sprint.cancelled_count}
        </span>

        {/* Эффективность */}
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--surface2)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${sprint.efficiency}%`, background: sprint.efficiency >= 80 ? 'var(--green)' : sprint.efficiency >= 50 ? 'var(--accent)' : 'var(--red)' }} />
          </div>
          <span className="font-mono text-xs shrink-0 w-8 text-right"
            style={{ color: sprint.efficiency >= 80 ? 'var(--green)' : sprint.efficiency >= 50 ? 'var(--accent)' : 'var(--text2)' }}>
            {sprint.efficiency}%
          </span>
        </div>

        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ color: 'var(--text2)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <div className="grid text-xs px-5 py-2 font-medium"
            style={{ gridTemplateColumns: '1fr 140px 100px 80px', color: 'var(--text2)', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
            <span>Название задачи</span>
            <span>Статус</span>
            <span>Дедлайн</span>
            <span>Время</span>
          </div>
          {visible.map(task => (
            <div key={task.id} className="grid items-center px-5 py-2.5 text-sm"
              style={{ gridTemplateColumns: '1fr 140px 100px 80px', borderBottom: '1px solid var(--border)' }}>
              <span className="truncate pr-4" style={{ color: 'var(--text)' }}>{task.title}</span>
              <span><TaskStatusBadge task={task} /></span>
              <span className="font-mono text-xs" style={{ color: 'var(--text2)', opacity: task.deadline ? 1 : 0.4 }}>
                {task.deadline ? fmtDateShort(task.deadline) : '—'}
              </span>
              <span className="font-mono text-xs" style={{ color: 'var(--text2)' }}>
                {task.time_estimate ? fmtTime(task.time_estimate) : '—'}
              </span>
            </div>
          ))}
          {sprint.tasks.length > 5 && !showAll && (
            <button
              className="w-full py-2.5 text-xs font-medium"
              style={{ color: 'var(--accent)' }}
              onClick={e => { e.stopPropagation(); setShowAll(true) }}>
              Показать все ({sprint.tasks.length})
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function UserCard({ sprint, missingTimeCount }: { sprint: SprintStat; missingTimeCount: number }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Верхняя строка: период + кнопка фиксации */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm" style={{ color: 'var(--text2)' }}>
          {fmtDate(sprint.date_from)} — {fmtDate(sprint.date_to)}
        </span>
        {sprint.sprint_status === 'active' && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(45,212,160,0.1)', color: 'var(--green)', border: '1px solid rgba(45,212,160,0.2)' }}>
            Активный спринт
          </span>
        )}
      </div>

      {/* Статкарточки */}
      <div className="flex gap-3">
        <StatCard value={sprint.total_tasks} label="Задач" />
        <StatCard value={sprint.total_time > 0 ? fmtTime(sprint.total_time) : '—'} label="Объём" />
        <StatCard value={sprint.done_count} label="Выполнено" color={sprint.done_count > 0 ? 'var(--green)' : undefined} />
        <StatCard value={sprint.cancelled_count} label="Отменено" color={sprint.cancelled_count > 0 ? 'var(--yellow)' : undefined} />
        <StatCard value={sprint.not_done_count} label="Не выполнено" color={sprint.not_done_count > 0 ? 'var(--red)' : undefined} />
      </div>

      {/* Эффективность */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
            ⚡ Эффективность
          </span>
          <span className="font-mono text-sm font-bold"
            style={{ color: sprint.efficiency >= 80 ? 'var(--green)' : sprint.efficiency >= 50 ? 'var(--accent)' : 'var(--red)' }}>
            {sprint.efficiency}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${sprint.efficiency}%`, background: sprint.efficiency >= 80 ? 'var(--green)' : sprint.efficiency >= 50 ? 'var(--accent)' : 'var(--red)' }} />
        </div>
      </div>

      {missingTimeCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ background: 'rgba(247,192,79,0.08)', color: 'var(--yellow)', border: '1px solid rgba(247,192,79,0.15)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5L7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7" cy="10" r="1" fill="currentColor" />
          </svg>
          {missingTimeCount} {missingTimeCount === 1 ? 'задача' : missingTimeCount < 5 ? 'задачи' : 'задач'} без оценки времени — попросите сотрудника поставить время
        </div>
      )}
    </div>
  )
}

function ProjectSelect({ projects, value, allowAll, onChange }: {
  projects: ProjectAnalytics[]; value: string; allowAll: boolean; onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 220 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  const options = [
    ...(allowAll ? [{ id: 'all', name: 'Все проекты' }] : []),
    ...projects.map(p => ({ id: p.project_id, name: p.project_name || 'Без названия' })),
  ]
  const current = options.find(o => o.id === value) ?? options[0]

  function handleOpen() {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 4, left: r.left, width: Math.max(220, r.width) })
    setOpen(o => !o)
  }

  return (
    <>
      <button ref={triggerRef} onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
        style={{ background: 'var(--surface2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, color: 'var(--text)', cursor: 'pointer' }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.7 }}>
          <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 6h12" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <span className="font-medium truncate" style={{ maxWidth: 200 }}>{current?.name}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
          <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={dropRef} className="rounded-xl py-1"
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, maxHeight: 320, overflowY: 'auto', zIndex: 9999, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {options.map(o => {
            const active = o.id === value
            return (
              <button key={o.id} onClick={() => { onChange(o.id); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
                style={{ color: active ? 'var(--accent)' : 'var(--text)', background: active ? 'rgba(124,92,246,0.1)' : 'transparent', cursor: 'pointer' }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                <span className="flex-1 truncate">{o.name}</span>
                {active && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </button>
            )
          })}
        </div>, document.body)}
    </>
  )
}

export default function AnalyticsView({
  projects,
  currentUserId,
}: {
  projects: ProjectAnalytics[]
  isAdmin: boolean
  currentUserId: string
}) {
  const [mode, setMode] = useState<'summary' | 'detail'>('summary')
  const allowAll = projects.length > 1
  const [projectSel, setProjectSel] = usePersistedFilter<string>(
    `analytics-project-${currentUserId}`,
    allowAll ? 'all' : projects[0].project_id,
  )
  // Валидация сохранённого выбора (проект мог исчезнуть)
  const projectId = projectSel === 'all'
    ? (allowAll ? 'all' : projects[0].project_id)
    : (projects.some(p => p.project_id === projectSel) ? projectSel : (allowAll ? 'all' : projects[0].project_id))

  const selectedProjects = projectId === 'all' ? projects : projects.filter(p => p.project_id === projectId)

  const { users, sprintsByUser } = useMemo(() => {
    const uMap = new Map<string, AnalyticsUser>()
    const sMap: Record<string, SprintStat[]> = {}
    for (const p of selectedProjects) {
      for (const u of p.users) if (!uMap.has(u.id)) uMap.set(u.id, u)
      for (const [uid, arr] of Object.entries(p.sprintsByUser)) (sMap[uid] ??= []).push(...arr)
    }
    const list = [...uMap.values()].sort((a, b) => (a.full_name || a.login).localeCompare(b.full_name || b.login))
    return { users: list, sprintsByUser: sMap }
  }, [selectedProjects])

  const initialUserId = users.find(u => u.id === currentUserId)?.id ?? users[0]?.id ?? ''
  const [selectedId, setSelectedId] = useState(initialUserId)
  const effectiveId = users.some(u => u.id === selectedId) ? selectedId : initialUserId
  const selectedUser = users.find(u => u.id === effectiveId) ?? users[0]
  const sprints = sprintsByUser[effectiveId] ?? []

  const activeSprint = sprints.find(s => s.sprint_status === 'active')
  const history = sprints.filter(s => s.sprint_status === 'closed')
  const [showAllHistory, setShowAllHistory] = useState(false)
  const visibleHistory = showAllHistory ? history : history.slice(0, 3)

  const missingTimeCount = activeSprint?.tasks.filter(t => !t.time_estimate && t.task_status !== 'deleted').length ?? 0
  const multiProject = sprints.length > 0 && new Set(sprints.map(s => s.project_id)).size > 1

  const currentWeek = mondayOf(todayYmd())

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Верхняя панель: режим, проект, период недели */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex items-center rounded-lg overflow-hidden self-start" style={{ border: '1px solid var(--border)' }}>
          {([['summary', 'Сводка'], ['detail', 'По сотруднику']] as const).map(([m, label], i) => (
            <button key={m} onClick={() => setMode(m)}
              className="px-4 py-1.5 text-sm font-medium"
              style={{
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text2)',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>

        <ProjectSelect projects={projects} value={projectId} allowAll={allowAll} onChange={setProjectSel} />

        <div className="flex-1" />

        {/* Период текущей недели */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--accent)' }}>
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2 6h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span style={{ color: 'var(--text2)' }}>Текущая неделя:</span>
          <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{fmtWeekRange(currentWeek)}</span>
        </div>
      </div>

      {mode === 'summary' ? (
        <div className="flex-1 overflow-y-auto flex flex-col gap-6 pb-4">
          <EfficiencySummary
            users={users}
            sprintsByUser={sprintsByUser}
            currentUserId={currentUserId}
            onOpenUser={id => { setSelectedId(id); setMode('detail') }}
          />
          <AnalyticsCharts projects={selectedProjects} users={users} sprintsByUser={sprintsByUser} />
        </div>
      ) : (
    <div className="flex gap-6 flex-1 overflow-hidden">
      {/* Левая панель: список сотрудников */}
      <div className="flex flex-col gap-1 shrink-0 overflow-y-auto" style={{ width: 220 }}>
        {users.map(user => {
          const name = user.full_name || user.login
          const isSelected = user.id === effectiveId
          return (
            <button
              key={user.id}
              onClick={() => setSelectedId(user.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left w-full"
              style={{
                background: isSelected ? 'rgba(124,92,246,0.1)' : 'transparent',
                border: isSelected ? '1px solid rgba(124,92,246,0.2)' : '1px solid transparent',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              <UserAvatar user={user} size={30} />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate" style={{ color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                  {name}
                </span>
                {user.role === 'admin' && (
                  <span className="text-xs" style={{ color: 'var(--text2)' }}>Администратор</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Правая панель: данные выбранного сотрудника */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 pb-6">
        {/* Шапка сотрудника */}
        <div className="flex items-center gap-3">
          <UserAvatar user={selectedUser} size={44} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              {selectedUser.full_name || selectedUser.login}
            </h2>
            {selectedUser.full_name && (
              <span className="text-sm" style={{ color: 'var(--text2)' }}>@{selectedUser.login}</span>
            )}
          </div>
        </div>

        {sprints.length === 0 ? (
          <div className="flex items-center justify-center py-16 rounded-xl" style={{ border: '1px dashed var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text2)' }}>Нет данных о спринтах</p>
          </div>
        ) : (
          <>
            {/* Текущий спринт */}
            {activeSprint && (
              <div className="flex flex-col gap-2">
                <UserCard sprint={activeSprint} missingTimeCount={missingTimeCount} />

                {/* Список задач текущего спринта */}
                {activeSprint.tasks.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div className="px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                      Список задач
                    </div>
                    <div className="grid text-xs px-5 py-2 font-medium"
                      style={{ gridTemplateColumns: '1fr 140px 100px 80px 28px', color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                      <span>Название задачи</span>
                      <span>Статус</span>
                      <span>Дедлайн</span>
                      <span>Закрыта</span>
                      <span>Время</span>
                    </div>
                    {activeSprint.tasks.map(task => (
                      <div key={task.id} className="grid items-center px-5 py-2.5 text-sm"
                        style={{ gridTemplateColumns: '1fr 140px 100px 80px 28px', borderBottom: '1px solid var(--border)' }}>
                        <span className="truncate pr-4" style={{ color: 'var(--text)' }}>{task.title}</span>
                        <span><TaskStatusBadge task={task} /></span>
                        <span className="font-mono text-xs" style={{ color: 'var(--text2)', opacity: task.deadline ? 1 : 0.4 }}>
                          {task.deadline ? fmtDateShort(task.deadline) : '—'}
                        </span>
                        <span className="font-mono text-xs" style={{ color: 'var(--text2)', opacity: task.closed_at ? 1 : 0.4 }}>
                          {task.closed_at ? fmtDateShort(task.closed_at.slice(0, 10)) : '—'}
                        </span>
                        <span className="font-mono text-xs" style={{ color: 'var(--text2)' }}>
                          {task.time_estimate ? fmtTime(task.time_estimate) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* История недель */}
            {history.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-medium uppercase tracking-wide px-1" style={{ color: 'var(--text2)' }}>
                  ▼ История недель
                </span>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <div className="flex items-center gap-4 px-5 py-2.5 text-xs font-medium"
                    style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                    <span style={{ width: 220, flexShrink: 0 }}>Период</span>
                    {multiProject && <span style={{ width: 110, flexShrink: 0 }}>Проект</span>}
                    <span style={{ width: 50, flexShrink: 0 }} className="text-right">Задач</span>
                    <span style={{ width: 70, flexShrink: 0 }} className="text-right">Объём</span>
                    <span style={{ width: 70, flexShrink: 0 }} className="text-right">Выполнено</span>
                    <span style={{ width: 60, flexShrink: 0 }} className="text-right">Отменено</span>
                    <span className="flex-1">Эффективность</span>
                  </div>
                  {visibleHistory.map(sprint => (
                    <SprintHistoryRow key={sprint.sprint_id} sprint={sprint} showProject={multiProject} />
                  ))}
                  {history.length > 3 && !showAllHistory && (
                    <button
                      className="w-full py-3 text-sm font-medium"
                      style={{ color: 'var(--accent)', borderTop: '1px solid var(--border)' }}
                      onClick={() => setShowAllHistory(true)}>
                      Показать все ({history.length})
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
      )}
    </div>
  )
}
