'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ArticleEditor from './article-editor'
import { CATEGORIES, CATEGORY_LABEL, StatusBadge, RequiredBadge } from './article-ui'
import type { Article } from '@/types'

export default function ArticlesClient({ articles, isAdmin, departments }: {
  articles: Article[]
  isAdmin: boolean
  departments: string[]
  currentUserId: string
}) {
  const router = useRouter()
  const [, startRefresh] = useTransition()
  const [editorOpen, setEditorOpen] = useState(false)
  const [category, setCategory] = useState<string>('all')

  // Обязательные и ещё не прочитанные — наверх: их видно первым делом
  const mustRead = useMemo(
    () => articles.filter(a => a.status === 'published' && a.is_required && !a.is_read),
    [articles],
  )

  const visible = useMemo(
    () => articles.filter(a => category === 'all' || a.category === category),
    [articles, category],
  )

  const byCategory = useMemo(() => {
    const map = new Map<string, Article[]>()
    for (const a of visible) {
      const list = map.get(a.category) ?? []
      list.push(a)
      map.set(a.category, list)
    }
    return map
  }, [visible])

  return (
    <div className="p-6 flex flex-col gap-5 h-full">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Инструкции</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text2)' }}>
            Как всё устроено в компании и в TaskHub
          </p>
        </div>
        <button onClick={() => setEditorOpen(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Написать инструкцию
        </button>
      </div>

      {mustRead.length > 0 && (
        <div className="px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(247,92,110,0.08)', border: '1px solid rgba(247,92,110,0.25)' }}>
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            Нужно прочитать: <b>{mustRead.length}</b>
          </span>
          <span className="text-sm" style={{ color: 'var(--text2)' }}>
            {mustRead.slice(0, 2).map(a => a.title).join(' · ')}{mustRead.length > 2 ? ' …' : ''}
          </span>
          <button onClick={() => router.push(`/articles/${mustRead[0].id}`)}
            className="ml-auto px-3 py-1.5 rounded-lg text-sm"
            style={{ background: '#F75C6E', color: '#fff', cursor: 'pointer' }}>
            Открыть
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        <TabButton active={category === 'all'} onClick={() => setCategory('all')}>Все</TabButton>
        {CATEGORIES.map(c => (
          <TabButton key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
            {c.label}
          </TabButton>
        ))}
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <span className="text-sm" style={{ color: 'var(--text2)' }}>Здесь пока нет инструкций</span>
            <button onClick={() => setEditorOpen(true)} className="text-sm" style={{ color: 'var(--accent)', cursor: 'pointer' }}>
              Написать первую
            </button>
          </div>
        ) : (
          [...byCategory.entries()].map(([cat, list]) => (
            <div key={cat} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium" style={{ color: 'var(--text2)' }}>{CATEGORY_LABEL[cat] ?? cat}</h2>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {list.map(a => (
                  <button key={a.id} onClick={() => startRefresh(() => router.push(`/articles/${a.id}`))}
                    className="flex flex-col gap-2 px-4 py-3.5 rounded-xl text-left"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124,92,246,0.4)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{a.title}</span>
                      {a.status === 'published' && a.is_read && (
                        <span className="text-xs shrink-0" style={{ color: '#2DD4A0' }}>✓ прочитано</span>
                      )}
                    </div>
                    {a.summary && (
                      <span className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>{a.summary}</span>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {a.status !== 'published' && <StatusBadge status={a.status} />}
                      {a.is_required && <RequiredBadge />}
                      {a.departments.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text2)', background: 'var(--surface2)' }}>
                          {a.departments.join(', ')}
                        </span>
                      )}
                      {isAdmin && a.status === 'published' && a.is_required && (
                        <span className="text-xs" style={{ color: 'var(--text2)' }}>прочитали: {a.read_count}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {editorOpen && (
        <ArticleEditor
          isAdmin={isAdmin}
          departments={departments}
          onClose={() => setEditorOpen(false)}
          onSaved={(id) => { if (id) router.push(`/articles/${id}`); else router.refresh() }}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-lg text-sm"
      style={{
        background: active ? 'rgba(124,92,246,0.15)' : 'transparent',
        color: active ? '#7C5CF6' : 'var(--text2)', cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}
