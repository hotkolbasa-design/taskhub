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
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core'
import type { Sprint, SprintColumn, SprintTask } from '@/types'
import {
  moveTaskInSprint,
  closeSprint as closeSprintAction,
  reorderSprintColumns,
  createSprintColumn,
  deleteSprintColumn,
} from '@/app/(dashboard)/projects/[id]/sprint/actions'
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

const COLUMN_COLORS = [
  '#4F8EF7', '#2DD4A0', '#F7C04F', '#F75C6E',
  '#A78BFA', '#FB923C', '#60C0E8', '#8892A4',
]

export default function SprintBoard({ projectId, sprint, columns: initialColumns, initialTasks, canManage }: Props) {
  const router = useRouter()

  const [cols, setCols] = useState<SprintColumn[]>(() =>
    [...initialColumns].sort((a, b) => a.order_index - b.order_index)
  )

  const [taskMap, setTaskMap] = useState<TaskMap>(() => {
    const map: TaskMap = {}
    const sorted = [...initialColumns].sort((a, b) => a.order_index - b.order_index)
    sorted.forEach(col => { map[col.id] = [] })
    initialTasks.forEach(task => {
      const colId = task.column_id && map[task.column_id] !== undefined
        ? task.column_id
        : sorted[0]?.id
      if (colId) map[colId] = [...(map[colId] ?? []), task]
    })
    return map
  })

  const [activeTask, setActiveTask] = useState<SprintTask | null>(null)
  const [activeColumn, setActiveColumn] = useState<SprintColumn | null>(null)
  const [draggingType, setDraggingType] = useState<'task' | 'column' | null>(null)
  const dragPreviewRef = useRef<DragPreview>(null)
  const [dragPreview, setDragPreview] = useState<DragPreview>(null)
  const [closing, setClosing] = useState(false)
  const [isFixed] = useState(sprint.is_fixed)

  // Add column state
  const [addingAfterColId, setAddingAfterColId] = useState<string | 'end' | null>(null)

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
    const type = active.data.current?.type as 'task' | 'column'
    setDraggingType(type)
    if (type === 'column') {
      setActiveColumn(cols.find(c => c.id === active.id) ?? null)
    } else {
      setActiveTask(findTask(active.id as string) ?? null)
      dragPreviewRef.current = null
      setDragPreview(null)
    }
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (draggingType === 'column') return

    if (!over) { applyDragPreview(null); return }

    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) { applyDragPreview(null); return }

    // Hovering over the column header (sortable area) or task drop zone
    if (over.data.current?.type === 'column') {
      applyDragPreview({ columnId: overId, insertBeforeId: null })
      return
    }
    if (overId.startsWith('drop-')) {
      applyDragPreview({ columnId: overId.replace('drop-', ''), insertBeforeId: null })
      return
    }

    const overTask = findTask(overId)
    if (!overTask) return
    const colId = overTask.column_id ?? cols[0]?.id
    if (!colId) return

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

  async function handleDragEnd({ active, over }: DragEndEvent) {
    const type = draggingType
    setDraggingType(null)
    setActiveColumn(null)

    if (type === 'column') {
      if (!over || active.id === over.id) return
      const oldIndex = cols.findIndex(c => c.id === active.id)
      const newIndex = cols.findIndex(c => c.id === over.id)
      if (oldIndex === newIndex || oldIndex < 0 || newIndex < 0) return
      const reordered = arrayMove(cols, oldIndex, newIndex)
      setCols(reordered)
      setTaskMap(prev => {
        const next: TaskMap = {}
        reordered.forEach(c => { next[c.id] = prev[c.id] ?? [] })
        return next
      })
      await reorderSprintColumns(reordered.map((c, i) => ({ id: c.id, order_index: i })))
      router.refresh()
      return
    }

    // Task drag
    const preview = dragPreviewRef.current
    setActiveTask(null)
    applyDragPreview(null)

    if (!preview) return
    const task = findTask(active.id as string)
    if (!task) return

    const srcColId = task.column_id ?? cols[0]?.id
    const { columnId: dstColId, insertBeforeId } = preview

    const newMap = { ...taskMap }
    if (srcColId) newMap[srcColId] = (newMap[srcColId] ?? []).filter(t => t.id !== task.id)

    const dstTasks = [...(newMap[dstColId] ?? [])]
    const insertIdx = insertBeforeId ? dstTasks.findIndex(t => t.id === insertBeforeId) : -1
    dstTasks.splice(insertIdx === -1 ? dstTasks.length : insertIdx, 0, { ...task, column_id: dstColId })
    newMap[dstColId] = dstTasks

    setTaskMap(newMap)

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

  async function handleDeleteColumn(columnId: string) {
    const prevCols = cols
    const prevTaskMap = taskMap

    const remaining = cols.filter(c => c.id !== columnId)
    const fallbackColId = remaining[0]?.id

    setCols(remaining)
    if (fallbackColId) {
      setTaskMap(prev => {
        const orphaned = prev[columnId] ?? []
        return {
          ...prev,
          [columnId]: [],
          [fallbackColId]: [...(prev[fallbackColId] ?? []), ...orphaned],
        }
      })
    } else {
      setTaskMap(prev => { const next = { ...prev }; delete next[columnId]; return next })
    }

    try {
      await deleteSprintColumn(columnId, sprint.id, projectId)
      router.refresh()
    } catch {
      setCols(prevCols)
      setTaskMap(prevTaskMap)
    }
  }

  async function handleAddColumn(name: string, color: string) {
    const orderIndex = addingAfterColId === 'end'
      ? cols.length
      : (cols.findIndex(c => c.id === addingAfterColId) + 1)

    const tempId = `temp-${Date.now()}`
    const tempCol: SprintColumn = { id: tempId, sprint_id: sprint.id, name, color, order_index: orderIndex }

    const newCols = [
      ...cols.slice(0, orderIndex),
      tempCol,
      ...cols.slice(orderIndex),
    ]
    setCols(newCols)
    setTaskMap(prev => ({ ...prev, [tempId]: [] }))
    setAddingAfterColId(null)

    try {
      const realCol = await createSprintColumn(sprint.id, projectId, name, color, orderIndex)
      // Заменяем временный ID на реальный UUID из БД
      setCols(prev => prev.map(c => c.id === tempId ? { ...c, id: realCol.id } : c))
      setTaskMap(prev => {
        const next = { ...prev }
        next[realCol.id] = next[tempId] ?? []
        delete next[tempId]
        return next
      })
      router.refresh()
    } catch {
      setCols(cols)
      setTaskMap(prev => {
        const next = { ...prev }
        delete next[tempId]
        return next
      })
    }
  }

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  const totalTasks = Object.values(taskMap).reduce((s, t) => s + t.length, 0)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Шапка */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: isFixed ? 'var(--yellow)' : 'var(--green)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{sprint.name}</h2>
          </div>
          <span className="text-sm font-mono" style={{ color: 'var(--text2)' }}>
            {formatDate(sprint.date_from)} — {formatDate(sprint.date_to)}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
            {totalTasks} {totalTasks === 1 ? 'задача' : totalTasks < 5 ? 'задачи' : 'задач'}
          </span>
          {isFixed && (
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: 'rgba(247,192,79,0.12)', color: 'var(--yellow)', border: '1px solid rgba(247,192,79,0.25)', fontFamily: 'var(--font-mono)' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M9 5V4a3 3 0 1 0-6 0v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <rect x="2" y="5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
              {sprint.fixed_at
                ? `Зафиксировано ${new Date(sprint.fixed_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
                : 'Зафиксировано'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={handleCloseSprint}
              disabled={closing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: 'rgba(247,92,110,0.08)', color: 'var(--red)', border: '1px solid rgba(247,92,110,0.2)', cursor: 'pointer' }}
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
          <SortableContext items={cols.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-0 p-6 h-full" style={{ minWidth: 'max-content', alignItems: 'flex-start' }}>
              {cols.map((col, idx) => (
                <div key={col.id} className="flex items-start">
                  <KanbanColumn
                    column={col}
                    tasks={taskMap[col.id] ?? []}
                    dragPreview={dragPreview}
                    activeTaskId={activeTask?.id ?? null}
                    isTaskDragging={draggingType === 'task'}
                    isBeingDragged={activeColumn?.id === col.id}
                    onAddAfter={() => setAddingAfterColId(col.id)}
                    onDelete={() => handleDeleteColumn(col.id)}
                    canDelete={cols.length > 1}
                  />
                  {draggingType === null && addingAfterColId === col.id && (
                    <AddColumnForm
                      colors={COLUMN_COLORS}
                      defaultColor={COLUMN_COLORS[(idx + 1) % COLUMN_COLORS.length]}
                      onSave={handleAddColumn}
                      onCancel={() => setAddingAfterColId(null)}
                    />
                  )}
                </div>
              ))}

              {/* "+" после всех колонок */}
              {draggingType === null && addingAfterColId !== 'end' && (
                <AddColumnButton onAdd={() => setAddingAfterColId('end')} />
              )}
              {draggingType === null && addingAfterColId === 'end' && (
                <AddColumnForm
                  colors={COLUMN_COLORS}
                  defaultColor={COLUMN_COLORS[cols.length % COLUMN_COLORS.length]}
                  onSave={handleAddColumn}
                  onCancel={() => setAddingAfterColId(null)}
                />
              )}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div style={{ width: 288, cursor: 'grabbing' }}>
                <SprintTaskCard task={activeTask} isOverlay />
              </div>
            )}
            {activeColumn && (
              <ColumnOverlay column={activeColumn} taskCount={taskMap[activeColumn.id]?.length ?? 0} />
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
  isTaskDragging,
  isBeingDragged,
  onAddAfter,
  onDelete,
  canDelete,
}: {
  column: SprintColumn
  tasks: SprintTask[]
  dragPreview: DragPreview
  activeTaskId: string | null
  isTaskDragging: boolean
  isBeingDragged: boolean
  onAddAfter: () => void
  onDelete: () => void
  canDelete: boolean
}) {
  const [headerHovered, setHeaderHovered] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isOver,
  } = useSortable({
    id: column.id,
    data: { type: 'column' },
    disabled: isTaskDragging,
  })

  const totalMinutes = tasks.reduce((s, t) => s + (t.time_estimate ?? 0), 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  const timeLabel = totalMinutes > 0
    ? (hours > 0 ? `${hours} ч` : '') + (mins > 0 ? (hours > 0 ? ` ${mins} м` : `${mins} м`) : '')
    : null

  const isColumnTarget = dragPreview?.columnId === column.id
  const isEmptyTarget = isColumnTarget && tasks.filter(t => t.id !== activeTaskId).length === 0

  return (
    <div
      ref={setNodeRef}
      style={{
        width: 288,
        marginRight: 16,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isBeingDragged ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      <div
        className="flex flex-col rounded-xl overflow-hidden"
        style={{
          background: 'var(--surface)',
          border: `1px solid ${isOver && isColumnTarget ? 'rgba(79,142,247,0.4)' : 'var(--border)'}`,
          transition: 'border-color 0.15s',
          maxHeight: 'calc(100vh - 180px)',
        }}
      >
        {/* Заголовок */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
          onMouseEnter={() => setHeaderHovered(true)}
          onMouseLeave={() => { setHeaderHovered(false); setConfirmDelete(false) }}
        >
          {/* Drag handle */}
          <span
            style={{ cursor: 'grab', color: 'var(--text2)', opacity: 0.4, flexShrink: 0, display: 'flex', alignItems: 'center' }}
            {...attributes}
            {...listeners}
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
              <circle cx="3" cy="2" r="1.2" fill="currentColor"/>
              <circle cx="7" cy="2" r="1.2" fill="currentColor"/>
              <circle cx="3" cy="7" r="1.2" fill="currentColor"/>
              <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
              <circle cx="3" cy="12" r="1.2" fill="currentColor"/>
              <circle cx="7" cy="12" r="1.2" fill="currentColor"/>
            </svg>
          </span>

          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: column.color }} />
          <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{column.name}</span>

          {/* Статы: кол-во задач и время */}
          {!headerHovered && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>{tasks.length}</span>
              {timeLabel && (
                <>
                  <span className="text-xs" style={{ color: 'var(--text2)', opacity: 0.4 }}>·</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>{timeLabel}</span>
                </>
              )}
            </div>
          )}

          {/* Кнопки на ховере */}
          {headerHovered && (
            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              {/* Добавить колонку после */}
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onAddAfter() }}
                title="Добавить колонку после"
                style={{
                  width: 26, height: 26,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6,
                  background: 'var(--surface2)',
                  border: 'none',
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(79,142,247,0.15)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text2)' }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>

              {/* Удалить колонку */}
              {canDelete && (
                confirmDelete ? (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onDelete() }}
                    style={{
                      height: 26, padding: '0 8px',
                      display: 'flex', alignItems: 'center',
                      borderRadius: 6,
                      background: 'rgba(247,92,110,0.15)',
                      border: 'none',
                      color: 'var(--red)',
                      fontSize: 11, fontWeight: 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Удалить?
                  </button>
                ) : (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
                    title="Удалить колонку"
                    style={{
                      width: 26, height: 26,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6,
                      background: 'var(--surface2)',
                      border: 'none',
                      color: 'var(--text2)',
                      cursor: 'pointer',
                      transition: 'background 0.12s, color 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(247,92,110,0.15)'; e.currentTarget.style.color = 'var(--red)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text2)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M1.5 3h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <path d="M4 3V2.25A.75.75 0 014.75 1.5h2.5A.75.75 0 018 2.25V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <rect x="2" y="3" width="8" height="7.5" rx=".75" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4.5 5.5v3M7.5 5.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </button>
                )
              )}
            </div>
          )}
        </div>

        <TaskDropZone
          columnId={column.id}
          tasks={tasks}
          dragPreview={dragPreview}
          activeTaskId={activeTaskId}
          isEmptyTarget={isEmptyTarget}
        />
      </div>
    </div>
  )
}

// ─── Drop-зона для задач (отдельно от сортируемого заголовка) ────────────────

function TaskDropZone({
  columnId,
  tasks,
  dragPreview,
  activeTaskId,
  isEmptyTarget,
}: {
  columnId: string
  tasks: SprintTask[]
  dragPreview: DragPreview
  activeTaskId: string | null
  isEmptyTarget: boolean
}) {
  const { setNodeRef } = useDroppable({ id: `drop-${columnId}` })

  return (
    <div
      ref={setNodeRef}
      className="flex-1 overflow-y-auto p-3 flex flex-col gap-2"
      style={{ minHeight: 80 }}
    >
      {tasks.map((task, idx) => {
        const insertBefore = dragPreview?.columnId === columnId && dragPreview.insertBeforeId === task.id
        const isLastAndAppend =
          dragPreview?.columnId === columnId &&
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

      {isEmptyTarget && (
        <div
          className="rounded-lg h-16"
          style={{ border: '2px dashed var(--accent)', opacity: 0.4 }}
        />
      )}
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
  } = useDraggable({ id: task.id, data: { type: 'task' } })

  const { setNodeRef: setDropRef } = useDroppable({ id: task.id, data: { type: 'task' } })

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
        opacity: isDragging ? 0.3 : 1,
        boxShadow,
        borderRadius: 8,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    >
      <SprintTaskCard task={task} />
    </div>
  )
}

// ─── Overlay для колонки при перетаскивании ───────────────────────────────────

function ColumnOverlay({ column, taskCount }: { column: SprintColumn; taskCount: number }) {
  return (
    <div
      style={{
        width: 288,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'grabbing',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: column.color }} />
        <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>{column.name}</span>
        <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>{taskCount}</span>
      </div>
      <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          {taskCount} {taskCount === 1 ? 'задача' : taskCount < 5 ? 'задачи' : 'задач'}
        </span>
      </div>
    </div>
  )
}

// ─── Кнопка добавления колонки в конец ───────────────────────────────────────

function AddColumnButton({ onAdd }: { onAdd: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onAdd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 44,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 10,
        background: hovered ? 'var(--surface2)' : 'transparent',
        border: 'none',
        color: 'var(--text2)',
        fontSize: 13,
        fontWeight: 500,
        transition: 'all 0.15s',
        cursor: 'pointer',
        flexShrink: 0,
        alignSelf: 'flex-start',
        opacity: hovered ? 1 : 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  )
}

// ─── Форма добавления колонки ─────────────────────────────────────────────────

function AddColumnForm({
  colors,
  defaultColor,
  onSave,
  onCancel,
}: {
  colors: string[]
  defaultColor: string
  onSave: (name: string, color: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(defaultColor)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    await onSave(trimmed, color)
  }

  return (
    <div
      style={{
        width: 220,
        marginRight: 16,
        flexShrink: 0,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 12,
        alignSelf: 'flex-start',
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Название колонки"
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') onCancel()
        }}
        style={{
          width: '100%',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 10px',
          color: 'var(--text)',
          fontSize: 13,
          outline: 'none',
        }}
      />

      {/* Выбор цвета */}
      <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
        {colors.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: c,
              border: color === c ? '2px solid white' : '2px solid transparent',
              outline: color === c ? `2px solid ${c}` : 'none',
              cursor: 'pointer',
              transition: 'transform 0.1s',
              transform: color === c ? 'scale(1.15)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Кнопки */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          style={{
            flex: 1,
            background: name.trim() ? 'var(--accent)' : 'var(--surface2)',
            color: name.trim() ? 'white' : 'var(--text2)',
            border: 'none',
            borderRadius: 7,
            padding: '6px 0',
            fontSize: 12,
            fontWeight: 500,
            cursor: name.trim() ? 'pointer' : 'default',
            transition: 'background 0.15s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          {saving && (
            <span className="w-3 h-3 rounded-full border-2 animate-spin"
              style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
          )}
          Добавить
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 10px',
            background: 'var(--surface2)',
            color: 'var(--text2)',
            border: 'none',
            borderRadius: 7,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
