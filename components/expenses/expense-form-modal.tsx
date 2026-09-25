'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createExpenseRequest, updateExpenseRequest, uploadExpenseAttachment } from '@/app/(dashboard)/expenses/actions'
import { CATEGORIES, Dropdown, DatePicker, Spinner, money } from './expense-ui'
import type { ExpenseAttachment, ExpenseCategory, ExpenseRequest } from '@/types'

type Props = {
  request?: ExpenseRequest | null
  onClose: () => void
  onSaved: () => void
}

export default function ExpenseFormModal({ request, onClose, onSaved }: Props) {
  const editing = !!request
  const [title, setTitle] = useState(request?.title ?? '')
  const [justification, setJustification] = useState(request?.justification ?? '')
  const [category, setCategory] = useState<ExpenseCategory>(request?.category ?? 'equipment')
  const [amount, setAmount] = useState(request ? String(request.amount) : '')
  const [neededBy, setNeededBy] = useState(request?.needed_by ?? '')
  const [attachments, setAttachments] = useState<ExpenseAttachment[]>(request?.attachments ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const amountNumber = Number(amount.replace(/\s/g, '').replace(',', '.')) || 0

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const uploaded = await uploadExpenseAttachment(fd)
        setAttachments(prev => [...prev, uploaded])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить файл')
    }
    setUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) { setError('Напишите, что нужно купить'); return }
    if (amountNumber <= 0) { setError('Укажите примерную сумму'); return }

    setSaving(true)
    try {
      const payload = {
        title,
        justification,
        category,
        amount: amountNumber,
        needed_by: neededBy || null,
        attachments,
      }
      if (editing && request) await updateExpenseRequest(request.id, payload)
      else await createExpenseRequest(payload)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить заявку')
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9995, background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {editing ? `Заявка ${request?.number}` : 'Новая заявка на расход'}
          </span>
          <button onClick={onClose} style={{ color: 'var(--text2)', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          <Field label="Что нужно купить">
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
              placeholder="5 ноутбуков для отдела продаж"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </Field>

          <Field label="Зачем это нужно">
            <textarea value={justification} onChange={e => setJustification(e.target.value)} rows={3}
              placeholder="Текущие машины не тянут CRM, менеджеры теряют время на загрузку"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Категория">
              <Dropdown value={category} options={CATEGORIES} onChange={setCategory} />
            </Field>
            <Field label="Сумма, ₸">
              <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal"
                placeholder="2 000 000"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              {amountNumber > 0 && (
                <span className="text-xs" style={{ color: 'var(--text2)' }}>{money(amountNumber)}</span>
              )}
            </Field>
          </div>

          <Field label="К какой дате нужно">
            <DatePicker value={neededBy} onChange={setNeededBy} />
          </Field>

          <Field label="Счета, коммерческие предложения">
            <div className="flex flex-col gap-2">
              {attachments.map((a, i) => (
                <div key={a.url} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <a href={a.url} target="_blank" rel="noreferrer" className="flex-1 truncate"
                    style={{ color: 'var(--accent)' }}>{a.name}</a>
                  <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ color: 'var(--text2)', cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
              <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface2)', border: '1px dashed var(--border)', color: 'var(--text2)', cursor: uploading ? 'default' : 'pointer' }}>
                {uploading ? <Spinner /> : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                )}
                {uploading ? 'Загрузка…' : 'Прикрепить файл'}
                <input type="file" multiple className="hidden" disabled={uploading}
                  onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
              </label>
            </div>
          </Field>

          {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
        </form>

        <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSubmit} disabled={saving || uploading}
            className="flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
            {saving && <Spinner />}
            {saving ? 'Сохранение…' : editing ? 'Сохранить' : 'Отправить на рассмотрение'}
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
