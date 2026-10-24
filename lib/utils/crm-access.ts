// Кто видит раздел CRM: админы, маркетологи (по должности) и отделы маркетинга/продаж.
// Английские названия — для демо-копии: там отделы и должности по-английски (scripts/demo_data.py).
export const CRM_DEPARTMENTS = ['маркетинг', 'отдел продаж', 'marketing', 'sales']
const CRM_POSITIONS = ['маркетолог', 'marketer']

export function canAccessCrm(p: {
  role?: string | null
  position?: string | null
  department?: string | null
}): boolean {
  if (p.role === 'admin') return true
  if (CRM_POSITIONS.includes(p.position?.trim().toLowerCase() ?? '')) return true
  const dept = p.department?.trim().toLowerCase()
  return !!dept && CRM_DEPARTMENTS.includes(dept)
}
