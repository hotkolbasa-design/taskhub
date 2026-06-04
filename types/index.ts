export type UserRole = 'admin' | 'employee'
export type UserStatus = 'active' | 'inactive' | 'pending'
export type ProjectMemberRole = 'owner' | 'member' | 'viewer'

export type Profile = {
  id: string
  full_name: string | null
  login: string
  role: UserRole
  status: UserStatus
  avatar_url: string | null
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
