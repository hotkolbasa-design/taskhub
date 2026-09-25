export type UserRole = 'admin' | 'employee'
export type TaskType = 'task' | 'epic'
export type TaskStatus = 'backlog' | 'sprint' | 'done' | 'deleted'
export type WorkflowStatus = 'new' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type UserStatus = 'active' | 'inactive' | 'pending'
export type ProjectMemberRole = 'owner' | 'manager' | 'member' | 'viewer'

export type Profile = {
  id: string
  full_name: string | null
  login: string
  role: UserRole
  status: UserStatus
  avatar_url: string | null
  position: string | null
  department: string | null
  birth_date: string | null
  created_at: string
}

export type Project = {
  id: string
  name: string
  description: string | null
  color: string
  default_assignee_mode: 'creator' | 'specific' | 'manual'
  default_assignee_id: string | null
  created_by: string
  created_at: string
}

export type ProjectWithMeta = Project & {
  my_role: ProjectMemberRole
  member_count: number
}

export type Task = {
  id: string
  project_id: string
  title: string
  description: string | null
  type: TaskType
  status: TaskStatus
  assignee_id: string | null
  creator_id: string
  deadline: string | null
  time_estimate: number | null
  parent_task_id: string | null
  sprint_id: string | null
  column_id: string | null
  column_order: number | null
  backlog_order: number | null
  is_recurring: boolean
  tags: string[] | null
  priority: 'medium' | 'high' | null
  workflow_status: WorkflowStatus
  deleted_at: string | null
  deleted_by: string | null
  created_at: string
  updated_at: string
}

export type TaskAssignee = {
  full_name: string | null
  login: string
  avatar_url: string | null
}

export type Sprint = {
  id: string
  project_id: string
  name: string
  date_from: string
  date_to: string
  status: 'active' | 'closed'
  is_fixed: boolean
  fixed_at: string | null
  fixed_task_ids: string[]
  created_by: string
  created_at: string
}

export type SprintColumn = {
  id: string
  sprint_id: string
  name: string
  color: string
  order_index: number
  role: 'todo' | 'done' | null
}

export type SprintTask = Task & {
  assignee: TaskAssignee | null
  parent_epic: { id: string; title: string } | null
}

export type BacklogTask = Task & {
  assignee: TaskAssignee | null
  subtasks: BacklogTask[]
  subtask_total: number
  subtask_done: number
}

// ─── Заявки на расходы ───────────────────────────────────────────────────────

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'needs_info' | 'cancelled'
export type ExpenseCategory = 'equipment' | 'software' | 'services' | 'office' | 'marketing' | 'other'

export type ExpensePerson = {
  id: string
  full_name: string | null
  login: string
  avatar_url: string | null
}

export type ExpenseAttachment = { url: string; name: string; size: number }

export type ExpenseRequest = {
  id: string
  number: string
  requester_id: string
  title: string
  justification: string | null
  category: ExpenseCategory
  amount: number
  currency: string
  department: string | null
  needed_by: string | null
  attachments: ExpenseAttachment[]
  status: ExpenseStatus
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  paid_at: string | null
  paid_by: string | null
  paid_amount: number | null
  paid_note: string | null
  created_at: string
  updated_at: string
  requester: ExpensePerson | null
  decider: ExpensePerson | null
  payer: ExpensePerson | null
  comment_count: number
}

export type ExpenseComment = {
  id: string
  request_id: string
  author_id: string
  text: string
  attachments: ExpenseAttachment[]
  created_at: string
  author: ExpensePerson | null
}

export type ExpenseActivity = {
  id: string
  request_id: string
  actor_id: string | null
  type: 'created' | 'status_changed' | 'edited' | 'paid' | 'payment_undone'
  old_value: string | null
  new_value: string | null
  created_at: string
  actor: ExpensePerson | null
}
