'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { decideExpenseRequests } from '@/app/(dashboard)/expenses/actions'
import ExpenseFormModal from './expense-form-modal'
import ExpenseDrawer from './expense-drawer'
import { CATEGORY_LABEL, StatusBadge, Spinner, money, formatDate, personName } from './expense-ui'
import type { ExpenseRequest } from '@/types'

type Tab = 'pending' | 'to_pay' | 'history' | 'all'

const TABS: { value: Tab; label: string }[] = [
  { value: 'pending', label: 'На рассмотрении' },
  { value: 'to_pay',  label: 'Ждут оплаты' },
  { value: 'history', label: 'История' },
  { value: 'all',     label: 'Все' },
]

function matchesTab(r: ExpenseRequest, tab: Tab): boolean {
  if (tab === 'all') return true
  if (tab === 'pending') return r.status === 'pending' || r.status === 'needs_info'
  if (tab === 'to_pay') return r.status === 'approved' && !r.paid_at
  return r.status === 'rejected' || r.status === 'cancelled' || (r.status === 'approved' && !!r.paid_at)
}

export default function ExpensesClient({ requests, currentUserId, canApprove }: {
  requests: ExpenseRequest[]
  currentUserId: string
  canApprove: boolean
  department: string | null
}) {
  const router = useRouter()
  // Обновление данных после действия — через transition: пока оно идёт, карточка
  // показывает индикатор, иначе экран несколько секунд выглядит так, будто ничего не произошло
  const [refreshing, startRefresh] = useTransition()
  const [tab, setTab] = useState<Tab>('pending')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseRequest | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState<'approved' | 'rejected' | null>(null)

  const visible = useMemo(
    () => requests.filter(r => matchesTab(r, tab)),
    [requests, tab],
  )

  const counts = useMemo(() => ({
    pending: requests.filter(r => matchesTab(r, 'pending')).length,
    to_pay: requests.filter(r => matchesTab(r, 'to_pay')).length,
    history: requests.filter(r => matchesTab(r, 'history')).length,
    all: requests.length,
  }), [requests])

  const totalSum = visible.reduce((s, r) => s + (r.paid_at ? (r.paid_amount ?? r.amount) : r.amount), 0)
  const openRequest = openId ? requests.find(r => r.id === openId) ?? null : null

  // Массовое решение — под еженедельный разбор накопившегося
  const selectable = tab === 'pending' && canApprove
  const allSelected = selectable && visible.length > 0 && visible.every(r => selected.has(r.id))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function bulkDecide(status: 'approved' | 'rejected') {
    if (selected.size === 0) return
    setBulkBusy(status)
    try {
      await decideExpenseRequests([...selected], status, '')
      setSelected(new Set())
      refresh()
    } finally {
      setBulkBusy(null)
    }
  }

  function refresh() {
    startRefresh(() => router.refresh())
  }

  return (
    <div className="p-6 flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Расходы</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>
            {canApprove ? 'Заявки всех отделов' : 'Ваши заявки на покупки'}
          </p>
        </div>
        <button onClick={() => { setEditing(null); setFormOpen(true) }}
          className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Новая заявка
        </button>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.value} onClick={() => { setTab(t.value); setSelected(new Set()) }}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: tab === t.value ? 'rgba(124,92,246,0.15)' : 'transparent',
              color: tab === t.value ? '#7C5CF6' : 'var(--text2)',
              cursor: 'pointer',
            }}>
            {t.label}
            <span className="ml-1.5 text-xs" style={{ opacity: 0.7 }}>{counts[t.value]}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <span className="text-sm" style={{ color: 'var(--text2)' }}>
          {visible.length === 0 ? 'Заявок нет' : `Заявок: ${visible.length}`}
        </span>
        <span className="text-base font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
          {money(totalSum)}
        </span>
      </div>

      {selectable && selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(124,92,246,0.08)', border: '1px solid rgba(124,92,246,0.25)' }}>
          <span className="text-sm" style={{ color: 'var(--text)' }}>Выбрано: {selected.size}</span>
          <button onClick={() => bulkDecide('approved')} disabled={!!bulkBusy}
            className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
            style={{ background: '#2DD4A0', color: '#fff', cursor: 'pointer' }}>
            {bulkBusy === 'approved' && <Spinner />} Одобрить
          </button>
          <button onClick={() => bulkDecide('rejected')} disabled={!!bulkBusy}
            className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
            style={{ background: '#F75C6E', color: '#fff', cursor: 'pointer' }}>
            {bulkBusy === 'rejected' && <Spinner />} Отклонить
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm ml-auto"
            style={{ color: 'var(--text2)', cursor: 'pointer' }}>Снять выделение</button>
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--text2)' }}>
            Здесь пока пусто
          </div>
        ) : (
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {selectable && (
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allSelected} style={{ cursor: 'pointer' }}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map(r => r.id)))} />
                  </th>
                )}
                <Th>Номер</Th>
                <Th>Что покупаем</Th>
                {canApprove && <Th>Кто просит</Th>}
                <Th>Категория</Th>
                <Th right>Сумма</Th>
                <Th>Нужно к</Th>
                <Th>Статус</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.id} onClick={() => setOpenId(r.id)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {selectable && (
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} style={{ cursor: 'pointer' }} />
                    </td>
                  )}
                  <td className="px-4 py-3" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{r.number}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text)' }}>
                    {r.title}
                    {r.comment_count > 0 && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--text2)' }}>💬 {r.comment_count}</span>
                    )}
                  </td>
                  {canApprove && (
                    <td className="px-4 py-3" style={{ color: 'var(--text2)' }}>
                      {personName(r.requester)}
                      {r.department && <span className="block text-xs" style={{ opacity: 0.7 }}>{r.department}</span>}
                    </td>
                  )}
                  <td className="px-4 py-3" style={{ color: 'var(--text2)' }}>{CATEGORY_LABEL[r.category] ?? r.category}</td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                    {money(r.paid_at ? (r.paid_amount ?? r.amount) : r.amount, r.currency)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text2)', whiteSpace: 'nowrap' }}>{formatDate(r.needed_by)}</td>
                  <td className="px-4 py-3"><StatusBadge request={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <ExpenseFormModal
          request={editing}
          onClose={() => { setFormOpen(false); setEditing(null) }}
          onSaved={refresh}
        />
      )}

      {openRequest && (
        <ExpenseDrawer
          request={openRequest}
          canApprove={canApprove}
          currentUserId={currentUserId}
          refreshing={refreshing}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
          onEdit={() => { setEditing(openRequest); setOpenId(null); setFormOpen(true) }}
        />
      )}
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-3 text-xs font-medium ${right ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--text2)' }}>
      {children}
    </th>
  )
}
