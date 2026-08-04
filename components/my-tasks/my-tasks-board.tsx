'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import type { MyTask } from '@/lib/queries/my-tasks'
import MyTaskCard from './my-task-card'
import TaskDrawer from '@/components/backlog/task-drawer'
import { getTaskForDrawer, fetchTasksForUser, updateTaskWorkflowStatus, updateTaskPriority } from '@/app/(dashboard)/my-tasks/actions'
import type { BacklogTask, WorkflowStatus } from '@/types'

type Profile = { id: string; full_name: string | null; login: string; avatar_url: string | null }

type Props = {
  tasks: MyTask[]
  currentUserId: string
  isAdmin: boolean
  allProfiles: Profile[]
}

type RoleFilter = 'assignee' | 'creator'
type ColumnKey = 'overdue' | 'today' | 'this_week' | 'next_week' | 'no_deadline' | 'completed'

const COLUMNS: { key: ColumnKey; label: string; color: string; bg: string }[] = [
  { key: 'overdue',    label: 'Просрочены',          color: '#F75C6E', bg: 'rgba(247,92,110,0.12)' },
  { key: 'today',      label: 'На сегодня',           color: '#2DD4A0', bg: 'rgba(45,212,160,0.12)' },
  { key: 'this_week',  label: 'На этой неделе',       color: '#4F8EF7', bg: 'rgba(79,142,247,0.12)' },
  { key: 'next_week',  label: 'На следующей неделе',  color: '#8892A4', bg: 'rgba(136,146,164,0.10)' },
  { key: 'no_deadline',label: 'Без срока',            color: '#8892A4', bg: 'rgba(136,146,164,0.08)' },
  { key: 'completed',  label: 'Выполненные',          color: '#2DD4A0', bg: 'rgba(45,212,160,0.08)' },
]

function getColumnKey(deadline: string | null, workflowStatus: string): ColumnKey {
  if (workflowStatus === 'done' || workflowStatus === 'cancelled') return 'completed'
  if (!deadline) return 'no_deadline'

  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(deadline + 'T00:00:00'); d.setHours(0,0,0,0)

  const dayOfWeek = today.getDay()
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + daysToSunday)

  const startOfNextWeek = new Date(endOfWeek); startOfNextWeek.setDate(endOfWeek.getDate() + 1)
  const endOfNextWeek = new Date(startOfNextWeek); endOfNextWeek.setDate(startOfNextWeek.getDate() + 6)

  if (d < today) return 'overdue'
  if (d.getTime() === today.getTime()) return 'today'
  if (d <= endOfWeek) return 'this_week'
  if (d <= endOfNextWeek) return 'next_week'
  return 'no_deadline'
}

// ——— Dropdown components ———

