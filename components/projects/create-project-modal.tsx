'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProject } from '@/app/(dashboard)/projects/actions'

const COLORS = [
  '#4F8EF7', '#2DD4A0', '#F75C6E', '#F7C04F',
  '#9B8EF7', '#F78E4F', '#4FC4F7', '#F74FA0',
]

export default function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      await createProject({ name, description, color })
      router.refresh()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-lg font-semibold mb-5" style={{ color: 'var(--text)' }}>
          Новый проект
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Название */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
              Название *
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Разработка сайта"
              className="px-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Описание */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
              Описание
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Кратко о проекте..."
              rows={3}
              className="px-3 py-2.5 rounded-lg text-sm outline-none transition-colors resize-none"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Цвет */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
              Цвет
            </label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{
                    background: c,
                    transform: color === c ? 'scale(1.25)' : 'scale(1)',
                    boxShadow: color === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>
          )}

          {/* Кнопки */}
          <div className="flex gap-3 justify-end mt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm transition-colors"
              style={{ color: 'var(--text2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loading && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              )}
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
