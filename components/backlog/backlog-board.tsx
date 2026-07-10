'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
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
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { reorderBacklog, reorderSprintTasks, updateTask, getComments, moveToSprint, moveBackToBacklog, createSprint, removeFromEpic } from '@/app/(dashboard)/projects/[id]/backlog/actions'
import { minutesToDisplay } from '@/lib/utils/time'
import { moveTaskInSprint } from '@/app/(dashboard)/projects/[id]/sprint/actions'
import type { WorkflowStatus, SprintTask, Sprint } from '@/types'
import TaskCard from './task-card'
import CreateTaskModal from './create-task-modal'
import TaskDrawer from './task-drawer'
import SprintPanel, {
  SPRINT_DROP_ID,
  buildSprintTree,
  toBacklogTask as sprintToBacklog,
} from './sprint-panel'
import type { BacklogTask } from '@/types'

type Member = { id: string; full_name: string | null; login: string; avatar_url: string | null }
type MemberWithCreator = Member & { creator_name?: string | null }

type SprintPanelData = {
  sprint: Sprint
  tasks: SprintTask[]
}

type Props = {
  projectId: string
  initialTasks: BacklogTask[]
  members: Member[]
  membersMap: Record<string, string>
  hasActiveSprint: boolean
  currentUserId: string
  defaultAssigneeMode: 'manual' | 'creator' | 'specific'
  defaultAssigneeId: string | null
  sprintPanelData?: SprintPanelData | null
  isAdmin?: boolean
}

type DragPreview = { container: string; insertAt: number }

function EpicBlock({
  epic,
  projectId,
  hasActiveSprint,
  onDelete,
  onMoveToSprint,
  onEdit,
  onWorkflowChange,
  onDeadlineChange,
  onTimeChange,
  onRemoveFromEpic,
  insertIndicator,
}: {
  epic: BacklogTask
  projectId: string
  hasActiveSprint: boolean
  onDelete: (id: string) => void
  onMoveToSprint: (id: string) => void
  onEdit: (task: BacklogTask) => void
  onWorkflowChange: (id: string, status: string) => void
  onDeadlineChange: (id: string, deadline: string | null) => void
  onTimeChange: (id: string, minutes: number | null) => void
  onRemoveFromEpic: (id: string) => void
  insertIndicator?: 'before' | 'after'
}) {
  const [expanded, setExpanded] = useState(true)
  const pct = epic.subtask_total > 0 ? Math.round((epic.subtask_done / epic.subtask_total) * 100) : 0
  const subtaskMinutes = epic.subtasks.reduce((s, t) => s + (t.time_estimate ?? 0), 0)

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
      <div style={{ borderBottom: expanded && epic.subtasks.length > 0 ? '1px solid var(--border)' : undefined }}>
        <TaskCard
          task={{ ...epic, time_estimate: subtaskMinutes || null }}
          projectId={projectId}
          hasActiveSprint={hasActiveSprint}
          sortableDisabled
          externalDragHandle={{ attributes: sortableAttributes, listeners: sortableListeners }}
          onOptimisticDelete={onDelete}
          onOptimisticMoveToSprint={onMoveToSprint}
          onEdit={onEdit}
          onWorkflowChange={onWorkflowChange}
          onDeadlineChange={onDeadlineChange}
          avatarMenuInRow2
          row1Suffix={
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                {epic.subtask_done}/{epic.subtask_total}
              </span>
              {epic.subtask_total > 0 && (
                <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--accent)' }} />
                </div>
              )}
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-1 rounded transition-colors"
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
                task={sub}
                projectId={projectId}
                hasActiveSprint={hasActiveSprint}
                sortableDisabled
                onOptimisticDelete={onDelete}
                onOptimisticMoveToSprint={onMoveToSprint}
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

function SortableTaskRow({
  task, projectId, hasActiveSprint, insertIndicator,
  onDelete, onMoveToSprint, onEdit, onWorkflowChange, onDeadlineChange, onTimeChange,
}: {
  task: BacklogTask
  projectId: string
  hasActiveSprint: boolean
  insertIndicator?: 'before' | 'after'
  onDelete: (id: string) => void
  onMoveToSprint: (id: string) => void
  onEdit: (task: BacklogTask) => void
  onWorkflowChange: (id: string, status: string) => void
  onDeadlineChange: (id: string, deadline: string | null) => void
  onTimeChange: (id: string, minutes: number | null) => void
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: task.id })
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
        task={task}
        projectId={projectId}
        hasActiveSprint={hasActiveSprint}
        sortableDisabled
        externalDragHandle={{ attributes, listeners }}
        onOptimisticDelete={onDelete}
        onOptimisticMoveToSprint={onMoveToSprint}
        onEdit={onEdit}
        onWorkflowChange={onWorkflowChange}
        onDeadlineChange={onDeadlineChange}
        onTimeChange={onTimeChange}
      />
    </div>
  )
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-root-bottom' })
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

