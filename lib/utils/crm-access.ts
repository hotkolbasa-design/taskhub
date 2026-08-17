// Кто видит раздел CRM: админы, маркетологи (по должности) и отделы маркетинга/продаж.
export const CRM_DEPARTMENTS = ['маркетинг', 'отдел продаж']

export function canAccessCrm(p: {
  role?: string | null
  position?: string | null
  department?: string | null
}): boolean {
  if (p.role === 'admin') return true
  if (p.position?.trim().toLowerCase() === 'маркетолог') return true
  const dept = p.department?.trim().toLowerCase()
  return !!dept && CRM_DEPARTMENTS.includes(dept)
}
