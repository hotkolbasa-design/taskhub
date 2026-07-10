'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SprintTask, Sprint, BacklogTask } from '@/types'
import { minutesToDisplay } from '@/lib/utils/time'
import { updateTask, moveBackToBacklog, updateSprintPeriod, deleteSprint, removeFromEpic, createSprintTask } from '@/app/(dashboard)/projects/[id]/backlog/actions'
import { getTasksMissingData, fixSprint, unfixSprint, closeSprint } from '@/app/(dashboard)/projects/[id]/sprint/actions'
import TaskCard from './task-card'
import CreateTaskModal from './create-task-modal'

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function MiniCalendar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [view, setView] = useState(() => value ? new Date(value + 'T00:00:00') : new Date())
  const year = view.getFullYear()
  const month = view.getMonth()

  let startDow = new Date(year, month, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells: { day: number; month: number; year: number; cur: boolean }[] = []
  for (let i = startDow - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, month: month - 1, year: month === 0 ? year - 1 : year, cur: false })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, month, year, cur: true })
  while (cells.length % 7 !== 0) {
    const d = cells.length - daysInMonth - startDow + 1
    cells.push({ day: d, month: month + 1, year: month === 11 ? year + 1 : year, cur: false })
  }

  const sel = value ? (() => { const d = new Date(value + 'T00:00:00'); d.setHours(0,0,0,0); return d })() : null

  return (
    <div style={{ width: 224 }}>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setView(new Date(year, month - 1, 1))}
          className="p-1 rounded" style={{ color: 'var(--text2)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 3L4.5 6L7.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
          {MONTHS_RU[month]} {year}
        </span>
        <button type="button" onClick={() => setView(new Date(year, month + 1, 1))}
          className="p-1 rounded" style={{ color: 'var(--text2)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS_SHORT.map(wd => (
          <div key={wd} className="text-center text-xs" style={{ color: 'var(--text2)', fontSize: 10 }}>{wd}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          const d = new Date(c.year, c.month, c.day); d.setHours(0,0,0,0)
          const isSelected = sel && d.getTime() === sel.getTime()
          return (
            <button key={i} type="button"
              onClick={() => onChange(toIso(new Date(c.year, c.month, c.day)))}
              className="rounded text-center transition-colors"
              style={{
                height: 26, fontSize: 11,
                color: !c.cur ? 'var(--text2)' : isSelected ? '#fff' : 'var(--text)',
                background: isSelected ? 'var(--accent)' : 'transparent',
                opacity: !c.cur ? 0.35 : 1,
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              {c.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PeriodEditor({
  sprint, onClose, onSaved,
}: {
  sprint: Sprint
  onClose: () => void
  onSaved: (from: string, to: string) => void
}) {
  const [dateFrom, setDateFrom] = useState(sprint.date_from)
  const [dateTo, setDateTo] = useState(sprint.date_to)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'from' | 'to'>('from')

  async function handleSave() {
    if (!dateFrom || !dateTo) return
    setSaving(true)
    try {
      await updateSprintPeriod(sprint.id, sprint.project_id, dateFrom, dateTo)
      onSaved(dateFrom, dateTo)
    } finally {
      setSaving(false)
    }
  }

  function formatFull(iso: string) {
    if (!iso) return '—'
    const d = new Date(iso + 'T00:00:00')
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(2)}`
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 20, width: 280, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', animation: 'dropdownIn 0.12s ease-out' }}>
        <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Период спринта</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          {(['from', 'to'] as const).map(s => (
            <button key={s} type="button" onClick={() => setStep(s)}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: step === s ? 'var(--accent)' : 'var(--surface2)',
                color: step === s ? '#fff' : 'var(--text2)',
                cursor: 'pointer',
              }}>
              {s === 'from' ? `Начало: ${formatFull(dateFrom)}` : `Конец: ${formatFull(dateTo)}`}
            </button>
          ))}
        </div>

        {/* Calendar */}
        {step === 'from' ? (
          <MiniCalendar value={dateFrom} onChange={v => { setDateFrom(v); setStep('to') }} />
        ) : (
          <MiniCalendar value={dateTo} onChange={v => setDateTo(v)} />
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg text-xs transition-colors"
            style={{ background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}>
            Отмена
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !dateFrom || !dateTo}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--accent)', color: '#fff', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export const SPRINT_DROP_ID = 'sprint-panel-drop'
export const SPRINT_EPIC_DROP_PREFIX = 'drop-sprint-epic-'
export const SPRINT_EPIC_END_PREFIX = 'drop-sprint-epic-end-'

export type SprintNode = SprintTask & { subtasks: SprintTask[] }

export function buildSprintTree(tasks: SprintTask[]): SprintNode[] {
  const epicMap: Record<string, SprintNode> = {}

  for (const t of tasks) {
    if (t.type === 'epic') {
      epicMap[t.id] = { ...t, subtasks: [] } as SprintNode
    }
  }

  const topLevel: SprintNode[] = []
  for (const t of tasks) {
    if (t.type === 'epic') {
      topLevel.push(epicMap[t.id])
    } else if (t.parent_task_id && epicMap[t.parent_task_id]) {
      epicMap[t.parent_task_id].subtasks.push({ ...t, subtasks: [] } as SprintNode)
    } else {
      topLevel.push({ ...t, subtasks: [] } as SprintNode)
    }
  }
  return topLevel
}

export function toBacklogTask(t: SprintTask): BacklogTask {
  return { ...t, subtasks: [], subtask_total: 0, subtask_done: 0 }
}

type DragPreview = { container: string; insertAt: number }

type EpicProps = {
  epic: SprintNode
  projectId: string
  subtaskDone: number
  subtaskTotal: number
  subtaskMinutes: number
  onEdit: (t: BacklogTask) => void
  onWorkflowChange: (id: string, status: string) => void
  onDeadlineChange: (id: string, deadline: string | null) => void
  onTimeChange: (id: string, minutes: number | null) => void
  onMoveToBacklog?: (id: string) => void
  onRemoveFromEpic: (id: string) => void
  insertIndicator?: 'before' | 'after'
}

function SprintEpicBlock({
  epic, projectId,
  subtaskDone, subtaskTotal, subtaskMinutes,
  onEdit, onWorkflowChange, onDeadlineChange, onTimeChange, onMoveToBacklog, onRemoveFromEpic,
  insertIndicator,
}: EpicProps) {
  const [expanded, setExpanded] = useState(true)
  const pct = subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0

  const {
    setNodeRef: sortableRef,
    transform,
    transition,
    isDragging,
    attributes: sortableAttributes,
    listeners: sortableListeners,
  } = useSortable({ id: epic.id })

  return (
    <div
      ref={sortableRef}
      className="rounded-xl"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        opacity: isDragging ? 0 : 1,
        boxShadow: insertIndicator === 'before'
          ? '0 -3px 0 0 var(--accent)'
          : insertIndicator === 'after'
            ? '0 3px 0 0 var(--accent)'
            : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div style={{ borderBottom: expanded ? '1px solid var(--border)' : undefined }}>
        <TaskCard
          task={{ ...toBacklogTask(epic), subtask_total: subtaskTotal, subtask_done: subtaskDone, time_estimate: subtaskMinutes || null }}
          projectId={projectId}
          hasActiveSprint={false}
          sortableDisabled
          externalDragHandle={{ attributes: sortableAttributes, listeners: sortableListeners }}
          onOptimisticDelete={() => {}}
          onOptimisticMoveToSprint={() => {}}
          onMoveToBacklog={onMoveToBacklog}
          onEdit={onEdit}
          onWorkflowChange={onWorkflowChange}
          onDeadlineChange={onDeadlineChange}
          onTimeChange={onTimeChange}
          avatarMenuInRow2
          row1Suffix={
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                {subtaskDone}/{subtaskTotal}
              </span>
              {subtaskTotal > 0 && (
                <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--accent)' }} />
                </div>
              )}
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-1 rounded"
                style={{ color: 'var(--text2)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          }
        />
      </div>

      {expanded && epic.subtasks.length > 0 && (
        <div className="flex flex-col" style={{ background: 'var(--surface2)', borderRadius: '0 0 12px 12px' }}>
          {epic.subtasks.map((sub, i) => (
            <div key={sub.id} style={{ borderBottom: i < epic.subtasks.length - 1 ? '1px solid var(--border)' : undefined }}>
              <TaskCard
                task={toBacklogTask(sub)}
                projectId={projectId}
                hasActiveSprint={false}
                sortableDisabled
                onOptimisticDelete={() => {}}
                onOptimisticMoveToSprint={() => {}}
                onMoveToBacklog={onMoveToBacklog}
                onRemoveFromEpic={onRemoveFromEpic}
                onEdit={onEdit}
                onWorkflowChange={onWorkflowChange}
                onDeadlineChange={onDeadlineChange}
                onTimeChange={onTimeChange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SortableSprintTask({
  node, projectId, insertIndicator,
  onMoveToBacklog, onEdit, onWorkflowChange, onDeadlineChange, onTimeChange,
}: {
  node: SprintNode
  projectId: string
  insertIndicator?: 'before' | 'after'
  onMoveToBacklog?: (id: string) => void
  onEdit: (task: BacklogTask) => void
  onWorkflowChange: (id: string, status: string) => void
  onDeadlineChange: (id: string, deadline: string | null) => void
  onTimeChange: (id: string, minutes: number | null) => void
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: node.id })
  return (
    <div
      ref={setNodeRef}
      className="rounded-xl"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        opacity: isDragging ? 0 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        boxShadow: insertIndicator === 'before'
          ? '0 -3px 0 0 var(--accent)'
          : insertIndicator === 'after'
            ? '0 3px 0 0 var(--accent)'
            : undefined,
      }}
    >
      <TaskCard
        task={toBacklogTask(node)}
        projectId={projectId}
        hasActiveSprint={false}
        sortableDisabled
        externalDragHandle={{ attributes, listeners }}
        onOptimisticDelete={() => {}}
        onOptimisticMoveToSprint={() => {}}
        onMoveToBacklog={onMoveToBacklog}
        onEdit={onEdit}
        onWorkflowChange={onWorkflowChange}
        onDeadlineChange={onDeadlineChange}
        onTimeChange={onTimeChange}
      />
    </div>
  )
}

function SprintRootBottomDrop({ disabled }: { disabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-sprint-bottom', disabled })
  return (
    <div
      ref={setNodeRef}
      className="flex items-center justify-center rounded-lg"
      style={{
        height: 36,
        background: isOver ? 'rgba(124,92,246,0.08)' : 'transparent',
        border: `1px dashed ${isOver ? 'rgba(124,92,246,0.5)' : 'rgba(255,255,255,0.06)'}`,
        color: 'var(--accent)',
        fontSize: 11,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {isOver ? 'Отдельная задача' : ''}
    </div>
  )
}

type Member = { id: string; full_name: string | null; login: string; avatar_url: string | null }

type Props = {
  sprint: Sprint
  tasks: SprintTask[]
  activeId: string | null
  dragPreview: DragPreview | null
  onTasksChange: (tasks: SprintTask[]) => void
  onTaskRemoved: (task: SprintTask, subtasks: SprintTask[]) => void
  onEditTask: (task: BacklogTask) => void
  onSprintDeleted: () => void
  isAdmin?: boolean
  members?: Member[]
}

export default function SprintPanel({
  sprint, tasks, dragPreview,
  onTasksChange, onTaskRemoved, onEditTask, onSprintDeleted,
  isAdmin = false,
  members = [],
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: SPRINT_DROP_ID })
  const router = useRouter()
  const [editingPeriod, setEditingPeriod] = useState(false)
  const [localDates, setLocalDates] = useState({ from: sprint.date_from, to: sprint.date_to })
  const [deletingConfirm, setDeletingConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isFixed, setIsFixed] = useState(sprint.is_fixed)
  const [fixing, setFixing] = useState(false)
  const [unfixing, setUnfixing] = useState(false)
  const [showFixModal, setShowFixModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closing, setClosing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [missingData, setMissingData] = useState<{ missingDeadline: { id: string; title: string }[]; missingTime: { id: string; title: string }[] } | null>(null)

  const tree = buildSprintTree(tasks)
  const topLevelIds = tree.map(t => t.id)

  const taskCount = tasks.filter(t => t.type === 'task' && t.workflow_status !== 'cancelled').length
  const epicCount = tasks.filter(t => t.type === 'epic').length
  const totalMinutes = tasks.filter(t => t.type === 'task' && t.workflow_status !== 'cancelled').reduce((s, t) => s + (t.time_estimate ?? 0), 0)

  function formatDate(iso: string) {
    const d = new Date(iso + 'T00:00:00')
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(2)}`
  }

  function getEpicStats(epicId: string) {
    const subs = tasks.filter(t => t.parent_task_id === epicId)
    return {
      total: subs.length,
      done: subs.filter(t => t.workflow_status === 'done').length,
      minutes: subs.reduce((s, t) => s + (t.time_estimate ?? 0), 0),
    }
  }

  async function handleMoveToBacklog(id: string) {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const subtasksToRemove = task.type === 'epic' ? tasks.filter(t => t.parent_task_id === id) : []
    const allIds = new Set([id, ...subtasksToRemove.map(s => s.id)])
    onTasksChange(tasks.filter(t => !allIds.has(t.id)))
    onTaskRemoved(task, subtasksToRemove)
    await moveBackToBacklog(id, sprint.project_id)
    router.refresh()
  }

  async function handleWorkflowChange(id: string, status: string) {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, workflow_status: status as SprintTask['workflow_status'] } : t))
    await updateTask(id, sprint.project_id, { workflow_status: status })
    router.refresh()
  }

  async function handleDeadlineChange(id: string, deadline: string | null) {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, deadline } : t))
    await updateTask(id, sprint.project_id, { deadline })
    router.refresh()
  }

  async function handleTimeChange(id: string, minutes: number | null) {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, time_estimate: minutes } : t))
    await updateTask(id, sprint.project_id, { time_estimate: minutes })
    router.refresh()
  }

  async function handleRemoveFromEpic(id: string) {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, parent_task_id: null } : t))
    await removeFromEpic(id, sprint.project_id)
    router.refresh()
  }

  async function handleUnfix() {
    setUnfixing(true)
    try {
      await unfixSprint(sprint.id, sprint.project_id)
      setIsFixed(false)
      router.refresh()
    } finally {
      setUnfixing(false)
    }
  }

  async function handleFixClick() {
    setFixing(true)
    try {
      const data = await getTasksMissingData(sprint.id)
      setMissingData(data)
      setShowFixModal(true)
    } finally {
      setFixing(false)
    }
  }

  async function handleConfirmFix() {
    setShowFixModal(false)
    setFixing(true)
    try {
      await fixSprint(sprint.id, sprint.project_id)
      setIsFixed(true)
      router.refresh()
    } finally {
      setFixing(false)
    }
  }

  async function handleCloseSprint() {
    setClosing(true)
    try {
      await closeSprint(sprint.id, sprint.project_id)
      setShowCloseModal(false)
      router.refresh()
    } finally {
      setClosing(false)
    }
  }

  async function handleDeleteSprint() {
    setDeleting(true)
    try {
      await deleteSprint(sprint.id, sprint.project_id)
      onSprintDeleted()
      router.refresh()
    } finally {
      setDeleting(false)
      setDeletingConfirm(false)
    }
  }

  async function handleSprintTaskCreated(optimistic: BacklogTask) {
    const sprintTask: SprintTask = {
      ...optimistic,
      sprint_id: sprint.id,
      column_id: null,
      status: 'sprint',
    }
    onTasksChange([...tasks, sprintTask])
    try {
      await createSprintTask(sprint.id, sprint.project_id, {
        title: optimistic.title,
        type: optimistic.type,
        description: optimistic.description,
        assignee_id: optimistic.assignee_id,
        deadline: optimistic.deadline,
        time_estimate: optimistic.time_estimate,
        parent_task_id: optimistic.parent_task_id,
      })
    } catch {
      onTasksChange(tasks)
    }
    router.refresh()
  }

  const isEpicTargeted = dragPreview?.container?.startsWith('sprint-epic-')

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col flex-1 rounded-xl min-w-0"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isOver && !isEpicTargeted ? 'rgba(124,92,246,0.5)' : 'var(--border)'}`,
        transition: 'border-color 0.15s',
      }}
    >
      {/* Шапка — две строки */}
      <div className="flex flex-col px-4 pt-3 pb-2.5 gap-2 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {/* Строка 1: дата + удаление */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: isFixed ? 'var(--yellow)' : 'var(--green)' }} />
            <button
              type="button"
              onClick={() => setEditingPeriod(true)}
              className="flex items-center gap-1.5 group"
              style={{ cursor: 'pointer' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                {formatDate(localDates.from)} — {formatDate(localDates.to)}
              </span>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
                style={{ color: 'var(--text2)', opacity: 0, transition: 'opacity 0.15s' }}
                className="group-hover:opacity-100">
                <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(124,92,246,0.1)', color: 'var(--accent)', border: '1px solid rgba(124,92,246,0.2)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,92,246,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(124,92,246,0.1)')}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Добавить задачу
            </button>
            <button
              type="button"
              onClick={() => setDeletingConfirm(true)}
              className="p-1.5 rounded-md"
              style={{ color: 'var(--text2)', cursor: 'pointer' }}
              title="Удалить спринт"
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M2 3.5h10M5.5 3.5V2.5h3v1M5.5 6v4M8.5 6v4M3 3.5l.7 7.5a1 1 0 001 .9h4.6a1 1 0 001-.9L11 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Строка 2: статы + кнопка фиксации */}
        <div className="flex items-center gap-2">
          {/* Статистика — компактная строка */}
          <div className="flex items-center gap-0 rounded-lg overflow-hidden shrink-0"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            {taskCount > 0 && (
              <div className="flex flex-col items-center px-3 py-1" style={{ minWidth: 44 }}>
                <span className="text-sm font-semibold leading-none" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{taskCount}</span>
                <span className="text-[10px] leading-none mt-0.5" style={{ color: 'var(--text2)' }}>задач</span>
              </div>
            )}
            {taskCount > 0 && epicCount > 0 && (
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />
            )}
            {epicCount > 0 && (
              <div className="flex flex-col items-center px-3 py-1" style={{ minWidth: 44 }}>
                <span className="text-sm font-semibold leading-none" style={{ color: 'var(--yellow)', fontFamily: 'var(--font-mono)' }}>{epicCount}</span>
                <span className="text-[10px] leading-none mt-0.5" style={{ color: 'var(--text2)' }}>эпика</span>
              </div>
            )}
            {totalMinutes > 0 && (epicCount > 0 || taskCount > 0) && (
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />
            )}
            {totalMinutes > 0 && (
              <div className="flex flex-col items-center px-3 py-1" style={{ minWidth: 44 }}>
                <span className="text-sm font-semibold leading-none" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{minutesToDisplay(totalMinutes)}</span>
                <span className="text-[10px] leading-none mt-0.5" style={{ color: 'var(--text2)' }}>объём</span>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {isFixed ? (
              <>
                <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ background: 'rgba(247,192,79,0.1)', color: 'var(--yellow)', border: '1px solid rgba(247,192,79,0.25)', fontFamily: 'var(--font-mono)' }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M9 5V4a3 3 0 1 0-6 0v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  </svg>
                  {sprint.fixed_at
                    ? `Зафиксировано ${new Date(sprint.fixed_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
                    : 'Зафиксировано'}
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleUnfix}
                    disabled={unfixing}
                    title="Удалить снапшот"
                    className="p-1.5 rounded-md"
                    style={{ color: 'var(--text2)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                  >
                    {unfixing
                      ? <span className="block w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--text2)', borderTopColor: 'transparent' }} />
                      : <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M9 4V3a3 3 0 1 0-6 0v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                          <rect x="2" y="4" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                          <path d="M4.5 7.5L7.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        </svg>
                    }
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleFixClick}
                disabled={fixing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(247,192,79,0.08)', color: 'var(--yellow)', border: '1px solid rgba(247,192,79,0.2)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(247,192,79,0.16)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(247,192,79,0.08)')}
              >
                {fixing
                  ? <span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--yellow)', borderTopColor: 'transparent' }} />
                  : <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M9 5V4a3 3 0 1 0-6 0v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                    </svg>
                }
                Зафиксировать
              </button>
            )}

            {/* Завершить спринт — только после фиксации */}
            {isFixed && (
              <button
                type="button"
                onClick={() => setShowCloseModal(true)}
                disabled={closing}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(45,212,160,0.08)', color: 'var(--green)', border: '1px solid rgba(45,212,160,0.2)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,212,160,0.16)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(45,212,160,0.08)')}
              >
                {closing
                  ? <span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--green)', borderTopColor: 'transparent' }} />
                  : <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                }
                Завершить
              </button>
            )}
          </div>

        </div>
      </div>
      {editingPeriod && (
        <PeriodEditor
          sprint={{ ...sprint, date_from: localDates.from, date_to: localDates.to }}
          onClose={() => setEditingPeriod(false)}
          onSaved={(from, to) => { setLocalDates({ from, to }); setEditingPeriod(false); router.refresh() }}
        />
      )}

      {deletingConfirm && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setDeletingConfirm(false) }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'dropdownIn 0.12s ease-out' }}>
            {/* Иконка */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto"
              style={{ background: 'rgba(247,92,110,0.12)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M3 5.5h16M8.5 5.5V4h5v1.5M8.5 9.5v6M13.5 9.5v6M4.5 5.5l1.1 12a1.5 1.5 0 001.5 1.4h7.8a1.5 1.5 0 001.5-1.4l1.1-12" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <p className="text-base font-semibold text-center mb-2" style={{ color: 'var(--text)' }}>Удалить спринт?</p>
            <p className="text-sm text-center mb-6" style={{ color: 'var(--text2)' }}>
              Все задачи и эпики вернутся в бэклог. Это действие нельзя отменить.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteSprint}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'var(--red)', color: '#fff', cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Модалка завершения спринта */}
      {showCloseModal && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowCloseModal(false) }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'dropdownIn 0.12s ease-out' }}>
            <div className="flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto"
              style={{ background: 'rgba(45,212,160,0.12)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="8.5" stroke="var(--green)" strokeWidth="1.5"/>
                <path d="M7 11l3 3 5-5" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <p className="text-base font-semibold text-center mb-2" style={{ color: 'var(--text)' }}>Завершить спринт?</p>
            <p className="text-sm text-center mb-6" style={{ color: 'var(--text2)' }}>
              Спринт будет зафиксирован и закрыт. Добавлять и убирать задачи больше нельзя. Результаты появятся в истории.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCloseSprint}
                disabled={closing}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'var(--green)', color: '#fff', cursor: closing ? 'default' : 'pointer', opacity: closing ? 0.7 : 1 }}
              >
                {closing
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }} />
                      Завершение…
                    </span>
                  : 'Завершить спринт'
                }
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Модалка фиксации */}
      {showFixModal && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowFixModal(false) }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, width: 460, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', animation: 'dropdownIn 0.12s ease-out' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(247,192,79,0.15)' }}>
                <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
                  <path d="M9 5V4a3 3 0 1 0-6 0v1" stroke="var(--yellow)" strokeWidth="1.4" strokeLinecap="round"/>
                  <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="var(--yellow)" strokeWidth="1.4"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Зафиксировать неделю</p>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>После фиксации задачи нельзя удалять из спринта</p>
              </div>
            </div>

            {((missingData?.missingDeadline.length ?? 0) > 0 || (missingData?.missingTime.length ?? 0) > 0) ? (
              <div className="rounded-xl p-3 mb-4 flex flex-col gap-3" style={{ background: 'rgba(247,192,79,0.07)', border: '1px solid rgba(247,192,79,0.2)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--yellow)' }}>Есть задачи с незаполненными данными</p>
                {(missingData?.missingDeadline.length ?? 0) > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs" style={{ color: 'var(--text2)' }}>Без дедлайна:</p>
                    {missingData!.missingDeadline.map(t => (
                      <p key={t.id} className="text-sm pl-2" style={{ color: 'var(--text)', borderLeft: '2px solid rgba(247,192,79,0.4)' }}>{t.title}</p>
                    ))}
                  </div>
                )}
                {(missingData?.missingTime.length ?? 0) > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs" style={{ color: 'var(--text2)' }}>Без оценки времени:</p>
                    {missingData!.missingTime.map(t => (
                      <p key={t.id} className="text-sm pl-2" style={{ color: 'var(--text)', borderLeft: '2px solid rgba(247,192,79,0.4)' }}>{t.title}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: 'rgba(45,212,160,0.07)', border: '1px solid rgba(45,212,160,0.2)' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="var(--green)" strokeWidth="1.3"/>
                  <path d="M5 8l2 2 4-4" stroke="var(--green)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-sm" style={{ color: 'var(--green)' }}>Все задачи заполнены — дедлайны и оценки на месте</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowFixModal(false)}
                className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}>
                Отмена
              </button>
              <button type="button" onClick={handleConfirmFix}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(247,192,79,0.15)', color: 'var(--yellow)', border: '1px solid rgba(247,192,79,0.3)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(247,192,79,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(247,192,79,0.15)')}>
                {(missingData?.missingDeadline.length ?? 0) > 0 || (missingData?.missingTime.length ?? 0) > 0 ? 'Всё равно зафиксировать' : 'Зафиксировать'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Список задач */}
      <div className="flex-1 overflow-y-auto p-3">
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {isOver && tasks.length === 0 && (
              <div
                className="rounded-xl h-12 shrink-0"
                style={{ border: '2px dashed var(--accent)', opacity: 0.4 }}
              />
            )}

            {tree.map((node, i) => {
              const isInsertBefore = dragPreview?.container === 'sprint' && dragPreview.insertAt === i
              const isInsertAfterLast = i === tree.length - 1
                && dragPreview?.container === 'sprint'
                && dragPreview.insertAt >= tree.length
              const insertIndicator = isInsertBefore
                ? 'before' as const
                : isInsertAfterLast
                  ? 'after' as const
                  : undefined

              if (node.type === 'epic') {
                const { total, done, minutes } = getEpicStats(node.id)
                return (
                  <SprintEpicBlock
                    key={node.id}
                    epic={node}
                    projectId={sprint.project_id}
                    subtaskDone={done}
                    subtaskTotal={total}
                    subtaskMinutes={minutes}
                    onEdit={onEditTask}
                    onWorkflowChange={handleWorkflowChange}
                    onDeadlineChange={handleDeadlineChange}
                    onTimeChange={handleTimeChange}
                    onMoveToBacklog={handleMoveToBacklog}
                    onRemoveFromEpic={handleRemoveFromEpic}
                    insertIndicator={insertIndicator}
                  />
                )
              }

              return (
                <SortableSprintTask
                  key={node.id}
                  node={node}
                  projectId={sprint.project_id}
                  insertIndicator={insertIndicator}
                  onMoveToBacklog={handleMoveToBacklog}
                  onEdit={onEditTask}
                  onWorkflowChange={handleWorkflowChange}
                  onDeadlineChange={handleDeadlineChange}
                  onTimeChange={handleTimeChange}
                />
              )
            })}

            {tasks.length === 0 && !isOver && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ opacity: 0.2 }}>
                  <rect x="4" y="4" width="28" height="28" rx="4" stroke="var(--text2)" strokeWidth="1.5"/>
                  <rect x="8" y="8" width="9" height="9" rx="1.5" stroke="var(--text2)" strokeWidth="1.3"/>
                  <rect x="19" y="8" width="9" height="9" rx="1.5" stroke="var(--text2)" strokeWidth="1.3"/>
                  <rect x="8" y="19" width="9" height="9" rx="1.5" stroke="var(--text2)" strokeWidth="1.3"/>
                  <rect x="19" y="19" width="9" height="9" rx="1.5" stroke="var(--text2)" strokeWidth="1.3"/>
                </svg>
                <p className="text-sm text-center" style={{ color: 'var(--text2)' }}>
                  Перетащите задачи из бэклога<br />или нажмите «В спринт»
                </p>
              </div>
            )}

            <SprintRootBottomDrop disabled={false} />
          </div>
        </SortableContext>
      </div>

      {showAddModal && (
        <CreateTaskModal
          projectId={sprint.project_id}
          members={members}
          epics={tasks.filter(t => t.type === 'epic').map(t => ({ ...t, subtasks: [], subtask_total: 0, subtask_done: 0 }))}
          skipCreate
          onClose={() => setShowAddModal(false)}
          onCreated={optimistic => { handleSprintTaskCreated(optimistic); setShowAddModal(false) }}
        />
      )}
    </div>
  )
}
