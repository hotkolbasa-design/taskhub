'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  decideExpenseRequest, cancelExpenseRequest, markExpensePaid, undoExpensePaid,
  fetchExpenseFeed, createExpenseComment,
} from '@/app/(dashboard)/expenses/actions'
import { CATEGORY_LABEL, StatusBadge, Spinner, money, formatDate, personName } from './expense-ui'
import type { ExpenseRequest, ExpenseComment, ExpenseActivity } from '@/types'

type FeedItem =
  | { kind: 'comment'; at: string; data: ExpenseComment }
  | { kind: 'activity'; at: string; data: ExpenseActivity }

const ACTIVITY_TEXT: Record<string, string> = {
  created: 'подал заявку',
  status_changed: 'изменил статус',
  edited: 'отредактировал заявку',
  paid: 'отметил оплату',
  payment_undone: 'снял отметку об оплате',
}

const STATUS_WORD: Record<string, string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрено',
  rejected: 'Отклонено',
  needs_info: 'На доработку',
  cancelled: 'Отозвано',
}

export default function ExpenseDrawer({ request, canApprove, currentUserId, refreshing, onClose, onChanged, onEdit }: {
  request: ExpenseRequest
  canApprove: boolean
  currentUserId: string
  refreshing: boolean
  onClose: () => void
  onChanged: () => void
  onEdit: () => void
}) {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [paidAmount, setPaidAmount] = useState(String(request.amount))

  const isOwner = request.requester_id === currentUserId
  const decided = request.status === 'approved' || request.status === 'rejected'
  const canEdit = isOwner && (request.status === 'pending' || request.status === 'needs_info')

  // Спиннер только на первом заходе (loadingFeed уже true): при обновлении
  // после действия лента остаётся на экране и тихо перерисовывается, а не мигает пустотой
  const loadFeed = useCallback(async () => {
    try {
      const { comments, activities } = await fetchExpenseFeed(request.id)
      const items: FeedItem[] = [
        ...comments.map(c => ({ kind: 'comment' as const, at: c.created_at, data: c })),
        ...activities.map(a => ({ kind: 'activity' as const, at: a.created_at, data: a })),
      ].sort((a, b) => a.at.localeCompare(b.at))
      setFeed(items)
    } catch {
      setFeed([])
    }
    setLoadingFeed(false)
  }, [request.id])

  // Лента подтягивается при открытии карточки — это и есть синхронизация с внешними данными
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadFeed() }, [loadFeed])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await loadFeed()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не получилось')
    }
    setBusy(null)
  }

  async function sendComment() {
    if (!comment.trim()) return
    setSending(true)
    try {
      await createExpenseComment(request.id, comment, [])
      setComment('')
      await loadFeed()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Комментарий не отправился')
    }
    setSending(false)
  }

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9990 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute right-0 top-0 h-full flex flex-col"
        style={{ width: 460, maxWidth: '100vw', background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-16px 0 48px rgba(0,0,0,0.4)' }}>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{request.number}</span>
            <StatusBadge request={request} />
          </div>
          <button onClick={onClose} style={{ color: 'var(--text2)', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {refreshing && (
          <div className="flex items-center gap-2 px-5 py-2 text-xs"
            style={{ background: 'rgba(124,92,246,0.08)', color: 'var(--text2)' }}>
            <Spinner size={12} /> Обновляем данные…
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text)' }}>{request.title}</h2>
            <div className="text-2xl font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
              {money(request.amount, request.currency)}
            </div>
            {request.paid_at && request.paid_amount !== null && request.paid_amount !== request.amount && (
              <div className="text-sm mt-1" style={{ color: 'var(--text2)' }}>
                оплачено по факту: <span style={{ color: '#7C5CF6' }}>{money(request.paid_amount, request.currency)}</span>
              </div>
            )}
          </div>

          {request.justification && (
            <Block label="Зачем">
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{request.justification}</p>
            </Block>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Info label="Автор" value={personName(request.requester)} />
            <Info label="Отдел" value={request.department || '—'} />
            <Info label="Категория" value={CATEGORY_LABEL[request.category] ?? request.category} />
            <Info label="Нужно к" value={formatDate(request.needed_by)} />
            <Info label="Подана" value={formatDate(request.created_at)} />
            {decided && <Info label="Решение" value={`${personName(request.decider)}, ${formatDate(request.decided_at)}`} />}
          </div>

          {request.decision_note && (
            <Block label="Комментарий к решению">
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{request.decision_note}</p>
            </Block>
          )}

          {request.paid_at && (
            <Block label="Оплата">
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                {money(request.paid_amount ?? request.amount, request.currency)} · {personName(request.payer)} · {formatDate(request.paid_at)}
              </p>
              {request.paid_note && <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>{request.paid_note}</p>}
            </Block>
          )}

          {request.attachments.length > 0 && (
            <Block label="Файлы">
              <div className="flex flex-col gap-1.5">
                {request.attachments.map(a => (
                  <a key={a.url} href={a.url} target="_blank" rel="noreferrer"
                    className="text-sm truncate" style={{ color: 'var(--accent)' }}>{a.name}</a>
                ))}
              </div>
            </Block>
          )}

          {/* Решение — принимает любой из утверждающих в одиночку */}
          {canApprove && (request.status === 'pending' || request.status === 'needs_info') && (
            <Block label="Решение">
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Комментарий (необязательно)"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y mb-2"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              <div className="flex gap-2">
                <ActionButton busy={busy === 'approve'} color="#2DD4A0"
                  onClick={() => run('approve', () => decideExpenseRequest(request.id, 'approved', note))}>
                  Одобрить
                </ActionButton>
                <ActionButton busy={busy === 'reject'} color="#F75C6E"
                  onClick={() => run('reject', () => decideExpenseRequest(request.id, 'rejected', note))}>
                  Отклонить
                </ActionButton>
                <ActionButton busy={busy === 'info'} color="#4F8EF7" outline
                  onClick={() => run('info', () => decideExpenseRequest(request.id, 'needs_info', note))}>
                  На доработку
                </ActionButton>
              </div>
            </Block>
          )}

          {canApprove && request.status === 'approved' && !request.paid_at && (
            <Block label="Оплата">
              {payOpen ? (
                <div className="flex flex-col gap-2">
                  <input value={paidAmount} onChange={e => setPaidAmount(e.target.value)} inputMode="decimal"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }} />
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                    placeholder="Чем платили, у кого купили"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  <div className="flex gap-2">
                    <ActionButton busy={busy === 'pay'} color="#7C5CF6"
                      onClick={() => run('pay', async () => {
                        await markExpensePaid(request.id, Number(paidAmount.replace(/\s/g, '').replace(',', '.')) || request.amount, note)
                        setPayOpen(false)
                      })}>
                      Подтвердить оплату
                    </ActionButton>
                    <ActionButton onClick={() => setPayOpen(false)} color="var(--text2)" outline>Отмена</ActionButton>
                  </div>
                </div>
              ) : (
                <ActionButton color="#7C5CF6" outline onClick={() => { setPaidAmount(String(request.amount)); setNote(''); setPayOpen(true) }}>
                  Отметить оплаченной
                </ActionButton>
              )}
            </Block>
          )}

          {canApprove && request.paid_at && (
            <button onClick={() => run('undo', () => undoExpensePaid(request.id))}
              className="text-xs text-left self-start" style={{ color: 'var(--text2)', cursor: 'pointer' }}>
              {busy === 'undo' ? 'Отмена…' : 'Снять отметку об оплате'}
            </button>
          )}

          <div className="flex gap-2">
            {canEdit && (
              <ActionButton color="var(--text2)" outline onClick={onEdit}>Редактировать</ActionButton>
            )}
            {canEdit && (
              <ActionButton busy={busy === 'cancel'} color="var(--text2)" outline
                onClick={() => run('cancel', () => cancelExpenseRequest(request.id))}>
                Отозвать
              </ActionButton>
            )}
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}

          <Block label="Обсуждение">
            {loadingFeed && feed.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm" style={{ color: 'var(--text2)' }}>
                <Spinner size={16} /> Загружаем обсуждение…
              </div>
            ) : feed.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text2)' }}>Пока пусто</p>
            ) : (
              <div className="flex flex-col gap-3">
                {feed.map(item => item.kind === 'comment' ? (
                  <div key={item.data.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{personName(item.data.author)}</span>
                      <span className="text-xs" style={{ color: 'var(--text2)' }}>{formatDate(item.data.created_at)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{item.data.text}</p>
                  </div>
                ) : (
                  <div key={item.data.id} className="text-xs" style={{ color: 'var(--text2)' }}>
                    {personName(item.data.actor)} {ACTIVITY_TEXT[item.data.type] ?? item.data.type}
                    {item.data.type === 'status_changed' && item.data.new_value && (
                      <> → <span style={{ color: 'var(--text)' }}>{STATUS_WORD[item.data.new_value] ?? item.data.new_value}</span></>
                    )}
                    {item.data.type === 'edited' && item.data.old_value && item.data.new_value && (
                      <>: сумма {money(Number(item.data.old_value))} → {money(Number(item.data.new_value))}</>
                    )}
                    {' · '}{formatDate(item.data.created_at)}
                  </div>
                ))}
              </div>
            )}
          </Block>
        </div>

        <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          <input value={comment} onChange={e => setComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
            placeholder="Написать комментарий…"
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button onClick={sendComment} disabled={sending || !comment.trim()}
            className="px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
            {sending ? <Spinner /> : 'Отправить'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ color: 'var(--text2)' }}>{label}</span>
      {children}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: 'var(--text2)' }}>{label}</span>
      <span className="text-sm" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

function ActionButton({ children, onClick, color, outline, busy, disabled }: {
  children: React.ReactNode
  onClick: () => void
  color: string
  outline?: boolean
  busy?: boolean
  disabled?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled}
      className="px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60"
      style={{
        background: outline ? 'transparent' : color,
        border: outline ? `1px solid ${color}` : 'none',
        color: outline ? color : '#fff',
        cursor: 'pointer',
      }}>
      {busy && <Spinner />}
      {children}
    </button>
  )
}
