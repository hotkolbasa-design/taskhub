'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  markArticleRead, publishArticle, submitArticle, unpublishArticle,
  deleteArticle, fetchArticleReaders,
} from '@/app/(dashboard)/articles/actions'
import ArticleEditor from './article-editor'
import { CATEGORY_LABEL, StatusBadge, RequiredBadge, Markdown, Spinner } from './article-ui'
import type { Article, ArticleReader } from '@/types'
import { t, INTL_LOCALE } from '@/lib/i18n'

export default function ArticleView({ article, isAdmin, currentUserId, departments }: {
  article: Article
  isAdmin: boolean
  currentUserId: string
  departments: string[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [readers, setReaders] = useState<ArticleReader[] | null>(null)

  const isAuthor = article.author_id === currentUserId
  const canEdit = isAdmin || (isAuthor && article.status !== 'published')

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setError(null)
    try { await fn(); router.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : t('Не получилось')) }
    setBusy(null)
  }

  async function showReaders() {
    setBusy('readers')
    try {
      const { readers } = await fetchArticleReaders(article.id)
      setReaders(readers)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Не удалось получить список'))
    }
    setBusy(null)
  }

  const notRead = readers?.filter(r => !r.read_at) ?? []
  const didRead = readers?.filter(r => r.read_at) ?? []

  return (
    <div className="p-6 flex flex-col gap-5 h-full overflow-auto">
      <button onClick={() => router.push('/articles')} className="text-sm self-start flex items-center gap-1.5"
        style={{ color: 'var(--text2)', cursor: 'pointer' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {t('Все инструкции')}
      </button>

      <div className="flex flex-col gap-3" style={{ maxWidth: 760 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text2)', background: 'var(--surface2)' }}>
            {CATEGORY_LABEL[article.category] ?? article.category}
          </span>
          {article.status !== 'published' && <StatusBadge status={article.status} />}
          {article.is_required && <RequiredBadge />}
          {article.version > 1 && (
            <span className="text-xs" style={{ color: 'var(--text2)' }}>{t('версия {n}', { n: article.version })}</span>
          )}
        </div>

        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{article.title}</h1>
        {article.summary && <p className="text-sm" style={{ color: 'var(--text2)' }}>{article.summary}</p>}

        <div className="text-xs" style={{ color: 'var(--text2)' }}>
          {article.author?.full_name || article.author?.login || t('Неизвестно')}
          {article.published_at && t(' · опубликовано {d}', { d: new Date(article.published_at).toLocaleDateString(INTL_LOCALE) })}
        </div>
      </div>

      <div style={{ maxWidth: 760 }}>
        <Markdown>{article.content}</Markdown>
      </div>

      {article.attachments.length > 0 && (
        <div className="flex flex-col gap-1.5" style={{ maxWidth: 760 }}>
          <span className="text-xs font-medium" style={{ color: 'var(--text2)' }}>{t('Файлы')}</span>
          {article.attachments.map(a => (
            <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="text-sm" style={{ color: 'var(--accent)' }}>
              {a.name}
            </a>
          ))}
        </div>
      )}

      {/* Отметка об ознакомлении — привязана к версии: после правки её спросят снова */}
      {article.status === 'published' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{
          maxWidth: 760,
          background: article.is_read ? 'rgba(45,212,160,0.08)' : 'var(--surface)',
          border: `1px solid ${article.is_read ? 'rgba(45,212,160,0.3)' : 'var(--border)'}`,
        }}>
          {article.is_read ? (
            <span className="text-sm" style={{ color: '#2DD4A0' }}>{t('✓ Вы ознакомились с этой инструкцией')}</span>
          ) : (
            <>
              <span className="text-sm" style={{ color: 'var(--text)' }}>{t('Прочитали? Отметьте — это видно руководителю.')}</span>
              <button onClick={() => run('read', () => markArticleRead(article.id))} disabled={busy === 'read'}
                className="ml-auto px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
                style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                {busy === 'read' && <Spinner />} {t('Ознакомился')}
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap" style={{ maxWidth: 760 }}>
        {canEdit && (
          <ActionButton onClick={() => setEditorOpen(true)}>{t('Редактировать')}</ActionButton>
        )}
        {isAuthor && article.status === 'draft' && (
          <ActionButton busy={busy === 'submit'} onClick={() => run('submit', () => submitArticle(article.id))}>
            {t('Отправить на проверку')}
          </ActionButton>
        )}
        {isAdmin && article.status !== 'published' && (
          <ActionButton accent busy={busy === 'publish'} onClick={() => run('publish', () => publishArticle(article.id))}>
            {t('Опубликовать')}
          </ActionButton>
        )}
        {isAdmin && article.status === 'published' && (
          <>
            <ActionButton busy={busy === 'unpublish'} onClick={() => run('unpublish', () => unpublishArticle(article.id))}>
              {t('Снять с публикации')}
            </ActionButton>
            {article.is_required && (
              <ActionButton busy={busy === 'readers'} onClick={showReaders}>{t('Кто прочитал')}</ActionButton>
            )}
          </>
        )}
        {(isAdmin || (isAuthor && article.status === 'draft')) && (
          <ActionButton danger busy={busy === 'delete'}
            onClick={() => run('delete', async () => { await deleteArticle(article.id); router.push('/articles') })}>
            {t('Удалить')}
          </ActionButton>
        )}
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}

      {readers && (
        <div className="flex flex-col gap-3 px-4 py-4 rounded-xl" style={{ maxWidth: 760, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {t('Ознакомились: {read} из {total}', { read: didRead.length, total: readers.length })}
            </span>
            <button onClick={() => setReaders(null)} className="text-xs" style={{ color: 'var(--text2)', cursor: 'pointer' }}>
              {t('Скрыть')}
            </button>
          </div>
          {notRead.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: 'var(--red)' }}>{t('Ещё не прочитали')}</span>
              {notRead.map(r => (
                <span key={r.user_id} className="text-sm" style={{ color: 'var(--text)' }}>
                  {r.full_name || r.login}{r.department ? ` · ${r.department}` : ''}
                </span>
              ))}
            </div>
          )}
          {didRead.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs" style={{ color: '#2DD4A0' }}>{t('Прочитали')}</span>
              {didRead.map(r => (
                <span key={r.user_id} className="text-sm" style={{ color: 'var(--text2)' }}>
                  {r.full_name || r.login} · {new Date(r.read_at!).toLocaleDateString(INTL_LOCALE)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {editorOpen && (
        <ArticleEditor
          article={article}
          isAdmin={isAdmin}
          departments={departments}
          onClose={() => setEditorOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  )
}

function ActionButton({ children, onClick, busy, accent, danger }: {
  children: React.ReactNode
  onClick: () => void
  busy?: boolean
  accent?: boolean
  danger?: boolean
}) {
  const color = danger ? 'var(--red)' : accent ? '#fff' : 'var(--text2)'
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className="px-3 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
      style={{
        background: accent ? 'var(--accent)' : 'var(--surface2)',
        border: accent ? 'none' : '1px solid var(--border)',
        color, cursor: 'pointer',
      }}>
      {busy && <Spinner />}
      {children}
    </button>
  )
}
