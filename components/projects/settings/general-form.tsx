'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateProject } from '@/app/(dashboard)/projects/[id]/settings/actions'

const COLORS = [
  '#4F8EF7', '#2DD4A0', '#F75C6E', '#F7C04F',
  '#9B8EF7', '#F78E4F', '#4FC4F7', '#F74FA0',
]

type Member = { id: string; full_name: string | null; login: string }

const ASSIGNEE_MODES = [
  { value: 'manual', label: 'Вручную', desc: 'При создании задачи исполнитель не назначается' },
  { value: 'creator', label: 'Создатель задачи', desc: 'Исполнитель = тот кто создаёт задачу' },
  { value: 'specific', label: 'Конкретный человек', desc: 'Всегда назначать одного и того же' },
]

function UserDropdown({ value, onChange, members }: { value: string; onChange: (v: string) => void; members: Member[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = members.find(m => m.id === value)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left"
        style={{ background: 'var(--surface2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, color: selected ? 'var(--text)' : 'var(--text2)' }}
      >
        {selected ? (
          <>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>
              {(selected.full_name || selected.login)[0].toUpperCase()}
            </span>
            <span className="flex-1 truncate">{selected.full_name || selected.login}</span>
          </>
        ) : <span className="flex-1">Выбрать пользователя...</span>}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.5, flexShrink: 0 }}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 py-1 rounded-xl z-50 w-full"
          style={{ background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out' }}>
          {members.map(m => (
            <button key={m.id} type="button" onClick={() => { onChange(m.id); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left"
              style={{ color: m.id === value ? 'var(--accent)' : 'var(--text)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{ background: m.id === value ? 'var(--accent)' : 'var(--surface)', color: '#fff' }}>
                {(m.full_name || m.login)[0].toUpperCase()}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="truncate font-medium">{m.full_name || m.login}</span>
                {m.full_name && <span className="text-xs truncate" style={{ color: 'var(--text2)' }}>{m.login}</span>}
              </div>
              {m.id === value && (
                <svg className="ml-auto shrink-0" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Props = {
  projectId: string
  initialName: string
  initialDescription: string | null
  initialColor: string
  initialAssigneeMode: 'manual' | 'creator' | 'specific'
  initialAssigneeId: string | null
  members: Member[]
}

export default function GeneralForm({
  projectId, initialName, initialDescription, initialColor,
  initialAssigneeMode, initialAssigneeId, members,
}: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription ?? '')
  const [color, setColor] = useState(initialColor)
  const [assigneeMode, setAssigneeMode] = useState<'manual' | 'creator' | 'specific'>(initialAssigneeMode)
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId ?? '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const isDirty =
    name !== initialName ||
    description !== (initialDescription ?? '') ||
    color !== initialColor ||
    assigneeMode !== initialAssigneeMode ||
    assigneeId !== (initialAssigneeId ?? '')

  async function handleSave() {
    if (!name.trim()) return
    if (assigneeMode === 'specific' && !assigneeId) { setError('Выберите исполнителя по умолчанию'); return }
    setLoading(true); setError('')
    try {
      await updateProject(projectId, {
        name, description, color,
        default_assignee_mode: assigneeMode,
        default_assignee_id: assigneeMode === 'specific' ? assigneeId : null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl p-6 flex flex-col gap-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Основное</h2>

      {/* Название */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Название</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      {/* Описание */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Описание</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          className="px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      {/* Цвет */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Цвет проекта</label>
        <div className="flex gap-2.5">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full transition-transform"
              style={{ background: c, transform: color === c ? 'scale(1.25)' : 'scale(1)', boxShadow: color === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : 'none' }}
            />
          ))}
        </div>
      </div>

      {/* Исполнитель по умолчанию */}
      <div className="flex flex-col gap-3 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="pt-3">
          <label className="text-xs font-medium" style={{ color: 'var(--text2)' }}>Исполнитель по умолчанию</label>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text2)', opacity: 0.6 }}>Кто будет назначен исполнителем при создании задачи</p>
        </div>

        <div className="flex flex-col gap-1.5">
          {ASSIGNEE_MODES.map(mode => (
            <button key={mode.value} type="button" onClick={() => setAssigneeMode(mode.value as any)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
              style={{
                background: assigneeMode === mode.value ? 'rgba(79,142,247,0.08)' : 'var(--surface2)',
                border: `1px solid ${assigneeMode === mode.value ? 'rgba(79,142,247,0.3)' : 'var(--border)'}`,
              }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                style={{ borderColor: assigneeMode === mode.value ? 'var(--accent)' : 'var(--border)' }}
              >
                {assigneeMode === mode.value && (
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                )}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{mode.label}</p>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>{mode.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {assigneeMode === 'specific' && (
          <UserDropdown value={assigneeId} onChange={setAssigneeId} members={members} />
        )}
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={!isDirty || !name.trim() || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
          Сохранить
        </button>
        {saved && <span className="text-xs" style={{ color: 'var(--green)' }}>Сохранено ✓</span>}
      </div>
    </div>
  )
}
