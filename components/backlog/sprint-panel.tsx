'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { SprintTask, Sprint, BacklogTask } from '@/types'
import { minutesToDisplay } from '@/lib/utils/time'
import { updateTask, moveBackToBacklog } from '@/app/(dashboard)/projects/[id]/backlog/actions'
import TaskCard from './task-card'

export const SPRINT_DROP_ID = 'sprint-panel-drop'
export const SPRINT_EPIC_DROP_PREFIX = 'drop-sprint-epic-'
export const SPRINT_EPIC_END_PREFIX = 'drop-sprint-epic-end-'

export type SprintNode = SprintTask & { subtasks: SprintTask[] }

export function buildSprintTree(tasks: SprintTask[]): SprintNode[] {
  const epicMap: Record<string, SprintNode> = {}

  // Первый проход: создаём узлы эпиков
  for (const t of tasks) {
    if (t.type === 'epic') {
      epicMap[t.id] = { ...t, subtasks: [] } as SprintNode
    }
  }

  // Второй проход: строим дерево В ПОРЯДКЕ входного массива (не эпики-сначала)
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
  activeId: string | null
  dragPreview: DragPreview | null
  onEdit: (t: BacklogTask) => void
  onWorkflowChange: (id: string, status: string) => void
  onDeadlineChange: (id: string, deadline: string | null) => void
  onTimeChange: (id: string, minutes: number | null) => void
  onMoveToBacklog: (id: string) => void
  insertIndicator?: 'before' | 'after'
}

function SprintEpicBlock({
  epic, projectId, activeId, dragPreview,
  onEdit, onWorkflowChange, onDeadlineChange, onTimeChange, onMoveToBacklog,
  insertIndicator,
}: EpicProps) {
  const [expanded, setExpanded] = useState(true)
  const subtaskIds = epic.subtasks.map(s => s.id)

  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `${SPRINT_EPIC_DROP_PREFIX}${epic.id}`,
    disabled: epic.subtasks.length > 0,
  })
  const { setNodeRef: bottomDropRef, isOver: isOverBottom } = useDroppable({
    id: `${SPRINT_EPIC_END_PREFIX}${epic.id}`,
  })

  const isPreviewActive = dragPreview?.container === `sprint-epic-${epic.id}`
  const showBottomPlaceholder = isOverBottom || (isPreviewActive && dragPreview!.insertAt >= epic.subtasks.length)

  return (
    <div
      className="rounded-xl"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        opacity: epic.id === activeId ? 0.3 : 1,
        boxShadow: insertIndicator === 'before'
          ? '0 -3px 0 0 var(--accent)'
          : insertIndicator === 'after'
            ? '0 3px 0 0 var(--accent)'
            : undefined,
      }}
    >
      <div className="flex items-center" style={{ borderBottom: expanded ? '1px solid var(--border)' : undefined }}>
        <div className="flex-1 min-w-0">
          <TaskCard
            task={toBacklogTask(epic)}
            projectId={projectId}
            hasActiveSprint={false}
            onOptimisticDelete={() => {}}
            onOptimisticMoveToSprint={() => {}}
            onMoveToBacklog={onMoveToBacklog}
            onEdit={onEdit}
            onWorkflowChange={onWorkflowChange}
            onDeadlineChange={onDeadlineChange}
            onTimeChange={onTimeChange}
          />
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1 rounded mr-3 shrink-0"
          style={{ color: 'var(--text2)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
        >
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
          >
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {expanded && (
        <SortableContext items={subtaskIds} strategy={verticalListSortingStrategy}>
          <div
            ref={dropRef}
            className="flex flex-col"
            style={{
              background: (isOver || isPreviewActive) && epic.subtasks.length === 0
                ? 'rgba(79,142,247,0.06)'
                : 'var(--surface2)',
              borderRadius: '0 0 12px 12px',
              transition: 'background 0.15s',
            }}
          >
            {epic.subtasks.length === 0 && !isPreviewActive ? (
              <p className="text-xs text-center py-3" style={{ color: 'var(--text2)', opacity: 0.5 }}>
                Перетащите задачу сюда
              </p>
            ) : (
              <>
                {epic.subtasks.map((sub, i) => (
                  <Fragment key={sub.id}>
                    {isPreviewActive && dragPreview!.insertAt === i && (
                      <div style={{ height: 38, margin: '3px 8px', borderRadius: 8, background: 'rgba(79,142,247,0.06)', border: '1px dashed rgba(79,142,247,0.35)' }} />
                    )}
                    <div style={{
                      borderBottom: i < epic.subtasks.length - 1 ? '1px solid var(--border)' : undefined,
                      opacity: sub.id === activeId ? 0.3 : 1,
                    }}>
                      <TaskCard
                        task={toBacklogTask(sub)}
                        projectId={projectId}
                        hasActiveSprint={false}
                        isSubtask
                        onOptimisticDelete={() => {}}
                        onOptimisticMoveToSprint={() => {}}
                        onMoveToBacklog={onMoveToBacklog}
                        onEdit={onEdit}
                        onWorkflowChange={onWorkflowChange}
                        onDeadlineChange={onDeadlineChange}
                        onTimeChange={onTimeChange}
                      />
                    </div>
                  </Fragment>
                ))}
              </>
            )}
          </div>
        </SortableContext>
      )}

      {expanded && (
        <div
          ref={bottomDropRef}
          style={{
            height: 36,
            margin: '3px 8px 6px',
            borderRadius: 8,
            background: showBottomPlaceholder ? 'rgba(79,142,247,0.06)' : 'transparent',
            border: `1px dashed ${showBottomPlaceholder ? 'rgba(79,142,247,0.35)' : 'transparent'}`,
            transition: 'background 0.15s, border-color 0.15s',
          }}
        />
      )}
    </div>
  )
}