function ProjectDropdown({
  projects,
  value,
  onChange,
}: {
  projects: { id: string; name: string; color: string }[]
  value: string | null
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const selected = projects.find(p => p.id === value)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  function handleOpen() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
    setOpen(o => !o)
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
        style={{
          background: open ? 'var(--surface2)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: selected ? 'var(--text)' : 'var(--text2)',
          cursor: 'pointer',
        }}
      >
        {selected ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selected.color }} />
            {selected.name}
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 4.5h10M1 4.5V9a1.5 1.5 0 001.5 1.5h7A1.5 1.5 0 0011 9V4.5M1 4.5V3A1.5 1.5 0 012.5 1.5H5l1 1h3.5A1.5 1.5 0 0111 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Все проекты
          </>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
          <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropRef}
          className="rounded-xl py-1"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: 220,
            maxHeight: 300,
            overflowY: 'auto',
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
            style={{ color: !value ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            Все проекты
            {!value && <svg className="ml-auto" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ color: value === p.id ? 'var(--accent)' : 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="truncate flex-1">{p.name}</span>
              {value === p.id && <svg className="ml-auto shrink-0" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

function EmployeeDropdown({
  profiles,
  value,
  onChange,
}: {
  profiles: Profile[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const selected = profiles.find(p => p.id === value)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node) || dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  function handleOpen() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left })
    setOpen(o => !o)
  }

  const displayName = selected?.full_name || selected?.login || ''
  const initial = displayName[0]?.toUpperCase()

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
        style={{
          background: open ? 'var(--surface2)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: 'var(--text)',
          cursor: 'pointer',
        }}
      >
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
          style={{ background: 'var(--accent)', color: '#fff' }}>
          {initial}
        </div>
        <span className="max-w-[140px] truncate">{displayName}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
          <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropRef}
          className="rounded-xl py-1"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: 220,
            maxHeight: 320,
            overflowY: 'auto',
            zIndex: 9999,
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'dropdownIn 0.12s ease-out',
          }}
        >
          {profiles.map(p => {
            const name = p.full_name || p.login
            return (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
                style={{ color: p.id === value ? 'var(--accent)' : 'var(--text)', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ background: 'var(--accent)', color: '#fff' }}>
                  {name[0]?.toUpperCase()}
                </div>
                <span className="flex-1 truncate">{name}</span>
                {p.id === value && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}

// ——— Main Board ———

export default function MyTasksBoard({ tasks: initialTasks, currentUserId, isAdmin, allProfiles }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState<MyTask[]>(initialTasks)
  // Все видят и свои задачи (исполнитель), и те, что поставили сами (постановщик) —
  // сотрудники тоже раздают задачи друг другу. Сузить можно кнопками.
  const [roleFilter, setRoleFilter] = useState<RoleFilter[]>(['assignee', 'creator'])
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  const [targetUserId, setTargetUserId] = useState(currentUserId)
  const [loadingTarget, setLoadingTarget] = useState(false)

  // Drawer state
  const [drawerData, setDrawerData] = useState<Awaited<ReturnType<typeof getTaskForDrawer>>>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)

  // Refresh tasks when targetUserId changes
  useEffect(() => {
    if (targetUserId === currentUserId) return
    setLoadingTarget(true)
    fetchTasksForUser(targetUserId)
      .then(data => { setTasks(data); setLoadingTarget(false) })
      .catch(() => setLoadingTarget(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId])

  function toggleRole(role: RoleFilter) {
    setRoleFilter(prev => {
      if (prev.includes(role)) {
        if (prev.length === 1) return prev  // минимум один выбран
        return prev.filter(r => r !== role)
      }
      return [...prev, role]
    })
  }

  // Derive unique projects from tasks
  const projects = (() => {
    const map = new Map<string, { id: string; name: string; color: string }>()
    for (const t of tasks) {
      if (!map.has(t.project_id)) map.set(t.project_id, { id: t.project_id, name: t.project_name, color: t.project_color })
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  })()

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    const byRole = (
      (roleFilter.includes('assignee') && t.assignee_id === targetUserId) ||
      (roleFilter.includes('creator') && t.creator_id === targetUserId)
    )
    if (!byRole) return false
    if (projectFilter && t.project_id !== projectFilter) return false
    return true
  })

  // Group into columns
  const grouped = Object.fromEntries(COLUMNS.map(c => [c.key, [] as MyTask[]])) as Record<ColumnKey, MyTask[]>
  for (const t of filteredTasks) {
    const col = getColumnKey(t.deadline, t.workflow_status)
    grouped[col].push(t)
  }

  async function handleStatusChange(taskId: string, newStatus: WorkflowStatus) {
    const prev = tasks.find(t => t.id === taskId)?.workflow_status
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, workflow_status: newStatus } : t))
    try {
      await updateTaskWorkflowStatus(taskId, newStatus)
    } catch {
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, workflow_status: prev as WorkflowStatus } : t))
    }
  }

  async function handlePriorityChange(taskId: string, priority: 'medium' | 'high' | null) {
    const prev = tasks.find(t => t.id === taskId)?.priority
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, priority } : t))
    try {
      await updateTaskPriority(taskId, priority)
    } catch {
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, priority: prev as any } : t))
    }
  }

  async function handleCardClick(taskId: string) {
    setDrawerLoading(true)
    const data = await getTaskForDrawer(taskId)
    setDrawerData(data)
    setDrawerLoading(false)
  }

  function handleDrawerUpdated(updated: Partial<BacklogTask> & { id: string }) {
    setTasks(prev => prev.map(t => t.id === updated.id
      ? {
          ...t,
          ...(updated.workflow_status ? { workflow_status: updated.workflow_status } : {}),
          ...(updated.priority !== undefined ? { priority: updated.priority as any } : {}),
          ...(updated.deadline !== undefined ? { deadline: updated.deadline } : {}),
          ...(updated.title ? { title: updated.title } : {}),
          ...(updated.assignee_id !== undefined ? { assignee_id: updated.assignee_id } : {}),
        }
      : t
    ))
    router.refresh()
  }

  const targetDisplayName = (() => {
    if (targetUserId === currentUserId) return null
    const p = allProfiles.find(p => p.id === targetUserId)
    return p?.full_name || p?.login || ''
  })()

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Шапка */}
      <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Мои задачи
              {targetDisplayName && (
                <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text2)' }}>
                  — {targetDisplayName}
                </span>
              )}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
              {filteredTasks.length} задач из всех проектов
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Фильтр по роли */}
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
              <button
                onClick={() => toggleRole('assignee')}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: roleFilter.includes('assignee') ? 'var(--accent)' : 'transparent',
                  color: roleFilter.includes('assignee') ? '#fff' : 'var(--text2)',
                  cursor: 'pointer',
                }}
              >
                Я исполнитель
              </button>
              <button
                onClick={() => toggleRole('creator')}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: roleFilter.includes('creator') ? 'var(--accent)' : 'transparent',
                  color: roleFilter.includes('creator') ? '#fff' : 'var(--text2)',
                  cursor: 'pointer',
                }}
              >
                Я постановщик
              </button>
            </div>

            {/* Фильтр по проекту */}
            <ProjectDropdown
              projects={projects}
              value={projectFilter}
              onChange={setProjectFilter}
            />

            {/* Выбор сотрудника (только admin) */}
            {isAdmin && allProfiles.length > 0 && (
              <EmployeeDropdown
                profiles={allProfiles}
                value={targetUserId}
                onChange={id => {
                  setTargetUserId(id)
                  setProjectFilter(null)
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Канбан доска */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full px-6 py-4" style={{ minWidth: 'max-content' }}>
          {COLUMNS.map(col => {
            const colTasks = grouped[col.key]
            return (
              <div
                key={col.key}
                className="flex flex-col"
                style={{ width: 300, minWidth: 300 }}
              >
                {/* Шапка колонки */}
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 shrink-0"
                  style={{ background: col.bg }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                  <span className="text-sm font-medium" style={{ color: col.color }}>
                    {col.label}
                  </span>
                  <span
                    className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.2)', color: col.color }}
                  >
                    {colTasks.length}
                  </span>
                </div>

                {/* Карточки */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pb-4" style={{ scrollbarWidth: 'thin' }}>
                  {loadingTarget ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-xl p-3 animate-pulse"
                        style={{ background: 'var(--surface)', height: 100, opacity: 0.5 - i * 0.1 }}
                      />
                    ))
                  ) : colTasks.length === 0 ? (
                    <div
                      className="flex items-center justify-center text-xs rounded-xl"
                      style={{ height: 64, color: 'var(--text2)', border: '1px dashed var(--border)', opacity: 0.5 }}
                    >
                      Нет задач
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <MyTaskCard
                        key={task.id}
                        task={task}
                        currentUserId={targetUserId}
                        onClick={() => handleCardClick(task.id)}
                        onStatusChange={handleStatusChange}
                        onPriorityChange={handlePriorityChange}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Drawer загрузка */}
      {drawerLoading && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-end"
          style={{ background: 'rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-center justify-center" style={{ width: 560, height: '100%' }}>
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        </div>
      )}

      {/* Task Drawer */}
      {drawerData && (
        <TaskDrawer
          task={drawerData.task}
          projectId={drawerData.task.project_id}
          members={drawerData.members}
          epics={drawerData.epics}
          initialComments={drawerData.comments}
          onClose={() => setDrawerData(null)}
          onUpdated={handleDrawerUpdated}
        />
      )}
    </div>
  )
}
