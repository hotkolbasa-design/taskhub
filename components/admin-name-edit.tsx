'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateUserName } from '@/app/(dashboard)/admin/actions'

export default function AdminNameEdit({ userId, name }: { userId: string; name: string }) {
  const router = useRouter()
  const [display, setDisplay] = useState(name)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [hovered, setHovered] = useState(false)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === display) {
      setEditing(false)
      setValue(display)
      return
    }
    setDisplay(trimmed)
    setEditing(false)
    setSaving(true)
    await updateUserName(userId, trimmed)
    router.refresh()
    setSaving(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setEditing(false); setValue(display) }
  }

  if (saving) return (
    <div className="flex items-center gap-2">
      <div className="w-3.5 h-3.5 rounded-full border border-t-transparent animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      <span className="text-sm font-medium" style={{ color: 'var(--text2)' }}>{display}</span>
    </div>
  )

  return (
    <div
      className="flex items-center gap-1.5 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!editing) { setEditing(true); setValue(display) } }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium bg-transparent outline-none"
          style={{
            color: 'var(--text)',
            borderBottom: '1px solid var(--accent)',
            width: `${Math.max(value.length, 4)}ch`,
          }}
        />
      ) : (
        <>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            {display}
          </span>
          {hovered && (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text2)', flexShrink: 0 }}>
              <path d="M8.5 1.5l2 2L3 11H1v-2L8.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </>
      )}
    </div>
  )
}
