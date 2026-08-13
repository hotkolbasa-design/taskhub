'use client'

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'

/**
 * Персист состояния фильтра в localStorage — приватно для пользователя (ключ содержит userId),
 * запоминается между заходами. SSR/первый рендер = initial, затем подтягивается сохранённое.
 */
export function usePersistedFilter<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial)

  // Загрузка при монтировании и смене ключа (напр. другой проект)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      setValue(raw != null ? (JSON.parse(raw) as T) : initial)
    } catch {
      setValue(initial)
    }
    // initial намеренно вне deps — иначе перезагрузка на каждый новый литерал []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Сохранение при изменении (первый проход пропускаем, чтобы не писать дефолт)
  const skip = useRef(true)
  useEffect(() => {
    if (skip.current) { skip.current = false; return }
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return [value, setValue]
}
