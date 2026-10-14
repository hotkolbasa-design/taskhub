'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { decideSuggestion } from '@/app/(dashboard)/predlozheniya/actions'
import { STATUS_LABEL, type Suggestion, type SuggestionStatus } from '@/lib/podskazchik/predlozheniya-types'

const TABS: { key: SuggestionStatus | 'all'; label: string }[] = [
  { key: 'new', label: 'Новые' },
  { key: 'approved', label: 'Одобрено' },
  { key: 'applied', label: 'Внесено' },
  { key: 'rejected', label: 'Отказано' },
  { key: 'all', label: 'Все' },
]

const STATUS_COLOR: Record<SuggestionStatus, string> = {
  new: 'var(--yellow)', approved: 'var(--green)', applied: 'var(--accent)', rejected: 'var(--red)',
}

const time = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function PredlozheniyaClient({ items: initial, canDecide }: { items: Suggestion[]; canDecide: boolean }) {
  const [items, setItems] = useState(initial)
  const [tab, setTab] = useState<SuggestionStatus | 'all'>('new')
  const [error, setError] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length }
    for (const s of items) c[s.status] = (c[s.status] ?? 0) + 1
    return c
  }, [items])
  const visible = useMemo(() => items.filter(s => tab === 'all' || s.status === tab), [items, tab])

  // Оптимистично: карточка меняет статус сразу, при ошибке — откат
  async function decide(s: Suggestion, status: SuggestionStatus, decision: string) {
    const prev = items
    setError(null)
    setItems(list => list.map(x => x.id === s.id ? { ...x, status, decision, decided_at: new Date().toISOString() } : x))
    try {
      await decideSuggestion(s.id, status, decision)
    } catch (e) {
      setItems(prev)
      setError(e instanceof Error ? e.message : 'Не удалось сохранить решение')
    }
  }

  return (
    <div className="p-6 flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Предложения по скрипту</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>
            Хантеры выделяют фразу в подсказчике и предлагают, как сказать лучше
          </p>
        </div>
        <a href="/podskazchik" target="_blank" rel="noopener"
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', border: '1px solid var(--border)' }}>
          Открыть подсказчик
        </a>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{
              cursor: 'pointer',
              background: tab === t.key ? 'rgba(79,142,247,0.15)' : 'transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--text2)',
            }}>
            {t.label}{counts[t.key] ? <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)' }}>{counts[t.key]}</span> : null}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(247,92,110,0.08)', border: '1px solid rgba(247,92,110,0.25)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {visible.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text2)' }}>
          {tab === 'new' ? 'Новых предложений нет.' : 'Здесь пока пусто.'}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {visible.map(s => <Card key={s.id} s={s} canDecide={canDecide} onDecide={decide} />)}
      </div>
    </div>
  )
}

function Card({ s, canDecide, onDecide }: {
  s: Suggestion
  canDecide: boolean
  onDecide: (s: Suggestion, status: SuggestionStatus, decision: string) => Promise<void>
}) {
  const [decision, setDecision] = useState(s.decision)
  const [busy, setBusy] = useState<SuggestionStatus | null>(null)

  async function act(status: SuggestionStatus) {
    setBusy(status)
    await onDecide(s, status, decision)
    setBusy(null)
  }

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: 'var(--text2)' }}>
        <span className="px-2 py-0.5 rounded-md font-semibold"
          style={{ color: STATUS_COLOR[s.status], background: 'var(--surface2)' }}>
          {STATUS_LABEL[s.status]}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>№{s.id}</span>
        <span>{s.author_name}</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{time(s.created_at)}</span>
        <span>{s.gde}{s.pole ? ` · ${s.pole}` : ''}</span>
      </div>

      {s.frag && (
        <div className="text-sm" style={{ color: 'var(--text2)' }}>
          <span className="text-xs uppercase tracking-wide mr-2">Было</span>{s.frag}
        </div>
      )}
      <div className="text-sm" style={{ color: 'var(--text)' }}>
        <span className="text-xs uppercase tracking-wide mr-2" style={{ color: 'var(--green)' }}>Предложено</span><span style={{ whiteSpace: 'pre-line' }}>{s.variant}</span>
      </div>
      {s.plan && (
        <div className="text-sm rounded-lg px-3 py-2"
          style={{ background: 'rgba(247,192,79,0.08)', border: '1px solid rgba(247,192,79,0.3)', color: 'var(--text)', whiteSpace: 'pre-line' }}>
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--yellow)' }}>Как внести — предлагает Claude</div>
          {s.plan}
        </div>
      )}
      {s.comment && (
        <div className="text-sm" style={{ color: 'var(--text2)' }}>
          <span className="text-xs uppercase tracking-wide mr-2">Почему</span>{s.comment}
        </div>
      )}

      {canDecide ? (
        <div className="flex flex-col gap-2">
          <textarea value={decision} onChange={e => setDecision(e.target.value)} rows={2}
            placeholder="Решение для хантера — одно предложение: почему одобрено или отказано"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          <div className="flex gap-2 flex-wrap">
            <ActBtn color="var(--green)" busy={busy === 'approved'} disabled={!!busy} onClick={() => act('approved')}>Одобрить</ActBtn>
            <ActBtn color="var(--red)" busy={busy === 'rejected'} disabled={!!busy} onClick={() => act('rejected')}>Отказать</ActBtn>
            <ActBtn color="var(--accent)" busy={busy === 'applied'} disabled={!!busy} onClick={() => act('applied')}>Внесено в скрипт</ActBtn>
            {s.status !== 'new' && (
              <ActBtn color="var(--text2)" busy={busy === 'new'} disabled={!!busy} onClick={() => act('new')}>Вернуть в новые</ActBtn>
            )}
          </div>
        </div>
      ) : s.decision ? (
        <div className="text-sm" style={{ color: 'var(--text)' }}>
          <span className="text-xs uppercase tracking-wide mr-2" style={{ color: 'var(--text2)' }}>Решение</span>{s.decision}
        </div>
      ) : null}
    </div>
  )
}

function ActBtn({ color, busy, disabled, onClick, children }: {
  color: string; busy: boolean; disabled: boolean; onClick: () => void; children: ReactNode
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
      style={{ border: `1px solid ${color}`, color, cursor: disabled ? 'default' : 'pointer', opacity: disabled && !busy ? 0.5 : 1 }}>
      {busy && <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
      {children}
    </button>
  )
}