// ── Нижняя зона бросания в конец спринта ──────────────────────────────────
function SprintRootBottomDrop() {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-sprint-bottom' })
  return (
    <div
      ref={setNodeRef}
      className="flex items-center justify-center rounded-lg"
      style={{
        height: 36,
        background: isOver ? 'rgba(79,142,247,0.08)' : 'transparent',
        border: `1px dashed ${isOver ? 'rgba(79,142,247,0.5)' : 'rgba(255,255,255,0.06)'}`,
        color: 'var(--accent)',
        fontSize: 11,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {isOver ? 'Отдельная задача' : ''}
    </div>
  )
}

type Props = {
  sprint: Sprint
  tasks: SprintTask[]
  activeId: string | null
  dragPreview: DragPreview | null
  onTasksChange: (tasks: SprintTask[]) => void
  onTaskRemoved: (task: SprintTask, subtasks: SprintTask[]) => void
  onEditTask: (task: BacklogTask) => void
}

export default function SprintPanel({
  sprint, tasks, activeId, dragPreview,
  onTasksChange, onTaskRemoved, onEditTask,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: SPRINT_DROP_ID })
  const router = useRouter()

  const tree = buildSprintTree(tasks)
  const topLevelIds = tree.map(t => t.id)
  const totalMinutes = tasks.reduce((s, t) => s + (t.time_estimate ?? 0), 0)
  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

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

  const isEpicTargeted = dragPreview?.container?.startsWith('sprint-epic-')

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col flex-1 rounded-xl min-w-0"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isOver && !isEpicTargeted ? 'rgba(79,142,247,0.5)' : 'var(--border)'}`,
        transition: 'border-color 0.15s',
      }}
    >
      {/* Шапка */}
      <div className="flex items-center gap-3 px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--green)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{sprint.name}</span>
        <span className="text-sm font-mono" style={{ color: 'var(--text2)' }}>
          {formatDate(sprint.date_from)} — {formatDate(sprint.date_to)}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>
            {tasks.length} {tasks.length === 1 ? 'задача' : tasks.length < 5 ? 'задачи' : 'задач'}
          </span>
          {totalMinutes > 0 && (
            <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>
              {minutesToDisplay(totalMinutes)}
            </span>
          )}
        </div>
      </div>

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
                return (
                  <SprintEpicBlock
                    key={node.id}
                    epic={node}
                    projectId={sprint.project_id}
                    activeId={activeId}
                    dragPreview={dragPreview}
                    onEdit={onEditTask}
                    onWorkflowChange={handleWorkflowChange}
                    onDeadlineChange={handleDeadlineChange}
                    onTimeChange={handleTimeChange}
                    onMoveToBacklog={handleMoveToBacklog}
                    insertIndicator={insertIndicator}
                  />
                )
              }

              return (
                <div
                  key={node.id}
                  className="rounded-xl"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    opacity: node.id === activeId ? 0.3 : 1,
                    boxShadow: insertIndicator === 'before'
                      ? '0 -3px 0 0 var(--accent)'
                      : insertIndicator === 'after'
                        ? '0 3px 0 0 var(--accent)'
                        : undefined,
                  }}
                >
                  <TaskCard
                    task={toBacklogTask(node)}
                    projectId={sprint.project_id}
                    hasActiveSprint={false}
                    onOptimisticDelete={() => {}}
                    onOptimisticMoveToSprint={() => {}}
                    onMoveToBacklog={handleMoveToBacklog}
                    onEdit={onEditTask}
                    onWorkflowChange={handleWorkflowChange}
                    onDeadlineChange={handleDeadlineChange}
                    onTimeChange={handleTimeChange}
                  />
                </div>
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

            <SprintRootBottomDrop />
          </div>
        </SortableContext>
      </div>
    </div>
  )
}
