export type EffTask = {
  type?: string | null
  workflow_status: string
  time_estimate?: number | null
  task_status?: string | null
}

/**
 * Эффективность = время выполненных / время (выполненных + невыполненных) × 100.
 * Эпики, удалённые и отменённые задачи исключаются. Если оценок времени нет — считаем по количеству.
 * Единый источник правды: используется и в истории/аналитике, и вживую в спринт-панели.
 */
export function computeEfficiency(tasks: EffTask[]): number {
  const active = tasks.filter(
    t => t.type !== 'epic' && t.task_status !== 'deleted' && t.workflow_status !== 'cancelled',
  )
  const done = active.filter(t => t.workflow_status === 'done')
  const doneTime = done.reduce((s, t) => s + (t.time_estimate ?? 0), 0)
  const relevantTime = active.reduce((s, t) => s + (t.time_estimate ?? 0), 0)

  if (relevantTime > 0) return Math.round((doneTime / relevantTime) * 100)
  if (active.length > 0) return Math.round((done.length / active.length) * 100)
  return 0
}

/** Цвет-порог, одинаковый в истории, аналитике и спринт-панели. */
export function efficiencyColor(eff: number): string {
  return eff >= 80 ? 'var(--green)' : eff >= 50 ? 'var(--accent)' : 'var(--red)'
}
