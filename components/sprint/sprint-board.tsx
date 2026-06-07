'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core'
import type { Sprint, SprintColumn, SprintTask } from '@/types'
import { moveTaskInSprint, closeSprint as closeSprintAction } from '@/app/(dashboard)/projects/[id]/sprint/actions'
import SprintTaskCard from './sprint-task-card'

type TaskMap = Record<string, SprintTask[]>

type DragPreview = {
  columnId: string
  insertBeforeId: string | null
} | null

type Props = {
  projectId: string
  sprint: Sprint
  columns: SprintColumn[]
  initialTasks: SprintTask[]
  canManage: boolean
}

export default function SprintBoard({ projectId, sprint, columns, initialTasks, canManage }: Props) {
  const router = useRouter()

  const [taskMap, setTaskMap] = useState<TaskMap>(() => {
    const map: TaskMap = {}
    columns.forEach(col => { map[col.id] = [] })
    initialTasks.forEach(task => {
      const colId = task.column_id && map[task.column_id] !== undefined
        ? task.column_id
        : columns[0]?.id
      if (colId) map[colId] = [...(map[colId] ?? []), task]
    })
    return map
  })

  const [activeTask, setActiveTask] = useState<SprintTask | null>(null)
  const dragPreviewRef = useRef<DragPreview>(null)
  const [dragPreview, setDragPreview] = useState<DragPreview>(null)
  const [closing, setClosing] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const findTask = useCallback((id: string): SprintTask | undefined => {
    for (const tasks of Object.values(taskMap)) {
      const t = tasks.find(task => task.id === id)
      if (t) return t
    }
  }, [taskMap])

  function applyDragPreview(next: DragPreview) {
    dragPreviewRef.current = next
    setDragPreview(prev => {
      if (!prev && !next) return prev
      if (prev && next && prev.columnId === next.columnId && prev.insertBeforeId === next.insertBeforeId) return prev
      return next
    })
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveTask(findTask(active.id as string) ?? null)
    dragPreviewRef.current = null
    setDragPreview(null)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) { applyDragPreview(null); return }

    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) { applyDragPreview(null); return }

    // Over a column directly → append to end
    if (columns.some(c => c.id === overId)) {
      applyDragPreview({ columnId: overId, insertBeforeId: null })
      return
    }

    // Over a task card
    const overTask = findTask(overId)
    if (!overTask) return
    const colId = overTask.column_id ?? columns[0]?.id
    if (!colId) return

    // Determine above/below using translated rect vs over rect
    const activeTranslated = active.rect.current.translated
    const overRect = over.rect

    if (activeTranslated && overRect) {
      const activeMidY = activeTranslated.top + activeTranslated.height / 2
      const overMidY = overRect.top + overRect.height / 2

      if (activeMidY < overMidY) {
        applyDragPreview({ columnId: colId, insertBeforeId: overTask.id })
      } else {
        const tasks = taskMap[colId] ?? []
        const idx = tasks.findIndex(t => t.id === overTask.id)
        const nextId = tasks[idx + 1]?.id ?? null
        applyDragPreview({ columnId: colId, insertBeforeId: nextId })
      }
    } else {
      applyDragPreview({ columnId: colId, insertBeforeId: overTask.id })
    }
  }

  async function handleDragEnd({ active }: DragEndEvent) {
    const preview = dragPreviewRef.current
    setActiveTask(null)
    applyDragPreview(null)

    if (!preview) return
    const task = findTask(active.id as string)
    if (!task) return

    const srcColId = task.column_id ?? columns[0]?.id
    const { columnId: dstColId, insertBeforeId } = preview

    // Optimistic update
    const newMap = { ...taskMap }
    if (srcColId) newMap[srcColId] = (newMap[srcColId] ?? []).filter(t => t.id !== task.id)

    const dstTasks = [...(newMap[dstColId] ?? [])]
    const insertIdx = insertBeforeId ? dstTasks.findIndex(t => t.id === insertBeforeId) : -1
    dstTasks.splice(insertIdx === -1 ? dstTasks.length : insertIdx, 0, { ...task, column_id: dstColId })
    newMap[dstColId] = dstTasks

    setTaskMap(newMap)

    // Persist
    const updates = dstTasks.map((t, i) => ({ id: t.id, column_id: dstColId, column_order: i }))
    if (srcColId && srcColId !== dstColId) {
      updates.push(...(newMap[srcColId] ?? []).map((t, i) => ({ id: t.id, column_id: srcColId, column_order: i })))
    }
    await moveTaskInSprint(updates)
    router.refresh()
  }

  async function handleCloseSprint() {
    if (!confirm('Завершить спринт? Все задачи останутся в колонках.')) return
    setClosing(true)
    await closeSprintAction(sprint.id, projectId)
    router.refresh()
  }

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  const totalTasks = Object.values(taskMap).reduce((s, t) => s + t.length, 0)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Шапка спринта */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--green)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{sprint.name}</h2>
          </div>
          <span className="text-sm font-mono" style={{ color: 'var(--text2)' }}>
            {formatDate(sprint.date_from)} — {formatDate(sprint.date_to)}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
            {totalTasks} {totalTasks === 1 ? 'задача' : totalTasks < 5 ? 'задачи' : 'задач'}
          </span>
        </div>

        {canManage && (
          <button
            onClick={handleCloseSprint}
            disabled={closing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: 'rgba(247,92,110,0.08)',
              color: 'var(--red)',
              border: '1px solid rgba(247,92,110,0.2)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(247,92,110,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(247,92,110,0.08)')}
          >
            {closing && (
              <span className="w-3 h-3 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--red)', borderTopColor: 'transparent' }} />
            )}
            Завершить спринт
          </button>
        )}
      </div>

      {/* Канбан */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-6 h-full" style={{ minWidth: 'max-content', alignItems: 'flex-start' }}>
            {columns.map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={taskMap[col.id] ?? []}
                dragPreview={dragPreview}
                activeTaskId={activeTask?.id ?? null}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div style={{ width: 288, cursor: 'grabbing' }}>
                <SprintTaskCard task={activeTask} isOverlay />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

// ─── Колонка ─────────────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  dragPreview,
  activeTaskId,
}: {
  column: SprintColumn
  tasks: SprintTask[]
  dragPreview: DragPreview
  activeTaskId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  const totalMinutes = tasks.reduce((s, t) => s + (t.time_estimate ?? 0), 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const timeLabel = totalMinutes > 0
    ? (hours > 0 ? `${hours} ч ` : '') + (mins > 0 ? `${mins} м` : '')
    : null

  const isColumnTarget = dragPreview?.columnId === column.id
  const isEmptyTarget = isColumnTarget && tasks.filter(t => t.id !== activeTaskId).length === 0

  return (
    <div
      className="flex flex-col rounded-xl shrink-0 overflow-hidden"
      style={{
        width: 288,
        background: 'var(--surface)',
        border: `1px solid ${isOver && isColumnTarget ? 'rgba(79,142,247,0.4)' : 'var(--border)'}`,
        transition: 'border-color 0.15s',
        maxHeight: 'calc(100vh - 180px)',
      }}
    >
      {/* Шапка колонки */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: column.color }} />
        <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{column.name}</span>
        <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text2)' }}>{tasks.length}</span>
        {timeLabel && (
          <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text2)' }}>{timeLabel}</span>
        )}
      </div>

      {/* Задачи */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-2"
        style={{ minHeight: 80 }}
      >
        {tasks.map((task, idx) => {
          const insertBefore = dragPreview?.columnId === column.id && dragPreview.insertBeforeId === task.id
          const isLastAndAppend =
            dragPreview?.columnId === column.id &&
            dragPreview.insertBeforeId === null &&
            idx === tasks.length - 1

          return (
            <DraggableCard
              key={task.id}
              task={task}
              isDragging={task.id === activeTaskId}
              insertBefore={insertBefore}
              insertAfter={isLastAndAppend}
            />
          )
        })}

        {/* Пустая колонка — показываем placeholder при hover */}
        {isEmptyTarget && (
          <div
            className="rounded-lg h-16"
            style={{ border: '2px dashed var(--accent)', opacity: 0.4 }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Карточка с DnD ──────────────────────────────────────────────────────────

function DraggableCard({
  task,
  isDragging,
  insertBefore,
  insertAfter,
}: {
  task: SprintTask
  isDragging: boolean
  insertBefore: boolean
  insertAfter: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging: isActiveDragging,
  } = useDraggable({ id: task.id })

  const { setNodeRef: setDropRef } = useDroppable({ id: task.id })

  const setRef = (el: HTMLElement | null) => {
    setDragRef(el)
    setDropRef(el)
  }

  const boxShadow = insertBefore
    ? '0 -3px 0 0 var(--accent)'
    : insertAfter
      ? '0 3px 0 0 var(--accent)'
      : undefined

  return (
    <div
      ref={setRef}
      {...attributes}
      {...listeners}
      style={{
        opacity: isActiveDragging ? 0.3 : 1,
        boxShadow,
        borderRadius: 8,
        cursor: isActiveDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    >
      <SprintTaskCard task={task} />
    </div>
  )
}
