'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { reorderBacklog, updateTask, getComments } from '@/app/(dashboard)/projects/[id]/backlog/actions'
import type { WorkflowStatus } from '@/types'
import TaskCard from './task-card'
import CreateTaskModal from './create-task-modal'
import TaskDrawer from './task-drawer'
import type { BacklogTask } from '@/types'

type Member = { id: string; full_name: string | null; login: string; avatar_url: string | null }
type MemberWithCreator = Member & { creator_name?: string | null }

type Props = {
  projectId: string
  initialTasks: BacklogTask[]
  members: Member[]
  membersMap: Record<string, string>
  hasActiveSprint: boolean
  currentUserId: string
  defaultAssigneeMode: 'manual' | 'creator' | 'specific'
  defaultAssigneeId: string | null
}

// Используется внутри эпика (полная высота — все подзадачи сдвигаются вместе, осцилляции нет)
function TaskDropPlaceholder() {
  return (
    <div
      style={{
        height: 38,
        margin: '3px 8px',
        borderRadius: 8,
        background: 'rgba(79,142,247,0.06)',
        border: '1px dashed rgba(79,142,247,0.35)',
      }}
    />
  )
}

// container = 'root' или epicId
type DragPreview = { container: string; insertAt: number }

function EpicBlock({
  epic,
  projectId,
  hasActiveSprint,
  onDelete,
  onMoveToSprint,
  onEdit,
  onWorkflowChange,
  dragPreview,
  insertIndicator,
}: {
  epic: BacklogTask
  projectId: string
  hasActiveSprint: boolean
  onDelete: (id: string) => void
  onMoveToSprint: (id: string) => void
  onEdit: (task: BacklogTask) => void
  onWorkflowChange: (id: string, status: string) => void
  dragPreview: DragPreview | null
  insertIndicator?: 'before' | 'after'
}) {
  const [expanded, setExpanded] = useState(true)
  const pct = epic.subtask_total > 0 ? Math.round((epic.subtask_done / epic.subtask_total) * 100) : 0
  const subtaskIds = epic.subtasks.map(s => s.id)

  // Для пустого эпика — основная drop-зона
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `drop-epic-${epic.id}`,
    disabled: epic.subtasks.length > 0,
  })
  // Зона снизу подзадач — всегда активна, позволяет вставить в конец
  const { setNodeRef: bottomDropRef, isOver: isOverBottom } = useDroppable({
    id: `drop-epic-end-${epic.id}`,
  })
  const isPreviewActive = dragPreview?.container === epic.id
  const showBottomPlaceholder = isOverBottom || (isPreviewActive && dragPreview!.insertAt >= epic.subtasks.length)

  return (
    <div
      className="rounded-xl"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: insertIndicator === 'before'
          ? '0 -3px 0 0 var(--accent)'
          : insertIndicator === 'after'
            ? '0 3px 0 0 var(--accent)'
            : undefined,
      }}
    >
      {/* Эпик-заголовок */}
      <div className="flex items-center" style={{ borderBottom: expanded ? '1px solid var(--border)' : undefined }}>
        <TaskCard
          task={epic}
          projectId={projectId}
          hasActiveSprint={hasActiveSprint}
          onOptimisticDelete={onDelete}
          onOptimisticMoveToSprint={onMoveToSprint}
          onEdit={onEdit}
          onWorkflowChange={onWorkflowChange}
        />
        {/* Прогресс + раскрыть */}
        <div className="flex items-center gap-2 pr-3 shrink-0">
          {epic.subtask_total > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--accent)' }}
                />
              </div>
              <span className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', minWidth: 32 }}>
                {epic.subtask_done}/{epic.subtask_total}
              </span>
            </div>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text2)' }}
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
      </div>

      {/* Подзадачи */}
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
              minHeight: 40,
              transition: 'background 0.15s',
            }}
          >
            {epic.subtasks.length === 0 && !isPreviewActive && !isOverBottom ? (
              <p className="text-xs text-center py-3" style={{ color: 'var(--text2)', opacity: 0.5 }}>
                Перетащите задачу сюда
              </p>
            ) : (
              <>
                {epic.subtasks.map((sub, i) => (
                  <Fragment key={sub.id}>
                    {isPreviewActive && dragPreview!.insertAt === i && <TaskDropPlaceholder />}
                    <div style={{ borderBottom: i < epic.subtasks.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <TaskCard
                        task={sub}
                        projectId={projectId}
                        hasActiveSprint={hasActiveSprint}
                        isSubtask
                        onOptimisticDelete={onDelete}
                        onOptimisticMoveToSprint={onMoveToSprint}
                        onEdit={onEdit}
                        onWorkflowChange={onWorkflowChange}
                      />
                    </div>
                  </Fragment>
                ))}
              </>
            )}
          </div>
        </SortableContext>
      )}
      {/* Bottom drop zone — вставить после последней подзадачи */}
      {expanded && (
        <div
          ref={bottomDropRef}
          style={{
            height: showBottomPlaceholder ? 38 : 24,
            margin: showBottomPlaceholder ? '3px 8px 6px' : '2px 8px 4px',
            borderRadius: 8,
            background: showBottomPlaceholder ? 'rgba(79,142,247,0.06)' : 'transparent',
            border: `1px dashed ${showBottomPlaceholder ? 'rgba(79,142,247,0.35)' : 'transparent'}`,
            transition: 'all 0.15s',
          }}
        />
      )}
    </div>
  )
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-root-bottom' })
  return (
    <div
      ref={setNodeRef}
      className="flex items-center justify-center rounded-lg transition-all"
      style={{
        height: isOver ? 44 : 24,
        background: isOver ? 'rgba(79,142,247,0.08)' : 'transparent',
        border: `1px dashed ${isOver ? 'rgba(79,142,247,0.5)' : 'rgba(255,255,255,0.06)'}`,
        color: 'var(--accent)',
        fontSize: 11,
        transition: 'all 0.15s',
      }}
    >
      {isOver ? 'Отдельная задача' : ''}
    </div>
  )
}

