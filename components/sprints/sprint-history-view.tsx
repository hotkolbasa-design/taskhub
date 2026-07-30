'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SprintStat, TaskStat } from '@/lib/queries/analytics'
import { unfixSprint, deleteClosedSprint } from '@/app/(dashboard)/projects/[id]/sprint/actions'
import { getTaskForDrawer, type DrawerData } from '@/app/(dashboard)/my-tasks/actions'
import TaskDrawer from '@/components/backlog/task-drawer'

function fmtTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yy = String(dt.getFullYear()).slice(2)
  return `${dd}.${mm}.${yy}`
}

function fmtDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function TaskStatusBadge({ task }: { task: TaskStat }) {
  const today = new Date().toISOString().slice(0, 10)
  const overdue = task.deadline && task.deadline < today && task.workflow_status !== 'done' && task.workflow_status !== 'cancelled' && task.task_status !== 'deleted'

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
  if (task.workflow_status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(136,146,164,0.1)', color: 'var(--text2)' }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Отменена
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
    new: 'Новая', in_progress: 'В работе', review: 'На проверке',
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
      style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
      <span className="text-2xl font-bold font-mono" style={{ color: color ?? 'var(--text)' }}>{value}</span>
      <span className="text-xs mt-1 uppercase tracking-wide font-medium" style={{ color: 'var(--text2)' }}>{label}</span>
    </div>
  )
}