export default function BacklogBoard({ projectId, initialTasks, members, membersMap, hasActiveSprint, currentUserId, defaultAssigneeMode, defaultAssigneeId, sprintPanelData = null, isAdmin = false }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState<BacklogTask[]>(initialTasks)
  const [sprintTasks, setSprintTasks] = useState<SprintTask[]>(sprintPanelData?.tasks ?? [])
  const [showModal, setShowModal] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const [sprintDragOverBacklog, setSprintDragOverBacklog] = useState(false)
  const [editingTask, setEditingTask] = useState<BacklogTask | null>(null)
  const [editingTaskComments, setEditingTaskComments] = useState<unknown[]>([])
  const commentsCache = useRef<Record<string, unknown[]>>({})
  const dragSourceRef = useRef<string>('root')
  const dragCurrentRef = useRef<string>('root')


  // Дебаунс сохранения порядка: только финальный порядок идёт в БД
  const pendingBacklogOrderRef = useRef<string[] | null>(null)
  const pendingSprintOrderRef = useRef<string[] | null>(null)
  const orderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleReorder = useCallback((type: 'backlog' | 'sprint', ids: string[]) => {
    if (type === 'backlog') pendingBacklogOrderRef.current = ids
    else pendingSprintOrderRef.current = ids
    if (orderDebounceRef.current) clearTimeout(orderDebounceRef.current)
    orderDebounceRef.current = setTimeout(async () => {
      const backlogIds = pendingBacklogOrderRef.current
      const sprintIds = pendingSprintOrderRef.current
      pendingBacklogOrderRef.current = null
      pendingSprintOrderRef.current = null
      if (backlogIds) await reorderBacklog(projectId, backlogIds)
      if (sprintIds) await reorderSprintTasks(projectId, sprintIds)
    }, 600)
  }, [projectId])
  // Sync server data: preserve local ORDER, update task fields (title, status, etc.)
  useEffect(() => {
    setTasks(prev => {
      if (prev.length === 0) return initialTasks
      const serverMap = new Map(initialTasks.map(t => [t.id, t]))
      const merged = prev
        .map(t => {
          const s = serverMap.get(t.id)
          if (!s) return null
          const sSubMap = new Map(s.subtasks.map(sub => [sub.id, sub]))
          const localSubIds = new Set(t.subtasks.map(sub => sub.id))
          const mergedSubs = t.subtasks
            .map(sub => sSubMap.get(sub.id) ?? null)
            .filter(Boolean) as BacklogTask[]
          const newSubs = s.subtasks.filter(sub => !localSubIds.has(sub.id))
          return {
            ...s,
            subtasks: [...mergedSubs, ...newSubs],
          }
        })
        .filter(Boolean) as BacklogTask[]
      const prevIds = new Set(prev.map(t => t.id))
      const newTasks = initialTasks.filter(t => !prevIds.has(t.id))
      return [...merged, ...newTasks]
    })
  }, [initialTasks])

  useEffect(() => {
    setSprintTasks(prev => {
      const serverTasks = sprintPanelData?.tasks ?? []
      if (prev.length === 0) return serverTasks
      const serverMap = new Map(serverTasks.map(t => [t.id, t]))
      const merged = prev
        .map(t => serverMap.get(t.id) ?? null)
        .filter(Boolean) as SprintTask[]
      const prevIds = new Set(prev.map(t => t.id))
      const newTasks = serverTasks.filter(t => !prevIds.has(t.id))
      return [...merged, ...newTasks]
    })
  }, [sprintPanelData])
  // Droppable + DOM ref для бэклог-колонки
  const { setNodeRef: setBacklogDropRef } = useDroppable({ id: 'backlog-drop-zone' })
  const backlogPanelRef = useRef<HTMLDivElement>(null)
  const setBacklogRef = useCallback((node: HTMLDivElement | null) => {
    setBacklogDropRef(node)
    backlogPanelRef.current = node
  }, [setBacklogDropRef])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Только top-level айди для root sortable
  const sortableIds = tasks.map(t => t.id)

  // Geometry-based panel detection: надёжнее closestCenter при пустом бэклоге
  function handleDragMove({ active }: DragMoveEvent) {
    const id = active.id as string
    if (!sprintTasks.some(t => t.id === id)) return
    const translated = active.rect.current.translated
    if (!translated || !backlogPanelRef.current) return
    const activeCenterX = translated.left + translated.width / 2
    const { left, right } = backlogPanelRef.current.getBoundingClientRect()
    setSprintDragOverBacklog(activeCenterX >= left && activeCenterX <= right)
  }

  function handleDragStart({ active }: DragStartEvent) {
    const id = active.id as string
    setActiveId(id)
    setDragPreview(null)
    const isSprintTask = sprintTasks.some(t => t.id === id)
    dragSourceRef.current = isSprintTask ? 'sprint' : 'root'
    dragCurrentRef.current = isSprintTask ? 'sprint' : 'root'
  }

  // Equality-check чтобы не создавать новый объект при каждом вызове → избегаем бесконечного цикла
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
    const isActiveSprintTask = sprintTasks.some(t => t.id === activeId)

    if (isActiveSprintTask) {
      if (overId === SPRINT_DROP_ID || overId === 'drop-sprint-bottom') {
        dragCurrentRef.current = 'sprint'
        applyDragPreview(null)
        return
      }
      if (sprintTasks.some(t => t.id === overId)) {
        const sprintTree = buildSprintTree(sprintTasks)
        const overIdx = sprintTree.findIndex(t => t.id === overId)
        dragCurrentRef.current = 'sprint'
        applyDragPreview(overIdx >= 0 ? { container: 'sprint', insertAt: overIdx } : null)
        return
      }
      // Над бэклогом — геометрия в handleDragMove
      return
    }

    // Backlog task drag
    if (overId === SPRINT_DROP_ID) {
      dragCurrentRef.current = 'sprint'
      if (!dragPreview || dragPreview.container !== 'sprint') applyDragPreview(null)
      return
    }
    if (overId === 'drop-sprint-bottom') {
      dragCurrentRef.current = 'sprint'
      applyDragPreview({ container: 'sprint', insertAt: buildSprintTree(sprintTasks).length })
      return
    }
    if (sprintTasks.some(t => t.id === overId)) {
      const sprintTree = buildSprintTree(sprintTasks)
      const overIdx = sprintTree.findIndex(t => t.id === overId)
      dragCurrentRef.current = 'sprint'
      applyDragPreview(overIdx >= 0 ? { container: 'sprint', insertAt: overIdx } : null)
      return
    }
    dragCurrentRef.current = 'root'
    applyDragPreview(null)
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    setDragPreview(null)
    setSprintDragOverBacklog(false)

    const activeId = active.id as string
    const currentContainer = dragCurrentRef.current
    const isActiveSprintTask = sprintTasks.some(t => t.id === activeId)

    // ── Sprint task drag end ──────────────────────────────────────────────
    if (isActiveSprintTask) {
      if (sprintDragOverBacklog) {
        // Sprint → backlog root
        const sprintTask = sprintTasks.find(t => t.id === activeId)
        if (!sprintTask) return
        const sprintTree = buildSprintTree(sprintTasks)
        const epicNode = sprintTree.find(t => t.id === activeId)
        const subtasksToMove = sprintTask.type === 'epic' && epicNode ? epicNode.subtasks as SprintTask[] : []
        const allToMove = [sprintTask, ...subtasksToMove]
        const allIds = new Set(allToMove.map(t => t.id))
        setSprintTasks(prev => prev.filter(t => !allIds.has(t.id)))
        if (sprintTask.type === 'epic' && subtasksToMove.length > 0) {
          const subtasksBacklog = subtasksToMove.map(s => sprintToBacklog(s))
          const epicBacklog: BacklogTask = {
            ...sprintToBacklog(sprintTask),
            subtasks: subtasksBacklog,
            subtask_total: subtasksBacklog.length,
            subtask_done: subtasksBacklog.filter(s => s.workflow_status === 'done').length,
          }
          setTasks(prev => [...prev, epicBacklog])
        } else {
          setTasks(prev => [...prev, sprintToBacklog(sprintTask)])
        }
        await moveBackToBacklog(activeId, projectId)
        return
      }

      if (!over) return
      const overId = over.id as string
      const sprintTree = buildSprintTree(sprintTasks)

      // Sprint root sort
      if (currentContainer === 'sprint') {
        const oldIdx = sprintTree.findIndex(t => t.id === activeId)
        const newIdx = overId === 'drop-sprint-bottom'
          ? sprintTree.length - 1
          : sprintTree.findIndex(t => t.id === overId)
        if (oldIdx === -1 || newIdx === -1) return
        const reordered = arrayMove(sprintTree, oldIdx, newIdx)
        const flat: SprintTask[] = []
        for (const node of reordered) {
          flat.push(sprintTasks.find(t => t.id === node.id)!)
          for (const sub of node.subtasks) flat.push(sprintTasks.find(t => t.id === sub.id)!)
        }
        setSprintTasks(flat.filter(Boolean))
        await moveTaskInSprint(reordered.map((t, i) => ({ id: t.id, column_id: t.column_id ?? '', column_order: i })))
      }
      return
    }

    // ── Backlog task drag end ─────────────────────────────────────────────
    if (!over) return
    const overId = over.id as string

    // Backlog → sprint
    if (currentContainer === 'sprint' || overId === SPRINT_DROP_ID || overId === 'drop-sprint-bottom' || sprintTasks.some(t => t.id === overId)) {
      const task = findTaskDeep(tasks, activeId)
      if (!task) return
      const capturedSprintTree = buildSprintTree(sprintTasks)
      const sprintInsertAt = dragPreview?.container === 'sprint' ? dragPreview.insertAt : capturedSprintTree.length
      const toMove = task.type === 'epic' ? [task, ...task.subtasks] : [task]
      const moveIds = new Set(toMove.map(t => t.id))
      setTasks(prev => prev.filter(t => !moveIds.has(t.id)).map(t => ({ ...t, subtasks: t.subtasks.filter(s => !moveIds.has(s.id)) })))
      const newSprintObjects = toMove.map(t => ({ ...(t as unknown as SprintTask) }))
      setSprintTasks(() => {
        const flat: SprintTask[] = []
        for (let i = 0; i <= capturedSprintTree.length; i++) {
          if (i === sprintInsertAt) flat.push(...newSprintObjects)
          if (i < capturedSprintTree.length) {
            const node = capturedSprintTree[i]
            flat.push(sprintTasks.find(t => t.id === node.id)!)
            for (const sub of node.subtasks) flat.push(sprintTasks.find(t => t.id === sub.id)!)
          }
        }
        return flat
      })
      await moveToSprint(activeId, projectId)
      scheduleReorder('sprint', [
        ...capturedSprintTree.slice(0, sprintInsertAt).map(n => n.id),
        activeId,
        ...capturedSprintTree.slice(sprintInsertAt).map(n => n.id),
      ])
      return
    }

    // Backlog root sort
    const oldIdx = tasks.findIndex(t => t.id === activeId)
    const newIdx = tasks.findIndex(t => t.id === overId)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(tasks, oldIdx, newIdx)
    setTasks(reordered)
    scheduleReorder('backlog', reordered.map(t => t.id))
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
    setTasks(prev => {
      // Если parent_task_id не меняется — простое обновление полей
      if (updated.parent_task_id === undefined) {
        return prev.map(t => {
          if (t.id === updated.id) return { ...t, ...updated }
          return { ...t, subtasks: t.subtasks.map(s => s.id === updated.id ? { ...s, ...updated } : s) }
        })
      }

      const newParentId = updated.parent_task_id  // string | null

      // Находим задачу и её текущего родителя
      let taskToMove: BacklogTask | undefined = prev.find(t => t.id === updated.id)
      let oldParentId: string | null = null
      if (!taskToMove) {
        for (const t of prev) {
          const sub = t.subtasks.find(s => s.id === updated.id)
          if (sub) { taskToMove = sub; oldParentId = t.id; break }
        }
      }
      if (!taskToMove) return prev
      if (oldParentId === newParentId) {
        return prev.map(t => {
          if (t.id === updated.id) return { ...t, ...updated }
          return { ...t, subtasks: t.subtasks.map(s => s.id === updated.id ? { ...s, ...updated } : s) }
        })
      }

      const movedTask = { ...taskToMove, ...updated } as BacklogTask

      // Удаляем из текущего места
      let result = prev
        .filter(t => t.id !== updated.id)
        .map(t => {
          if (t.id !== oldParentId) return t
          const newSubs = t.subtasks.filter(s => s.id !== updated.id)
          return { ...t, subtasks: newSubs, subtask_total: newSubs.length, subtask_done: newSubs.filter(s => s.workflow_status === 'done').length }
        })

      // Добавляем в новое место
      if (newParentId) {
        result = result.map(t => {
          if (t.id !== newParentId) return t
          const newSubs = [...t.subtasks, movedTask]
          return { ...t, subtasks: newSubs, subtask_total: newSubs.length, subtask_done: newSubs.filter(s => s.workflow_status === 'done').length }
        })
      } else {
        result = [...result, movedTask]
      }

      return result
    })
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
    const task = findTaskDeep(tasks, id)
    if (!task) return
    const toMove = task.type === 'epic' ? [task, ...task.subtasks] : [task]
    const moveIds = new Set(toMove.map(t => t.id))
    setTasks(prev =>
      prev.filter(t => !moveIds.has(t.id)).map(t => ({ ...t, subtasks: t.subtasks.filter(s => !moveIds.has(s.id)) }))
    )
    setSprintTasks(prev => [...prev, ...toMove.map(t => t as unknown as SprintTask)])
  }, [tasks])

  const handleSprintTaskRemoved = useCallback((task: SprintTask, subtasks: SprintTask[]) => {
    if (task.type === 'epic' && subtasks.length > 0) {
      const subtasksBacklog = subtasks.map(s => sprintToBacklog(s))
      const epicBacklog: BacklogTask = {
        ...sprintToBacklog(task),
        subtasks: subtasksBacklog,
        subtask_total: subtasksBacklog.length,
        subtask_done: subtasksBacklog.filter(s => s.workflow_status === 'done').length,
      }
      setTasks(prev => [...prev, epicBacklog])
    } else {
      setTasks(prev => [...prev, sprintToBacklog(task)])
    }
  }, [])

  const handleWorkflowChange = useCallback(async (id: string, status: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) return { ...t, workflow_status: status as WorkflowStatus }
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

  const handleDeadlineChange = useCallback(async (id: string, deadline: string | null) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) return { ...t, deadline }
      if (t.subtasks.some(s => s.id === id))
        return { ...t, subtasks: t.subtasks.map(s => s.id === id ? { ...s, deadline } : s) }
      return t
    }))
    await updateTask(id, projectId, { deadline })
    router.refresh()
  }, [projectId, router])

  const handleTimeChange = useCallback(async (id: string, minutes: number | null) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) return { ...t, time_estimate: minutes }
      if (t.subtasks.some(s => s.id === id))
        return { ...t, subtasks: t.subtasks.map(s => s.id === id ? { ...s, time_estimate: minutes } : s) }
      return t
    }))
    await updateTask(id, projectId, { time_estimate: minutes })
    router.refresh()
  }, [projectId, router])

  const handleRemoveFromEpic = useCallback(async (id: string) => {
    setTasks(prev => {
      const sub = prev.flatMap(t => t.subtasks).find(s => s.id === id)
      if (!sub) return prev
      const updated: BacklogTask = { ...sub, parent_task_id: null, subtasks: [], subtask_total: 0, subtask_done: 0 }
      return [
        ...prev.map(t => {
          if (!t.subtasks.some(s => s.id === id)) return t
          const newSubs = t.subtasks.filter(s => s.id !== id)
          return { ...t, subtasks: newSubs, subtask_total: newSubs.length, subtask_done: newSubs.filter(s => s.workflow_status === 'done').length }
        }),
        updated,
      ]
    })
    await removeFromEpic(id, projectId)
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

  const isActiveEpic = (t: { type: string; workflow_status: string; status: string }) =>
    t.type === 'epic' && t.status !== 'deleted' && t.workflow_status !== 'done' && t.workflow_status !== 'cancelled'

  const epics: BacklogTask[] = [
    ...tasks.filter(isActiveEpic),
    ...sprintTasks.filter(isActiveEpic).map(sprintToBacklog),
  ]

  return (
    <>
      <DndContext
        id="backlog-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 items-start">
          {/* ── Левая панель: бэклог ── */}
          <div
            ref={setBacklogRef}
            className="flex flex-col flex-1 min-w-0 rounded-xl"
            style={{
              background: 'var(--surface)',
              border: `1px solid ${sprintDragOverBacklog ? 'rgba(124,92,246,0.5)' : 'var(--border)'}`,
              transition: 'border-color 0.15s',
            }}
          >
            {/* Шапка — как у спринт-панели */}
            <div
              className="flex items-center justify-between px-4 py-3.5 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3">
                {(() => {
                  const all = tasks.flatMap(t => t.type === 'epic' ? [t, ...t.subtasks] : [t])
                  const tc = all.filter(t => t.type === 'task').length
                  const ec = all.filter(t => t.type === 'epic').length
                  const mins = all.filter(t => t.type === 'task').reduce((s, t) => s + (t.time_estimate ?? 0), 0)
                  return <>
                    {tc > 0 && <span className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{tc} {plural(tc, 'задача', 'задачи', 'задач')}</span>}
                    {ec > 0 && <span className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{ec} {plural(ec, 'эпик', 'эпика', 'эпиков')}</span>}
                    {mins > 0 && <span className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{minutesToDisplay(mins)}</span>}
                    {tc === 0 && ec === 0 && <span className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>Бэклог пуст</span>}
                  </>
                })()}
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

            {/* Контент */}
            <div className="flex-1 p-3">
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
                  style={{ background: 'rgba(124,92,246,0.12)', color: 'var(--accent)' }}
                >
                  Создать первую задачу
                </button>
              </div>
            ) : (
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
                          onDeadlineChange={handleDeadlineChange}
                          onTimeChange={handleTimeChange}
                          onRemoveFromEpic={handleRemoveFromEpic}
                          insertIndicator={insertIndicator}
                        />
                      ) : (
                        <SortableTaskRow
                          task={task}
                          projectId={projectId}
                          hasActiveSprint={hasActiveSprint}
                          insertIndicator={insertIndicator}
                          onDelete={handleDelete}
                          onMoveToSprint={handleMoveToSprint}
                          onEdit={handleEdit}
                          onWorkflowChange={handleWorkflowChange}
                          onDeadlineChange={handleDeadlineChange}
                          onTimeChange={handleTimeChange}
                        />
                      )}
                    </Fragment>
                  )
                })}
                {activeId && <RootDropZone />}
              </div>
            </SortableContext>
            )}
            </div>{/* /контент */}
          </div>

          {/* ── Правая панель: спринт ── */}
          {sprintPanelData ? (
            <SprintPanel
              sprint={sprintPanelData.sprint}
              tasks={sprintTasks}
              activeId={activeId}
              dragPreview={dragPreview}
              onTasksChange={setSprintTasks}
              onTaskRemoved={handleSprintTaskRemoved}
              onEditTask={handleEdit}
              onSprintDeleted={() => {
                setSprintTasks([])
                router.refresh()
              }}
              isAdmin={isAdmin}
              members={members}
            />
          ) : (
            <EmptySprintPanel projectId={projectId} />
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeId && (() => {
            // Ищем только в top-level задачах (эпики) или подзадачах
            const btTopLevel = tasks.find(t => t.id === activeId)
            const btSub = btTopLevel ? null : tasks.flatMap(t => t.subtasks).find(s => s.id === activeId) ?? null
            const st = sprintTasks.find(t => t.id === activeId)
            const overlayTask = btTopLevel ?? btSub ?? (st ? sprintToBacklog(st) : null)
            if (!overlayTask) return null

            // Подзадачи для overlay (только для top-level эпиков)
            let subtasksForOverlay: BacklogTask[] = []
            if (overlayTask.type === 'epic') {
              if (btTopLevel) {
                subtasksForOverlay = btTopLevel.subtasks
              } else if (st) {
                const sprintNode = buildSprintTree(sprintTasks).find(n => n.id === activeId)
                if (sprintNode) subtasksForOverlay = sprintNode.subtasks.map(s => sprintToBacklog(s as SprintTask))
              }
            }

            return (
              <div
                className="rounded-xl shadow-2xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--accent)', opacity: 0.95 }}
              >
                <div style={{ borderBottom: subtasksForOverlay.length > 0 ? '1px solid var(--border)' : undefined }}>
                  <TaskCard
                    task={overlayTask}
                    projectId={projectId}
                    hasActiveSprint={false}
                    isOverlay
                    onOptimisticDelete={() => {}}
                    onOptimisticMoveToSprint={() => {}}
                  />
                </div>
                {subtasksForOverlay.length > 0 && (
                  <div style={{ background: 'var(--surface2)', borderRadius: '0 0 12px 12px' }}>
                    {subtasksForOverlay.map((sub, i) => (
                      <div
                        key={sub.id}
                        style={{
                          borderBottom: i < subtasksForOverlay.length - 1 ? '1px solid var(--border)' : undefined,
                          opacity: 0.85,
                        }}
                      >
                        <TaskCard
                          task={sub}
                          projectId={projectId}
                          hasActiveSprint={false}
                          isOverlay
                          onOptimisticDelete={() => {}}
                          onOptimisticMoveToSprint={() => {}}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </DragOverlay>
      </DndContext>

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
          epics={epics}
          initialComments={editingTaskComments}
          onClose={() => setEditingTask(null)}
          onUpdated={handleUpdated}
        />
      )}
    </>
  )
}

// ── Утилиты для выбора дат ─────────────────────────────────────────────────
const MONTHS_RU_BB = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS_BB = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

function toIsoBB(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function MiniCalBB({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [view, setView] = useState(() => value ? new Date(value + 'T00:00:00') : new Date())
  const year = view.getFullYear(); const month = view.getMonth()
  let startDow = new Date(year, month, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells: { day: number; month: number; year: number; cur: boolean }[] = []
  for (let i = startDow - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, month: month - 1, year: month === 0 ? year - 1 : year, cur: false })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, month, year, cur: true })
  while (cells.length % 7 !== 0) {
    const d = cells.length - daysInMonth - startDow + 1
    cells.push({ day: d, month: month + 1, year: month === 11 ? year + 1 : year, cur: false })
  }
  const sel = value ? (() => { const d = new Date(value + 'T00:00:00'); d.setHours(0,0,0,0); return d })() : null
  return (
    <div style={{ width: 224 }}>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => setView(new Date(year, month - 1, 1))} style={{ color: 'var(--text2)', cursor: 'pointer', padding: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 3L4.5 6L7.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{MONTHS_RU_BB[month]} {year}</span>
        <button type="button" onClick={() => setView(new Date(year, month + 1, 1))} style={{ color: 'var(--text2)', cursor: 'pointer', padding: 4 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS_BB.map(wd => <div key={wd} className="text-center" style={{ color: 'var(--text2)', fontSize: 10 }}>{wd}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          const d = new Date(c.year, c.month, c.day); d.setHours(0,0,0,0)
          const isSelected = sel && d.getTime() === sel.getTime()
          return (
            <button key={i} type="button"
              onClick={() => onChange(toIsoBB(new Date(c.year, c.month, c.day)))}
              style={{ height: 26, fontSize: 11, borderRadius: 4, color: !c.cur ? 'var(--text2)' : isSelected ? '#fff' : 'var(--text)', background: isSelected ? 'var(--accent)' : 'transparent', opacity: !c.cur ? 0.35 : 1, cursor: 'pointer' }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >{c.day}</button>
          )
        })}
      </div>
    </div>
  )
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(2)}`
}

function CreateSprintModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const router = useRouter()
  const now = new Date()
  const end = new Date(now); end.setDate(end.getDate() + 6)
  const [dateFrom, setDateFrom] = useState(toIsoBB(now))
  const [dateTo, setDateTo] = useState(toIsoBB(end))
  const [step, setStep] = useState<'from' | 'to'>('from')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!dateFrom || !dateTo) return
    setSaving(true)
    try {
      await createSprint(projectId, dateFrom, dateTo)
      router.refresh()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: 300, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'dropdownIn 0.12s ease-out' }}>
        <p className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>Новый спринт</p>

        {/* Табы начало / конец */}
        <div className="flex gap-2 mb-4">
          {(['from', 'to'] as const).map(s => (
            <button key={s} type="button" onClick={() => setStep(s)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: step === s ? 'var(--accent)' : 'var(--surface2)',
                color: step === s ? '#fff' : 'var(--text2)',
                cursor: 'pointer',
              }}>
              {s === 'from' ? `Начало: ${fmtDate(dateFrom)}` : `Конец: ${fmtDate(dateTo)}`}
            </button>
          ))}
        </div>

        {/* Календарь */}
        <div className="flex justify-center mb-5">
          {step === 'from' ? (
            <MiniCalBB value={dateFrom} onChange={v => { setDateFrom(v); setStep('to') }} />
          ) : (
            <MiniCalBB value={dateTo} onChange={v => setDateTo(v)} />
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer' }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || !dateFrom || !dateTo}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
            {saving ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function EmptySprintPanel({ projectId }: { projectId: string }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div
        className="flex flex-col flex-1 rounded-xl min-w-0"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--text2)', opacity: 0.4 }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Спринт</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 flex-1 py-16 px-6">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.2 }}>
            <rect x="4" y="4" width="32" height="32" rx="4" stroke="var(--text2)" strokeWidth="1.5"/>
            <path d="M13 20h14M20 13v14" stroke="var(--text2)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="text-sm text-center" style={{ color: 'var(--text2)' }}>Нет активного спринта</p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'rgba(124,92,246,0.12)', color: 'var(--accent)', cursor: 'pointer' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Создать спринт
          </button>
        </div>
      </div>
      {showModal && <CreateSprintModal projectId={projectId} onClose={() => setShowModal(false)} />}
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