// Найти контейнер задачи ('root' или id эпика)
function findContainer(taskList: BacklogTask[], id: string): string {
  if (taskList.find(t => t.id === id)) return 'root'
  for (const t of taskList) {
    if (t.subtasks.some(s => s.id === id)) return t.id
  }
  return 'root'
}

// Найти задачу в глубину (включая подзадачи)
function findTaskDeep(taskList: BacklogTask[], id: string): BacklogTask | null {
  const top = taskList.find(t => t.id === id)
  if (top) return top
  for (const t of taskList) {
    const sub = t.subtasks.find(s => s.id === id)
    if (sub) return sub
  }
  return null
}

export default function BacklogBoard({ projectId, initialTasks, members, membersMap, hasActiveSprint, currentUserId, defaultAssigneeMode, defaultAssigneeId }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState<BacklogTask[]>(initialTasks)
  const [showModal, setShowModal] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const [editingTask, setEditingTask] = useState<BacklogTask | null>(null)
  const [editingTaskComments, setEditingTaskComments] = useState<unknown[]>([])
  const commentsCache = useRef<Record<string, unknown[]>>({})
  const dragSourceRef = useRef<string>('root')
  const dragCurrentRef = useRef<string>('root')
  useEffect(() => { setTasks(initialTasks) }, [initialTasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Только top-level айди для root sortable
  const sortableIds = tasks.map(t => t.id)

  const activeTask = tasks.find(t => t.id === activeId)
    ?? tasks.flatMap(t => t.subtasks).find(s => s.id === activeId)
    ?? null

  function handleDragStart({ active }: DragStartEvent) {
    const id = active.id as string
    setActiveId(id)
    setDragPreview(null)
    const container = findContainer(tasks, id)
    dragSourceRef.current = container
    dragCurrentRef.current = container
  }

  // Обёртка над setDragPreview: пропускает обновление если значения не изменились.
  // Без этого каждый вызов handleDragOver создаёт новый объект → новая ссылка →
  // React видит изменение → ре-рендер → @dnd-kit пересчитывает позиции → снова
  // handleDragOver → бесконечный цикл.
  function applyDragPreview(next: DragPreview | null) {
    setDragPreview(prev => {
      if (!prev && !next) return prev
      if (prev && next && prev.container === next.container && prev.insertAt === next.insertAt) return prev
      return next
    })
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || active.id === over.id) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeTask = findTaskDeep(tasks, activeId)
    if (!activeTask || activeTask.type === 'epic') return

    // Резолвим целевой контейнер
    let overContainer: string
    if (overId === 'drop-root-bottom') {
      overContainer = 'root'
    } else if (overId.startsWith('drop-epic-end-')) {
      overContainer = overId.replace('drop-epic-end-', '')
    } else if (overId.startsWith('drop-epic-')) {
      overContainer = overId.replace('drop-epic-', '')
    } else {
      overContainer = findContainer(tasks, overId)
    }
    dragCurrentRef.current = overContainer

    const sourceContainer = dragSourceRef.current

    if (sourceContainer === overContainer) {
      // Тот же контейнер: @dnd-kit сам двигает элементы через CSS transforms
      applyDragPreview(null)
    } else {
      // Смена контейнера: показываем placeholder только В эпике
      // (root-placeholder вызывает бесконечный цикл: появление сдвигает задачи →
      //  @dnd-kit находит нового ближайшего → insertAt меняется → placeholder двигается → loop)
      if (overContainer !== 'root') {
        const targetEpic = tasks.find(t => t.id === overContainer)
        if (targetEpic) {
          if (overId.startsWith('drop-epic-end-') || overId.startsWith('drop-epic-')) {
            // Пустой эпик или bottom-зона → в конец
            applyDragPreview({ container: overContainer, insertAt: targetEpic.subtasks.length })
          } else {
            const overIdx = targetEpic.subtasks.findIndex(s => s.id === overId)
            applyDragPreview({ container: overContainer, insertAt: overIdx >= 0 ? overIdx : targetEpic.subtasks.length })
          }
        }
      } else {
        // Перетаскиваем В root — показываем placeholder между задачами
        if (overId === 'drop-root-bottom') {
          applyDragPreview({ container: 'root', insertAt: tasks.length })
        } else {
          const overIdx = tasks.findIndex(t => t.id === overId)
          applyDragPreview({ container: 'root', insertAt: overIdx >= 0 ? overIdx : tasks.length })
        }
      }
    }
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    setDragPreview(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    const sourceContainer = dragSourceRef.current
    const currentContainer = dragCurrentRef.current

    if (sourceContainer !== currentContainer) {
      // Смена контейнера: вычисляем новый state заранее, чтобы сохранить порядок в БД
      const activeTask = findTaskDeep(tasks, activeId)
      if (!activeTask) return

      // Убираем из источника
      let newTasks: BacklogTask[]
      if (sourceContainer === 'root') {
        newTasks = tasks.filter(t => t.id !== activeId)
      } else {
        newTasks = tasks.map(t =>
          t.id === sourceContainer
            ? {
                ...t,
                subtasks: t.subtasks.filter(s => s.id !== activeId),
                subtask_total: Math.max(0, t.subtask_total - 1),
                subtask_done: activeTask.workflow_status === 'done' ? Math.max(0, t.subtask_done - 1) : t.subtask_done,
              }
            : t
        )
      }

      // Добавляем в цель
      if (currentContainer === 'root') {
        const overIdx = newTasks.findIndex(t => t.id === overId)
        const insertAt = overIdx >= 0 ? overIdx : newTasks.length
        const taskForRoot = { ...activeTask, parent_task_id: null }
        newTasks = [...newTasks.slice(0, insertAt), taskForRoot, ...newTasks.slice(insertAt)]
      } else {
        const epicIdx = newTasks.findIndex(t => t.id === currentContainer)
        if (epicIdx === -1) return
        const epic = newTasks[epicIdx]
        const overIdxInEpic = epic.subtasks.findIndex(s => s.id === overId)
        const insertAt = overIdxInEpic >= 0 ? overIdxInEpic : epic.subtasks.length
        const taskForEpic = { ...activeTask, parent_task_id: currentContainer }
        newTasks = newTasks.map(t =>
          t.id === currentContainer
            ? {
                ...t,
                subtasks: [...t.subtasks.slice(0, insertAt), taskForEpic, ...t.subtasks.slice(insertAt)],
                subtask_total: t.subtask_total + 1,
                subtask_done: taskForEpic.workflow_status === 'done' ? t.subtask_done + 1 : t.subtask_done,
              }
            : t
        )
      }

      setTasks(newTasks)

      try {
        await updateTask(activeId, projectId, {
          parent_task_id: currentContainer === 'root' ? null : currentContainer,
        })
        // Сохраняем новый порядок — иначе router.refresh() восстановит старый backlog_order
        if (currentContainer === 'root') {
          await reorderBacklog(projectId, newTasks.map(t => t.id))
        } else {
          const epic = newTasks.find(t => t.id === currentContainer)
          if (epic) await reorderBacklog(projectId, epic.subtasks.map(s => s.id))
        }
      } catch { /* router.refresh восстановит */ }
      router.refresh()
      return
    }

    // Одинаковый контейнер — вычисляем финальный порядок и сохраняем
    if (currentContainer === 'root') {
      const oldIdx = tasks.findIndex(t => t.id === activeId)
      const newIdx = tasks.findIndex(t => t.id === overId)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(tasks, oldIdx, newIdx)
      setTasks(reordered)
      try {
        await reorderBacklog(projectId, reordered.map(t => t.id))
        router.refresh()
      } catch { setTasks(initialTasks) }
    } else {
      const epic = tasks.find(t => t.id === currentContainer)
      if (!epic) return
      const oldIdx = epic.subtasks.findIndex(s => s.id === activeId)
      const newIdx = epic.subtasks.findIndex(s => s.id === overId)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(epic.subtasks, oldIdx, newIdx)
      setTasks(prev => prev.map(t => t.id === currentContainer ? { ...t, subtasks: reordered } : t))
      try {
        await reorderBacklog(projectId, reordered.map(s => s.id))
        router.refresh()
      } catch { setTasks(initialTasks) }
    }
  }

  const handleEdit = useCallback(async (task: BacklogTask) => {
    // Показываем кэш мгновенно если есть
    setEditingTaskComments(commentsCache.current[task.id] ?? [])
    setEditingTask(task)

    // Загружаем свежие данные в фоне (stale-while-revalidate)
    try {
      const fresh = await getComments(task.id)
      commentsCache.current[task.id] = fresh
      setEditingTaskComments(fresh)
    } catch { /* игнорируем */ }
  }, [])

  const handleUpdated = useCallback((updated: Partial<BacklogTask> & { id: string }) => {
    setTasks(prev => prev.map(t => {
      if (t.id === updated.id) return { ...t, ...updated }
      return { ...t, subtasks: t.subtasks.map(s => s.id === updated.id ? { ...s, ...updated } : s) }
    }))
    if (editingTask?.id === updated.id) setEditingTask(prev => prev ? { ...prev, ...updated } : prev)
  }, [editingTask])

  const handleDelete = useCallback((id: string) => {
    setTasks(prev => {
      // Удаляем из top-level или из подзадач эпиков
      return prev
        .filter(t => t.id !== id)
        .map(t => ({ ...t, subtasks: t.subtasks.filter(s => s.id !== id) }))
    })
    router.refresh()
  }, [router])

  const handleMoveToSprint = useCallback((id: string) => {
    setTasks(prev => {
      return prev
        .filter(t => t.id !== id)
        .map(t => ({ ...t, subtasks: t.subtasks.filter(s => s.id !== id) }))
    })
    router.refresh()
  }, [router])

  const handleWorkflowChange = useCallback(async (id: string, status: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) return { ...t, workflow_status: status as WorkflowStatus }
      // Если это подзадача эпика — пересчитываем subtask_done
      if (t.subtasks.some(s => s.id === id)) {
        const updatedSubtasks = t.subtasks.map(s =>
          s.id === id ? { ...s, workflow_status: status as WorkflowStatus } : s
        )
        const subtask_done = updatedSubtasks.filter(s => s.workflow_status === 'done').length
        return { ...t, subtasks: updatedSubtasks, subtask_done }
      }
      return t
    }))
    await updateTask(id, projectId, { workflow_status: status })
    router.refresh()
  }, [projectId, router])

  function handleCreated(task: BacklogTask) {
    if (task.parent_task_id) {
      // Добавляем как подзадачу к эпику
      setTasks(prev => prev.map(t =>
        t.id === task.parent_task_id
          ? { ...t, subtasks: [...t.subtasks, task], subtask_total: t.subtask_total + 1 }
          : t
      ))
    } else if (task.type === 'epic') {
      setTasks(prev => [task, ...prev])
    } else {
      setTasks(prev => [...prev, task])
    }
    router.refresh()
  }

  const epics = tasks.filter(t => t.type === 'epic')

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Тулбар */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text2)' }}>
              {tasks.length} {plural(tasks.length, 'задача', 'задачи', 'задач')}
            </span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Добавить задачу
          </button>
        </div>

        {/* Список */}
        {tasks.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl"
            style={{ border: '1px dashed var(--border)' }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.3 }}>
              <rect x="6" y="4" width="28" height="32" rx="3" stroke="var(--text2)" strokeWidth="2"/>
              <path d="M13 14h14M13 20h14M13 26h8" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className="text-sm" style={{ color: 'var(--text2)' }}>Бэклог пуст</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-sm px-4 py-2 rounded-lg font-medium"
              style={{ background: 'rgba(79,142,247,0.12)', color: 'var(--accent)' }}
            >
              Создать первую задачу
            </button>
          </div>
        ) : (
          <DndContext
            id="backlog-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {tasks.map((task, i) => {
                  const isInsertBefore = dragPreview?.container === 'root' && dragPreview.insertAt === i
                  const isInsertAfterLast = i === tasks.length - 1 && dragPreview?.container === 'root' && dragPreview.insertAt >= tasks.length
                  const insertIndicator = isInsertBefore ? 'before' as const : isInsertAfterLast ? 'after' as const : undefined

                  return (
                    <Fragment key={task.id}>
                      {task.type === 'epic' ? (
                        <EpicBlock
                          epic={task}
                          projectId={projectId}
                          hasActiveSprint={hasActiveSprint}
                          onDelete={handleDelete}
                          onMoveToSprint={handleMoveToSprint}
                          onEdit={handleEdit}
                          onWorkflowChange={handleWorkflowChange}
                          dragPreview={dragPreview}
                          insertIndicator={insertIndicator}
                        />
                      ) : (
                        <div
                          className="rounded-xl"
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            boxShadow: insertIndicator === 'before'
                              ? '0 -3px 0 0 var(--accent)'
                              : insertIndicator === 'after'
                                ? '0 3px 0 0 var(--accent)'
                                : undefined,
                          }}
                        >
                          <TaskCard
                            task={task}
                            projectId={projectId}
                            hasActiveSprint={hasActiveSprint}
                            onOptimisticDelete={handleDelete}
                            onOptimisticMoveToSprint={handleMoveToSprint}
                            onEdit={handleEdit}
                            onWorkflowChange={handleWorkflowChange}
                          />
                        </div>
                      )}
                    </Fragment>
                  )
                })}
                {activeId && <RootDropZone />}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeTask && (
                <div
                  className="rounded-xl shadow-2xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--accent)', opacity: 0.95 }}
                >
                  <TaskCard
                    task={activeTask}
                    projectId={projectId}
                    hasActiveSprint={hasActiveSprint}
                    onOptimisticDelete={() => {}}
                    onOptimisticMoveToSprint={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {showModal && (
        <CreateTaskModal
          projectId={projectId}
          members={members}
          epics={epics}
          defaultAssigneeId={
            defaultAssigneeMode === 'creator' ? currentUserId :
            defaultAssigneeMode === 'specific' ? (defaultAssigneeId ?? '') : ''
          }
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}

      {editingTask && (
        <TaskDrawer
          task={editingTask}
          projectId={projectId}
          members={members}
          epics={tasks.filter(t => t.type === 'epic')}
          initialComments={editingTaskComments}
          onClose={() => setEditingTask(null)}
          onUpdated={handleUpdated}
        />
      )}
    </>
  )
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