function TaskRow({ task, isSubtask = false, overrideTime, onOpen }: { task: TaskStat; isSubtask?: boolean; overrideTime?: number | null; onOpen: (taskId: string) => void }) {
  const displayTime = overrideTime !== undefined ? overrideTime : task.time_estimate
  return (
    <div className="grid items-center text-sm"
      onClick={() => onOpen(task.id)}
      style={{
        gridTemplateColumns: '1fr 140px 100px 80px',
        borderBottom: '1px solid var(--border)',
        background: isSubtask ? 'rgba(255,255,255,0.018)' : 'transparent',
        cursor: 'pointer',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={e => (e.currentTarget.style.background = isSubtask ? 'rgba(255,255,255,0.018)' : 'transparent')}>
      <span className="flex items-center gap-2 truncate pr-4 py-2.5"
        style={{ paddingLeft: isSubtask ? 36 : 16 }}>
        {task.type === 'epic' && (
          <span className="shrink-0 w-4 h-4 rounded flex items-center justify-center"
            style={{ background: 'rgba(247,192,79,0.15)', color: 'var(--yellow)' }}>
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M1 7L4 2L6.5 6L8 4L9 7H1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
            </svg>
          </span>
        )}
        <span style={{ color: isSubtask ? 'var(--text2)' : 'var(--text)', fontSize: isSubtask ? '0.8rem' : undefined }}>{task.title}</span>
      </span>
      <span className="py-2.5"><TaskStatusBadge task={task} /></span>
      <span className="font-mono text-xs py-2.5" style={{ color: 'var(--text2)', opacity: task.deadline ? 1 : 0.4 }}>
        {task.deadline ? fmtDateShort(task.deadline) : '—'}
      </span>
      <span className="font-mono text-xs py-2.5" style={{ color: 'var(--text2)' }}>
        {displayTime ? fmtTime(displayTime) : '—'}
      </span>
    </div>
  )
}

function EpicGroup({ epic, subtasks, onOpen }: { epic: TaskStat; subtasks: TaskStat[]; onOpen: (taskId: string) => void }) {
  const epicTime = subtasks.reduce((s, t) => s + (t.time_estimate ?? 0), 0)
  return (
    <div style={{ borderLeft: '2px solid rgba(247,192,79,0.45)', marginBottom: subtasks.length ? 0 : undefined }}>
      {/* Epic header */}
      <div className="grid items-center text-sm"
        onClick={() => onOpen(epic.id)}
        style={{
          gridTemplateColumns: '1fr 140px 100px 80px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(247,192,79,0.05)',
          cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(247,192,79,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(247,192,79,0.05)')}>
        <span className="flex items-center gap-2 truncate pr-4 py-2.5" style={{ paddingLeft: 14 }}>
          <span className="shrink-0 w-4 h-4 rounded flex items-center justify-center"
            style={{ background: 'rgba(247,192,79,0.15)', color: 'var(--yellow)' }}>
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M1 7L4 2L6.5 6L8 4L9 7H1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
            </svg>
          </span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>{epic.title}</span>
          {subtasks.length > 0 && (
            <span className="text-xs shrink-0" style={{ color: 'var(--text2)', opacity: 0.6 }}>{subtasks.length} задач</span>
          )}
        </span>
        <span className="py-2.5"><TaskStatusBadge task={epic} /></span>
        <span className="font-mono text-xs py-2.5" style={{ color: 'var(--text2)', opacity: epic.deadline ? 1 : 0.4 }}>
          {epic.deadline ? fmtDateShort(epic.deadline) : '—'}
        </span>
        <span className="font-mono text-xs py-2.5" style={{ color: 'var(--text2)' }}>
          {epicTime ? fmtTime(epicTime) : '—'}
        </span>
      </div>
      {/* Subtasks */}
      {subtasks.map(sub => (
        <TaskRow key={sub.id} task={sub} isSubtask onOpen={onOpen} />
      ))}
    </div>
  )
}

function TaskList({ tasks, allTasks, onOpen }: { tasks: TaskStat[]; allTasks: TaskStat[]; onOpen: (taskId: string) => void }) {
  const epics = tasks.filter(t => t.type === 'epic')
  const epicIds = new Set(epics.map(e => e.id))
  const standalone = tasks.filter(t => t.type !== 'epic' && !t.parent_task_id)

  // Строим subtaskMap по ВСЕМ задачам спринта, чтобы счётчик и время были корректными
  const subtaskMap: Record<string, TaskStat[]> = {}
  for (const t of allTasks) {
    if (t.type !== 'epic' && t.parent_task_id && epicIds.has(t.parent_task_id)) {
      if (!subtaskMap[t.parent_task_id]) subtaskMap[t.parent_task_id] = []
      subtaskMap[t.parent_task_id].push(t)
    }
  }

  return (
    <>
      {epics.map(epic => (
        <EpicGroup key={epic.id} epic={epic} subtasks={subtaskMap[epic.id] ?? []} onOpen={onOpen} />
      ))}
      {standalone.map(task => (
        <TaskRow key={task.id} task={task} onOpen={onOpen} />
      ))}
    </>
  )
}

function SprintCard({ sprint, isAdmin, onOpenTask }: { sprint: SprintStat; isAdmin: boolean; onOpenTask: (taskId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isFixed, setIsFixed] = useState(sprint.is_fixed)
  const [visible, setVisible] = useState(true)
  const router = useRouter()
  const visibleTasks = showAll ? sprint.tasks : sprint.tasks.slice(0, 5)
  const isClosed = sprint.sprint_status === 'closed'

  async function handleDelete() {
    setDeleting(true)
    try {
      if (isClosed) {
        await deleteClosedSprint(sprint.sprint_id, sprint.project_id)
        setVisible(false)
      } else {
        await unfixSprint(sprint.sprint_id, sprint.project_id)
        setIsFixed(false)
      }
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  if (!visible) return null

  const effColor = sprint.efficiency >= 80 ? 'var(--green)' : sprint.efficiency >= 50 ? 'var(--accent)' : 'var(--red)'

  return (
    <div className="rounded-xl flex flex-col gap-4 p-5" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      {/* Шапка: период + статус */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0"
            style={{ background: sprint.sprint_status === 'active' ? 'var(--green)' : 'var(--text2)' }} />
          <span className="font-mono font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {fmtDate(sprint.date_from)} — {fmtDate(sprint.date_to)}
          </span>
          {isAdmin && (isFixed || isClosed) && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              title={isClosed ? 'Удалить спринт' : 'Удалить снапшот'}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md"
              style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'var(--red)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              {deleting
                ? <span className="block w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }} />
                : <>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M1.5 3h9M4 3V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V3M5 5.5v3M7 5.5v3M2.5 3l.6 6.5a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9L9.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {isClosed ? 'Удалить спринт' : 'Удалить снапшот'}
                  </>
              }
            </button>
          )}
        </div>
        {sprint.sprint_status === 'active' ? (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(45,212,160,0.1)', color: 'var(--green)', border: '1px solid rgba(45,212,160,0.2)' }}>
            Активный спринт
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(136,146,164,0.1)', color: 'var(--text2)', border: '1px solid rgba(136,146,164,0.2)' }}>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Завершён
          </span>
        )}
      </div>

      {/* Стат-карточки */}
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
          <span className="font-mono text-sm font-bold" style={{ color: effColor }}>
            {sprint.efficiency}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${sprint.efficiency}%`, background: effColor }} />
        </div>
      </div>

      {/* Список задач */}
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: 'var(--text2)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {open ? 'Скрыть задачи' : `Показать задачи (${sprint.tasks.length})`}
        </button>

        {open && (
          <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="grid text-xs px-4 py-2 font-medium"
              style={{ gridTemplateColumns: '1fr 140px 100px 80px', color: 'var(--text2)', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <span>Название задачи</span>
              <span>Статус</span>
              <span>Дедлайн</span>
              <span>Время</span>
            </div>
            <TaskList tasks={visibleTasks} allTasks={sprint.tasks} onOpen={onOpenTask} />
            {sprint.tasks.length > 5 && !showAll && (
              <button
                className="w-full py-2.5 text-xs font-medium"
                style={{ color: 'var(--accent)', cursor: 'pointer' }}
                onClick={() => setShowAll(true)}>
                Показать все ({sprint.tasks.length})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SprintHistoryView({ sprints, isAdmin = false }: { sprints: SprintStat[]; isAdmin?: boolean }) {
  const [drawerData, setDrawerData] = useState<DrawerData | null>(null)
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null)

  async function handleOpenTask(taskId: string) {
    if (loadingTaskId) return
    setLoadingTaskId(taskId)
    try {
      const data = await getTaskForDrawer(taskId)
      if (data) setDrawerData(data)
    } finally {
      setLoadingTaskId(null)
    }
  }

  if (!sprints.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: 'var(--text2)' }}>Спринтов пока нет</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {sprints.map(sprint => (
        <SprintCard key={sprint.sprint_id} sprint={sprint} isAdmin={isAdmin} onOpenTask={handleOpenTask} />
      ))}

      {/* Загрузка задачи */}
      {loadingTaskId && !drawerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <span className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: '#fff' }} />
        </div>
      )}

      {/* Просмотр задачи из истории (только чтение) */}
      {drawerData && (
        <TaskDrawer
          task={drawerData.task}
          projectId={drawerData.task.project_id}
          members={drawerData.members}
          epics={drawerData.epics}
          initialComments={drawerData.comments}
          onClose={() => setDrawerData(null)}
          onUpdated={() => {}}
          readOnly
        />
      )}
    </div>
  )
}
