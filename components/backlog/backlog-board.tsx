'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
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
} from '@dnd-kit/sortable'
import { reorderBacklog, reorderSprintTasks, updateTask, getComments, moveToSprint, moveBackToBacklog } from '@/app/(dashboard)/projects/[id]/backlog/actions'
import { moveTaskInSprint } from '@/app/(dashboard)/projects/[id]/sprint/actions'
import type { WorkflowStatus, SprintTask, Sprint } from '@/types'
import TaskCard from './task-card'
import CreateTaskModal from './create-task-modal'
import TaskDrawer from './task-drawer'
import SprintPanel, {
  SPRINT_DROP_ID,
  SPRINT_EPIC_DROP_PREFIX,
  SPRINT_EPIC_END_PREFIX,
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
  onDeadlineChange,
  onTimeChange,
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
  onDeadlineChange: (id: string, deadline: string | null) => void
  onTimeChange: (id: string, minutes: number | null) => void
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
        <div className="flex-1 min-w-0">
          <TaskCard
            task={epic}
            projectId={projectId}
            hasActiveSprint={hasActiveSprint}
            onOptimisticDelete={onDelete}
            onOptimisticMoveToSprint={onMoveToSprint}
            onEdit={onEdit}
            onWorkflowChange={onWorkflowChange}
            onDeadlineChange={onDeadlineChange}
            onTimeChange={onTimeChange}
          />
        </div>
        {/* Прогресс + раскрыть */}
        <div className="flex items-center gap-2 pr-3 shrink-0">
          {epic.subtask_total > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface2)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--accent)' }}
                />
              </div>
              <span className="text-xs" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
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
      {/* Bottom drop zone — вставить после последней подзадачи */}
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

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'drop-root-bottom' })
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

