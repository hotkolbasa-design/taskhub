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
  workflow_status: WorkflowStatus
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
}

export type SprintTask = Task & {
  assignee: TaskAssignee | null
}

export type BacklogTask = Task & {
  assignee: TaskAssignee | null
  subtasks: BacklogTask[]
  subtask_total: number
  subtask_done: number
}
