// Типы и подписи статусов предложений — отдельно от серверного кода, чтобы их мог импортировать клиент.
export type SuggestionStatus = 'new' | 'approved' | 'rejected' | 'applied'

export type Suggestion = {
  id: number
  created_at: string
  author_id: string | null
  author_name: string
  gde: string
  pole: string
  lang: 'ru' | 'kz'
  frag: string
  variant: string
  comment: string
  status: SuggestionStatus
  decision: string
  decided_by: string | null
  decided_at: string | null
}

export const STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: 'новое', approved: 'одобрено', rejected: 'отказано', applied: 'внесено',
}
