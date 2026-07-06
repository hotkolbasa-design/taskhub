'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSprint } from '@/app/(dashboard)/projects/[id]/sprint/actions'

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

const COLUMN_COLORS = ['#4F8EF7','#A78BFA','#2DD4A0','#F7C04F','#F75C6E','#60C0E8','#8892A4']

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function DatePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => value ? new Date(value + 'T00:00:00') : new Date())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOut = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [open])

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  let startDow = new Date(year, month, 1).getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const cells: { day: number; month: number; year: number; current: boolean }[] = []
  for (let i = startDow - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, month: month - 1, year: month === 0 ? year - 1 : year, current: false })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, month, year, current: true })
  while (cells.length % 7 !== 0) {
    const d = cells.length - daysInMonth - startDow + 1
    cells.push({ day: d, month: month + 1, year: month === 11 ? year + 1 : year, current: false })
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const selectedDate = value ? (() => { const d = new Date(value + 'T00:00:00'); d.setHours(0,0,0,0); return d })() : null

  function selectDay(day: number, m: number, y: number) {
    const d = new Date(y, m, day)
    onChange(toIso(d)); setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left"
        style={{ background: 'var(--surface2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, color: value ? 'var(--text)' : 'var(--text2)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text2)', flexShrink: 0 }}>
          <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M4 1v2M10 1v2M1 5.5h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span className="flex-1">{displayValue || 'Выберите дату'}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 rounded-xl z-50 p-3"
          style={{ background: 'var(--surface2)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: 260, animation: 'dropdownIn 0.12s ease-out' }}
        >
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="p-1 rounded-md" style={{ color: 'var(--text2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="p-1 rounded-md" style={{ color: 'var(--text2)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs py-1" style={{ color: 'var(--text2)' }}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              const cellDate = new Date(cell.year, cell.month, cell.day); cellDate.setHours(0,0,0,0)
              const isToday = cellDate.getTime() === today.getTime()
              const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime()
              return (
                <button key={i} type="button"
                  onClick={() => selectDay(cell.day, cell.month, cell.year)}
                  className="text-center text-xs py-1.5 rounded-md transition-colors"
                  style={{
                    color: isSelected ? '#fff' : cell.current ? 'var(--text)' : 'var(--text2)',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    border: isToday && !isSelected ? '1px solid var(--accent)' : '1px solid transparent',
                    opacity: cell.current ? 1 : 0.4,
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          <div className="flex justify-end mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={() => { onChange(toIso(new Date())); setOpen(false) }}
              className="text-xs px-2 py-1 rounded-md" style={{ color: 'var(--accent)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(79,142,247,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

type CustomCol = { name: string; color: string }

type Props = {
  projectId: string
  canManage: boolean
}

export default function CreateSprintView({ projectId, canManage }: Props) {
  const router = useRouter()
  const [name, setName] = useState('Спринт 1')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [mode, setMode] = useState<'weekdays' | 'custom'>('weekdays')
  const [customCols, setCustomCols] = useState<CustomCol[]>([
    { name: 'Новые', color: '#4F8EF7' },
    { name: 'В работе', color: '#A78BFA' },
    { name: 'Готово', color: '#2DD4A0' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dateFrom || !dateTo) { setError('Укажите даты'); return }
    if (mode === 'custom' && customCols.some(c => !c.name.trim())) { setError('Заполните названия колонок'); return }
    setSaving(true)
    setError('')
    try {
      await createSprint(projectId, {
        name: name.trim() || 'Спринт',
        dateFrom,
        dateTo,
        mode,
        customColumns: mode === 'custom' ? customCols : undefined,
      })
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  function addCustomCol() {
    if (customCols.length >= 7) return
    setCustomCols(prev => [...prev, { name: '', color: COLUMN_COLORS[prev.length % COLUMN_COLORS.length] }])
  }

  function updateCustomCol(i: number, field: keyof CustomCol, val: string) {
    setCustomCols(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  }

  function removeCustomCol(i: number) {
    if (customCols.length <= 1) return
    setCustomCols(prev => prev.filter((_, idx) => idx !== i))
  }

  if (!canManage) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--surface)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text2)' }}>
              <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 7V5a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-base font-medium mb-1" style={{ color: 'var(--text)' }}>Нет активного спринта</p>
          <p className="text-sm" style={{ color: 'var(--text2)' }}>Руководитель проекта создаст спринт</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text)' }}>Создать спринт</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Название */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text2)' }}>Название</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {/* Даты */}
          <div className="grid grid-cols-2 gap-3">
            <DatePicker value={dateFrom} onChange={setDateFrom} label="Начало" />
            <DatePicker value={dateTo} onChange={setDateTo} label="Конец" />
          </div>

          {/* Режим колонок */}
          <div>
            <label className="block text-xs mb-2" style={{ color: 'var(--text2)' }}>Колонки</label>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['weekdays', 'custom'] as const).map(m => (
                <button key={m} type="button"
                  onClick={() => setMode(m)}
                  className="flex-1 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: mode === m ? 'var(--accent)' : 'var(--surface2)',
                    color: mode === m ? '#fff' : 'var(--text2)',
                  }}
                >
                  {m === 'weekdays' ? 'Дни недели' : 'Свои статусы'}
                </button>
              ))}
            </div>
          </div>

          {/* Предпросмотр колонок */}
          {mode === 'weekdays' && (
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Новые', color: '#8892A4' },
                { label: 'Пн',    color: '#4F8EF7' },
                { label: 'Вт',    color: '#A78BFA' },
                { label: 'Ср',    color: '#2DD4A0' },
                { label: 'Чт',    color: '#F7C04F' },
                { label: 'Пт',    color: '#F75C6E' },
                { label: 'Сб',    color: '#60C0E8' },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md"
                  style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          )}

          {mode === 'custom' && (
            <div className="flex flex-col gap-2">
              {customCols.map((col, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full shrink-0 cursor-pointer"
                    style={{ background: col.color }}
                    title="Цвет"
                  />
                  <input
                    value={col.name}
                    onChange={e => updateCustomCol(i, 'name', e.target.value)}
                    placeholder={`Колонка ${i + 1}`}
                    className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                  {customCols.length > 1 && (
                    <button type="button" onClick={() => removeCustomCol(i)}
                      className="p-1 rounded-md shrink-0" style={{ color: 'var(--text2)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {customCols.length < 7 && (
                <button type="button" onClick={addCustomCol}
                  className="flex items-center gap-1.5 text-xs py-1"
                  style={{ color: 'var(--accent)' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Добавить колонку
                </button>
              )}
            </div>
          )}

          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onMouseEnter={e => { if (!saving) (e.currentTarget.style.opacity = '0.9') }}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {saving && (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            Создать спринт
          </button>
        </form>
      </div>
    </div>
  )
}