export default function BacklogBoard({ projectId, initialTasks, members, membersMap, hasActiveSprint, currentUserId, defaultAssigneeMode, defaultAssigneeId, sprintPanelData = null }: Props) {
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

  // Дебаунс рефреша: при быстром перетаскивании не обновляем страницу на каждый drop
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => { router.refresh() }, 600)
  }, [router])

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
      router.refresh()
    }, 600)
  }, [projectId, router])
  useEffect(() => { setTasks(initialTasks) }, [initialTasks])
  useEffect(() => { setSprintTasks(sprintPanelData?.tasks ?? []) }, [sprintPanelData])
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

  const activeTask = tasks.find(t => t.id === activeId)
    ?? tasks.flatMap(t => t.subtasks).find(s => s.id === activeId)
    ?? null

  function findSprintContainer(id: string): string {
    const tree = buildSprintTree(sprintTasks)
    if (tree.find(t => t.id === id)) return 'sprint'
    for (const t of tree) {
      if (t.subtasks.some(s => s.id === id)) return `sprint-epic-${t.id}`
    }
    return 'sprint'
  }

  // Geometry-based panel detection: обходит closestCenter, который ошибается при пустом бэклоге
  // (пустой бэклог короткий → его центр дальше от курсора, чем высокая спринт-панель)
  function handleDragMove({ active }: DragMoveEvent) {
    const id = active.id as string
    if (!sprintTasks.some(t => t.id === id)) return
    const translated = active.rect.current.translated
    if (!translated || !backlogPanelRef.current) return
    const activeCenterX = translated.left + translated.width / 2
    const { left, right } = backlogPanelRef.current.getBoundingClientRect()
    const isOverBacklog = activeCenterX >= left && activeCenterX <= right
    if (isOverBacklog && dragCurrentRef.current.startsWith('sprint')) {
      dragCurrentRef.current = 'root'
      setSprintDragOverBacklog(true)
    } else if (!isOverBacklog && !dragCurrentRef.current.startsWith('sprint')) {
      dragCurrentRef.current = 'sprint'
      setSprintDragOverBacklog(false)
    }
  }

  function handleDragStart({ active }: DragStartEvent) {
    const id = active.id as string
    setActiveId(id)
    setDragPreview(null)
    const isSprintTask = sprintTasks.some(t => t.id === id)
    if (isSprintTask) {
      const c = findSprintContainer(id)
      dragSourceRef.current = c
      dragCurrentRef.current = c
    } else {
      const c = findContainer(tasks, id)
      dragSourceRef.current = c
      dragCurrentRef.current = c
    }
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
    const isActiveSprintTask = sprintTasks.some(t => t.id === activeId)

    // ── Sprint task dragging ────────────────────────────────────────────────
    if (isActiveSprintTask) {
      // Если тащим эпик — игнорируем over его собственных подзадач
      // (DragOverlay большой и проходит над ними, но это не смена контейнера)
      const activeSprintTask = sprintTasks.find(t => t.id === activeId)
      if (activeSprintTask?.type === 'epic' &&
          sprintTasks.some(t => t.id === overId && t.parent_task_id === activeId)) {
        return
      }

      // Над sprint panel или нижней зоной спринта
      if (overId === SPRINT_DROP_ID || overId === 'drop-sprint-bottom') {
        dragCurrentRef.current = 'sprint'
        applyDragPreview(null)
        return
      }
      // Над зоной бросания в sprint-эпик
      if (overId.startsWith(SPRINT_EPIC_DROP_PREFIX) || overId.startsWith(SPRINT_EPIC_END_PREFIX)) {
        const epicId = overId.startsWith(SPRINT_EPIC_END_PREFIX)
          ? overId.replace(SPRINT_EPIC_END_PREFIX, '')
          : overId.replace(SPRINT_EPIC_DROP_PREFIX, '')
        const sprintTree = buildSprintTree(sprintTasks)
        const targetEpic = sprintTree.find(t => t.id === epicId)
        dragCurrentRef.current = `sprint-epic-${epicId}`
        if (targetEpic) applyDragPreview({ container: `sprint-epic-${epicId}`, insertAt: targetEpic.subtasks.length })
        return
      }
      // Над задачей спринта
      if (sprintTasks.some(t => t.id === overId)) {
        const sprintTree = buildSprintTree(sprintTasks)
        const overContainer = (() => {
          if (sprintTree.find(t => t.id === overId)) return 'sprint'
          for (const t of sprintTree) {
            if (t.subtasks.some(s => s.id === overId)) return `sprint-epic-${t.id}`
          }
          return 'sprint'
        })()
        dragCurrentRef.current = overContainer
        const srcContainer = dragSourceRef.current
        if (srcContainer === overContainer) {
          applyDragPreview(null) // @dnd-kit handles CSS transforms
        } else if (overContainer.startsWith('sprint-epic-')) {
          const epicId = overContainer.replace('sprint-epic-', '')
          const targetEpic = sprintTree.find(t => t.id === epicId)
          if (targetEpic) {
            const overIdx = targetEpic.subtasks.findIndex(s => s.id === overId)
            applyDragPreview({ container: overContainer, insertAt: overIdx >= 0 ? overIdx : targetEpic.subtasks.length })
          }
        } else {
          const overIdx = sprintTree.findIndex(t => t.id === overId)
          applyDragPreview({ container: 'sprint', insertAt: overIdx >= 0 ? overIdx : sprintTree.length })
        }
        return
      }
      // Над бэклогом (любой бэклог-элемент или droppable-зона)
      let backlogContainer: string
      if (overId === 'backlog-drop-zone' || overId === 'drop-root-bottom') {
        backlogContainer = 'root'
      } else if (overId.startsWith('drop-epic-end-')) {
        backlogContainer = overId.replace('drop-epic-end-', '')
      } else if (overId.startsWith('drop-epic-')) {
        backlogContainer = overId.replace('drop-epic-', '')
      } else {
        backlogContainer = findContainer(tasks, overId) || 'root'
      }
      dragCurrentRef.current = backlogContainer
      applyDragPreview(null)
      return
    }

    // ── Backlog task dragging ───────────────────────────────────────────────
    // Тащим в sprint-эпик: запоминаем конкретный эпик
    if (overId.startsWith(SPRINT_EPIC_DROP_PREFIX) || overId.startsWith(SPRINT_EPIC_END_PREFIX)) {
      const epicId = overId.startsWith(SPRINT_EPIC_END_PREFIX)
        ? overId.replace(SPRINT_EPIC_END_PREFIX, '')
        : overId.replace(SPRINT_EPIC_DROP_PREFIX, '')
      dragCurrentRef.current = `sprint-epic-${epicId}`
      // Ставим dragPreview чтобы эпик в спринте подсвечивался, а не вся панель
      const sprintTree = buildSprintTree(sprintTasks)
      const targetEpic = sprintTree.find(t => t.id === epicId)
      applyDragPreview(targetEpic
        ? { container: `sprint-epic-${epicId}`, insertAt: targetEpic.subtasks.length }
        : null
      )
      return
    }
    // Тащим в спринт (root) — вычисляем позицию вставки
    if (overId === SPRINT_DROP_ID) {
      dragCurrentRef.current = 'sprint'
      // Не сбрасываем dragPreview — курсор мог на миг попасть на контейнер панели
      // между задачами. Если уже есть sprint-позиция — оставляем её.
      if (!dragPreview || dragPreview.container !== 'sprint') {
        applyDragPreview(null)
      }
      return
    }
    if (overId === 'drop-sprint-bottom') {
      const sprintTree = buildSprintTree(sprintTasks)
      dragCurrentRef.current = 'sprint'
      applyDragPreview({ container: 'sprint', insertAt: sprintTree.length })
      return
    }
    if (sprintTasks.some(t => t.id === overId)) {
      const sprintTree = buildSprintTree(sprintTasks)
      const overIdx = sprintTree.findIndex(t => t.id === overId)
      dragCurrentRef.current = 'sprint'
      applyDragPreview(overIdx >= 0
        ? { container: 'sprint', insertAt: overIdx }
        : null
      )
      return
    }

    const activeTask = findTaskDeep(tasks, activeId)
    if (!activeTask || activeTask.type === 'epic') return

    let overContainer: string
    if (overId === 'backlog-drop-zone' || overId === 'drop-root-bottom') {
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
      applyDragPreview(null)
    } else {
      if (overContainer !== 'root') {
        const targetEpic = tasks.find(t => t.id === overContainer)
        if (targetEpic) {
          if (overId.startsWith('drop-epic-end-') || overId.startsWith('drop-epic-')) {
            applyDragPreview({ container: overContainer, insertAt: targetEpic.subtasks.length })
          } else {
            const overIdx = targetEpic.subtasks.findIndex(s => s.id === overId)
            applyDragPreview({ container: overContainer, insertAt: overIdx >= 0 ? overIdx : targetEpic.subtasks.length })
          }
        }
      } else {
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
    setSprintDragOverBacklog(false)

    const activeId = active.id as string
    const sourceContainer = dragSourceRef.current
    const currentContainer = dragCurrentRef.current
    const isActiveSprintTask = sprintTasks.some(t => t.id === activeId)

    // ── Sprint task drag end ──────────────────────────────────────────────
    if (isActiveSprintTask) {
      const overIdMaybe = over?.id as string | undefined

      // Определяем sprint→backlog:
      // - currentContainer не в спринте (dragOver обновил), ИЛИ
      // - over.id — элемент бэклога (задача, droppable-зона, drop-root-bottom)
      // - НЕ считаем sprint-элементы или подзадачи самого перетаскиваемого эпика
      const isDroppedOnBacklog = (() => {
        // Главный сигнал: handleDragOver обновил dragCurrentRef когда курсор был над бэклогом
        if (!currentContainer.startsWith('sprint')) return true
        // Если over явно принадлежит спринту — остаёмся
        if (overIdMaybe === undefined) return false
        if (overIdMaybe === SPRINT_DROP_ID ||
            overIdMaybe === 'drop-sprint-bottom' ||
            overIdMaybe.startsWith(SPRINT_EPIC_DROP_PREFIX) ||
            overIdMaybe.startsWith(SPRINT_EPIC_END_PREFIX)) return false
        if (sprintTasks.some(t => t.id === overIdMaybe)) {
          const isOwnSubtask = sprintTasks.some(t => t.id === overIdMaybe && t.parent_task_id === activeId)
          if (!isOwnSubtask) return false
        }
        return true
      })()

      if (isDroppedOnBacklog) {
        const sprintTask = sprintTasks.find(t => t.id === activeId)
        if (!sprintTask) return
        const sprintTree = buildSprintTree(sprintTasks)
        const epicNode = sprintTree.find(t => t.id === activeId)
        const subtasksToMove = sprintTask.type === 'epic' && epicNode ? epicNode.subtasks as SprintTask[] : []
        const allToMove = [sprintTask, ...subtasksToMove]
        const allIds = new Set(allToMove.map(t => t.id))

        // Проверяем, не бросили ли в бэклог-эпик (currentContainer = epicId, не 'root' и не 'sprint*')
        const targetBacklogEpicId = (!currentContainer.startsWith('sprint') && currentContainer !== 'root')
          ? currentContainer : null

        setSprintTasks(prev => prev.filter(t => !allIds.has(t.id)))
        if (targetBacklogEpicId && sprintTask.type !== 'epic') {
          // Drop в конкретный бэклог-эпик
          setTasks(prev => prev.map(t =>
            t.id === targetBacklogEpicId
              ? { ...t, subtasks: [...t.subtasks, sprintToBacklog({ ...sprintTask, parent_task_id: targetBacklogEpicId })], subtask_total: t.subtask_total + 1 }
              : t
          ))
        } else if (sprintTask.type === 'epic' && subtasksToMove.length > 0) {
          // Эпик с подзадачами: вкладываем подзадачи внутрь эпика сразу
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
        await moveBackToBacklog(activeId, projectId, targetBacklogEpicId)
        scheduleRefresh()
        return
      }

      if (!over) return
      const overId = over.id as string

      const sprintTree = buildSprintTree(sprintTasks)

      // Sprint same-container sort
      if (sourceContainer === currentContainer) {
        if (currentContainer === 'sprint') {
          const oldIdx = sprintTree.findIndex(t => t.id === activeId)
          // Нормализуем overId: дроп-зоны эпика → сам эпик (closestCenter иногда возвращает их)
          const resolvedOverId = overId.startsWith(SPRINT_EPIC_END_PREFIX)
            ? overId.replace(SPRINT_EPIC_END_PREFIX, '')
            : overId.startsWith(SPRINT_EPIC_DROP_PREFIX)
              ? overId.replace(SPRINT_EPIC_DROP_PREFIX, '')
              : overId
          const newIdx = resolvedOverId === 'drop-sprint-bottom'
            ? sprintTree.length - 1
            : sprintTree.findIndex(t => t.id === resolvedOverId)
          if (oldIdx === -1 || newIdx === -1) return
          const reordered = arrayMove(sprintTree, oldIdx, newIdx)
          const flat: SprintTask[] = []
          for (const node of reordered) {
            const orig = sprintTasks.find(t => t.id === node.id)!
            flat.push(orig)
            for (const sub of node.subtasks) flat.push(sprintTasks.find(t => t.id === sub.id)!)
          }
          setSprintTasks(flat)
          await moveTaskInSprint(reordered.map((t, i) => ({ id: t.id, column_id: t.column_id ?? '', column_order: i })))
          scheduleRefresh()
        } else {
          // Sort within sprint epic
          const epicId = currentContainer.replace('sprint-epic-', '')
          const epic = sprintTree.find(t => t.id === epicId)
          if (!epic) return
          const oldIdx = epic.subtasks.findIndex(s => s.id === activeId)
          const newIdx = epic.subtasks.findIndex(s => s.id === overId)
          if (oldIdx === -1 || newIdx === -1) return
          const reorderedSubs = arrayMove(epic.subtasks, oldIdx, newIdx)
          const flat: SprintTask[] = []
          for (const node of sprintTree) {
            flat.push(sprintTasks.find(t => t.id === node.id)!)
            const subs = node.id === epicId ? reorderedSubs : node.subtasks
            for (const sub of subs) flat.push(sprintTasks.find(t => t.id === sub.id)!)
          }
          setSprintTasks(flat.filter(Boolean))
          await moveTaskInSprint(reorderedSubs.map((s, i) => ({ id: s.id, column_id: s.column_id ?? '', column_order: i })))
          scheduleRefresh()
        }
        return
      }

      // Sprint cross-container
      const sprintTask = sprintTasks.find(t => t.id === activeId)
      if (!sprintTask) return
      const withoutActive = sprintTasks.filter(t => t.id !== activeId)

      if (currentContainer === 'sprint') {
        // Sprint epic subtask → sprint root
        const updated = { ...sprintTask, parent_task_id: null as string | null }
        const treeWithout = buildSprintTree(withoutActive)
        // Нормализуем overId и используем dragPreview как основной источник позиции
        const resolvedOverId = overId.startsWith(SPRINT_EPIC_END_PREFIX)
          ? overId.replace(SPRINT_EPIC_END_PREFIX, '')
          : overId.startsWith(SPRINT_EPIC_DROP_PREFIX)
            ? overId.replace(SPRINT_EPIC_DROP_PREFIX, '')
            : overId
        const overIdx = treeWithout.findIndex(t => t.id === resolvedOverId)
        const insertAt = dragPreview?.container === 'sprint'
          ? dragPreview.insertAt
          : (overIdx >= 0 ? overIdx : treeWithout.length)
        const flat: SprintTask[] = []
        for (let i = 0; i < treeWithout.length; i++) {
          if (i === insertAt) flat.push(updated)
          const node = treeWithout[i]
          flat.push(withoutActive.find(t => t.id === node.id)!)
          for (const sub of node.subtasks) flat.push(withoutActive.find(t => t.id === sub.id)!)
        }
        if (insertAt >= treeWithout.length) flat.push(updated)
        setSprintTasks(flat.filter(Boolean))
        await updateTask(activeId, projectId, { parent_task_id: null })
        scheduleRefresh()
      } else {
        // Sprint task → sprint epic
        const epicId = currentContainer.replace('sprint-epic-', '')
        const updated = { ...sprintTask, parent_task_id: epicId }
        const treeWithout = buildSprintTree(withoutActive)
        const targetEpic = treeWithout.find(t => t.id === epicId)
        if (!targetEpic) return
        const dragPrev = dragPreview
        const insertAt = dragPrev?.container === currentContainer ? dragPrev.insertAt : targetEpic.subtasks.length
        const flat: SprintTask[] = []
        for (const node of treeWithout) {
          flat.push(withoutActive.find(t => t.id === node.id)!)
          const subs = node.id === epicId
            ? [...node.subtasks.slice(0, insertAt), updated, ...node.subtasks.slice(insertAt)]
            : node.subtasks
          for (const sub of subs) {
            const orig = sub.id === activeId ? updated : withoutActive.find(t => t.id === sub.id)!
            flat.push(orig)
          }
        }
        setSprintTasks(flat.filter(Boolean))
        await updateTask(activeId, projectId, { parent_task_id: epicId })
        scheduleRefresh()
      }
      return
    }

    // После sprint-блока: для бэклог-логики нужен over
    if (!over) return
    const overId = over.id as string

    // Перетащили в спринт: currentContainer начинается с 'sprint', или over — sprint-элемент
    if (currentContainer.startsWith('sprint') ||
        overId === SPRINT_DROP_ID ||
        overId === 'drop-sprint-bottom' ||
        overId.startsWith(SPRINT_EPIC_DROP_PREFIX) ||
        overId.startsWith(SPRINT_EPIC_END_PREFIX) ||
        sprintTasks.some(t => t.id === overId)) {
      const task = findTaskDeep(tasks, activeId)
      if (!task) return

      // targetSprintEpicId определяем ТОЛЬКО по currentContainer (отражает намерение пользователя).
      // overId при drop может быть SPRINT_EPIC_END_PREFIX даже когда курсор был над корнем спринта —
      // использование overId здесь давало неверный результат.
      const targetSprintEpicId = currentContainer.startsWith('sprint-epic-')
        ? currentContainer.replace('sprint-epic-', '')
        : null

      const capturedSprintTree = buildSprintTree(sprintTasks)
      // dragPreview в замыкании ещё содержит значение до setDragPreview(null) вверху
      const sprintInsertAt = dragPreview?.container === 'sprint'
        ? dragPreview.insertAt
        : capturedSprintTree.length  // дефолт — в конец

      const toMove = task.type === 'epic' ? [task, ...task.subtasks] : [task]
      const moveIds = new Set(toMove.map(t => t.id))
      setTasks(prev =>
        prev.filter(t => !moveIds.has(t.id)).map(t => ({ ...t, subtasks: t.subtasks.filter(s => !moveIds.has(s.id)) }))
      )

      const newSprintObjects = toMove.map(t => ({
        ...(t as unknown as SprintTask),
        parent_task_id: (targetSprintEpicId && task.type !== 'epic') ? targetSprintEpicId : (t as unknown as SprintTask).parent_task_id,
      }))

      if (!targetSprintEpicId && task.type !== 'epic') {
        // Вставляем на конкретную позицию в корень спринта
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
      } else {
        setSprintTasks(prev => [...prev, ...newSprintObjects])
      }

      await moveToSprint(activeId, projectId)
      if (targetSprintEpicId && task.type !== 'epic') {
        await updateTask(activeId, projectId, { parent_task_id: targetSprintEpicId })
      }
      // Сохраняем порядок для задач в корне спринта (дебаунс — только финальный порядок в БД)
      if (!targetSprintEpicId && task.type !== 'epic') {
        const reordered = [
          ...capturedSprintTree.slice(0, sprintInsertAt).map(n => n.id),
          activeId,
          ...capturedSprintTree.slice(sprintInsertAt).map(n => n.id),
        ]
        scheduleReorder('sprint', reordered)
      } else {
        scheduleRefresh()
      }
      return
    }

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

      await updateTask(activeId, projectId, {
        parent_task_id: currentContainer === 'root' ? null : currentContainer,
      })
      // Порядок сохраняется дебаунсом — только финальный порядок попадает в БД
      if (currentContainer === 'root') {
        scheduleReorder('backlog', newTasks.map(t => t.id))
      } else {
        const epic = newTasks.find(t => t.id === currentContainer)
        if (epic) scheduleReorder('backlog', epic.subtasks.map(s => s.id))
        else scheduleRefresh()
      }
      return
    }

    // Одинаковый контейнер — вычисляем финальный порядок и сохраняем
    if (currentContainer === 'root') {
      const oldIdx = tasks.findIndex(t => t.id === activeId)
      const newIdx = tasks.findIndex(t => t.id === overId)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(tasks, oldIdx, newIdx)
      setTasks(reordered)
      scheduleReorder('backlog', reordered.map(t => t.id))
    } else {
      const epic = tasks.find(t => t.id === currentContainer)
      if (!epic) return
      const oldIdx = epic.subtasks.findIndex(s => s.id === activeId)
      const newIdx = epic.subtasks.findIndex(s => s.id === overId)
      if (oldIdx === -1 || newIdx === -1) return
      const reordered = arrayMove(epic.subtasks, oldIdx, newIdx)
      setTasks(prev => prev.map(t => t.id === currentContainer ? { ...t, subtasks: reordered } : t))
      scheduleReorder('backlog', reordered.map(s => s.id))
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
              border: `1px solid ${sprintDragOverBacklog ? 'rgba(79,142,247,0.5)' : 'var(--border)'}`,
              transition: 'border-color 0.15s',
            }}
          >
            {/* Шапка — как у спринт-панели */}
            <div
              className="flex items-center justify-between px-4 py-3.5 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text2)' }}>
                {tasks.length} {plural(tasks.length, 'задача', 'задачи', 'задач')}
              </span>
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
                  style={{ background: 'rgba(79,142,247,0.12)', color: 'var(--accent)' }}
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
                            onDeadlineChange={handleDeadlineChange}
                            onTimeChange={handleTimeChange}
                          />
                        </div>
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
          {sprintPanelData && (
            <SprintPanel
              sprint={sprintPanelData.sprint}
              tasks={sprintTasks}
              activeId={activeId}
              dragPreview={dragPreview}
              onTasksChange={setSprintTasks}
              onTaskRemoved={handleSprintTaskRemoved}
              onEditTask={handleEdit}
            />
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
                          isSubtask
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
