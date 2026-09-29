'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createArticle, updateArticle } from '@/app/(dashboard)/articles/actions'
import { CATEGORIES, AI_PROMPT, Markdown, Spinner } from './article-ui'
import type { Article, ArticleCategory } from '@/types'

type Props = {
  article?: Article | null
  isAdmin: boolean
  departments: string[]
  onClose: () => void
  onSaved: (id?: string) => void
}

export default function ArticleEditor({ article, isAdmin, departments, onClose, onSaved }: Props) {
  const editing = !!article
  const [title, setTitle] = useState(article?.title ?? '')
  const [summary, setSummary] = useState(article?.summary ?? '')
  const [content, setContent] = useState(article?.content ?? '')
  const [category, setCategory] = useState<ArticleCategory>(article?.category ?? 'taskhub')
  const [isRequired, setIsRequired] = useState(article?.is_required ?? false)
  const [chosenDepts, setChosenDepts] = useState<string[]>(article?.departments ?? [])
  const [bumpVersion, setBumpVersion] = useState(false)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [promptCopied, setPromptCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT)
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2500)
    } catch {
      setError('Не удалось скопировать — выделите текст промпта вручную')
    }
  }

  async function handleSave() {
    setError(null)
    if (!title.trim()) { setError('Напишите заголовок'); return }
    if (!content.trim()) { setError('Инструкция пустая'); return }

    setSaving(true)
    try {
      if (editing && article) {
        await updateArticle(article.id, {
          title, summary, content, category,
          is_required: isRequired,
          departments: chosenDepts,
          bump_version: bumpVersion,
        })
        onSaved(article.id)
      } else {
        const id = await createArticle({ title, summary, content, category })
        onSaved(id)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9995, background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-4xl rounded-2xl flex flex-col" style={{
        height: '92vh', background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {editing ? 'Редактирование инструкции' : 'Новая инструкция'}
          </span>
          <button onClick={onClose} style={{ color: 'var(--text2)', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Текст обычно пишут в своём ИИ и вставляют сюда — даём готовый промпт */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(124,92,246,0.07)', border: '1px solid rgba(124,92,246,0.2)' }}>
            <div className="flex-1">
              <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--text)' }}>Пишете через ИИ?</div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
                Скопируйте промпт, вставьте в Claude или другой ИИ, опишите процесс своими словами —
                и вставьте готовый текст в поле ниже.
              </div>
            </div>
            <button type="button" onClick={copyPrompt}
              className="px-3 py-1.5 rounded-lg text-xs shrink-0"
              style={{
                background: promptCopied ? 'rgba(45,212,160,0.15)' : 'var(--surface2)',
                border: '1px solid var(--border)',
                color: promptCopied ? '#2DD4A0' : 'var(--text)', cursor: 'pointer',
              }}>
              {promptCopied ? 'Скопировано' : 'Скопировать промпт'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Заголовок">
              <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                placeholder="Как поставить задачу в проекте"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            </Field>
            <Field label="Раздел">
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map(c => (
                  <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                    className="px-2.5 py-1.5 rounded-lg text-xs"
                    style={{
                      background: category === c.value ? 'rgba(124,92,246,0.15)' : 'var(--surface2)',
                      color: category === c.value ? '#7C5CF6' : 'var(--text2)',
                      border: '1px solid var(--border)', cursor: 'pointer',
                    }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="О чём инструкция — одной строкой">
            <input value={summary} onChange={e => setSummary(e.target.value)}
              placeholder="Кому ставить, как выбрать исполнителя и срок"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          </Field>

          <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
            {(['write', 'preview'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className="px-3 py-2 text-sm"
                style={{
                  color: tab === t ? '#7C5CF6' : 'var(--text2)',
                  borderBottom: tab === t ? '2px solid #7C5CF6' : '2px solid transparent',
                  cursor: 'pointer',
                }}>
                {t === 'write' ? 'Текст' : 'Предпросмотр'}
              </button>
            ))}
          </div>

          {tab === 'write' ? (
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={'## Заголовок раздела\n\nАбзац текста.\n\n1. Первый шаг\n2. Второй шаг\n\n**Важно:** предупреждение.'}
              className="w-full px-3 py-3 rounded-lg text-sm outline-none resize-none"
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
                minHeight: 320, fontFamily: 'var(--font-mono)', lineHeight: 1.6,
              }} />
          ) : (
            <div className="px-4 py-3 rounded-lg" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', minHeight: 320 }}>
              {content.trim() ? <Markdown>{content}</Markdown>
                : <span className="text-sm" style={{ color: 'var(--text2)' }}>Пока пусто — напишите текст на вкладке «Текст»</span>}
            </div>
          )}

          {isAdmin && (
            <div className="flex flex-col gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <label className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text)', cursor: 'pointer' }}>
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} style={{ cursor: 'pointer' }} />
                Обязательна к прочтению — у людей будет висеть напоминание, пока не откроют
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs" style={{ color: 'var(--text2)' }}>Кому показывать (ничего не выбрано — всем)</span>
                <div className="flex gap-1.5 flex-wrap">
                  {departments.map(d => {
                    const on = chosenDepts.includes(d)
                    return (
                      <button key={d} type="button"
                        onClick={() => setChosenDepts(prev => on ? prev.filter(x => x !== d) : [...prev, d])}
                        className="px-2.5 py-1 rounded-lg text-xs"
                        style={{
                          background: on ? 'rgba(124,92,246,0.15)' : 'transparent',
                          color: on ? '#7C5CF6' : 'var(--text2)',
                          border: '1px solid var(--border)', cursor: 'pointer',
                        }}>
                        {d}
                      </button>
                    )
                  })}
                </div>
              </div>

              {editing && article?.status === 'published' && (
                <label className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={bumpVersion} onChange={e => setBumpVersion(e.target.checked)} style={{ cursor: 'pointer' }} />
                  Существенная правка — попросить всех перечитать заново
                </label>
              )}
            </div>
          )}

          {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
        </div>

        <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
            {saving && <Spinner />}
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>{label}</label>
      {children}
    </div>
  )
}
