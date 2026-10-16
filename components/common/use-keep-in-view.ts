'use client'

import { useLayoutEffect, type RefObject } from 'react'

const MARGIN = 8   // отступ от края окна, чтобы список не прилипал к нему вплотную
const GAP = 4      // зазор между кнопкой и списком

/**
 * Держит выпадающий список в пределах окна.
 *
 * Списки позиционируются от кнопки (`top: rect.bottom + 4`) и живут в портале с
 * `position: fixed`. У карточки внизу экрана такой список уходил за нижний край:
 * прокрутить его нельзя — портал вне потока страницы, а при скролле он закрывается.
 * Поэтому здесь список разворачивается вверх, если снизу не помещается, а когда тесно
 * с обеих сторон — прижимается к большей стороне и получает свою прокрутку.
 *
 * Правка делается после рендера и поверх стилей компонента, поэтому вызов добавляется
 * одной строкой и не трогает его собственную логику позиционирования. Эффект без списка
 * зависимостей — он должен отрабатывать каждый раз, когда React перерисовал список
 * и вернул исходные координаты.
 */
export function useKeepInView(
  open: boolean,
  dropRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    if (!open) return
    const el = dropRef.current
    const trigger = triggerRef.current
    if (!el || !trigger) return

    function fit() {
      if (!el || !trigger) return
      // Снимаем прошлое ограничение, иначе высота померяется по нему, а не по содержимому
      el.style.maxHeight = ''
      const t = trigger.getBoundingClientRect()
      const height = el.offsetHeight
      const width = el.offsetWidth
      const below = window.innerHeight - t.bottom - GAP - MARGIN
      const above = t.top - GAP - MARGIN

      el.style.bottom = 'auto'
      if (height <= below || below >= above) {
        el.style.top = `${t.bottom + GAP}px`
        if (height > below) {
          el.style.maxHeight = `${Math.max(below, 120)}px`
          el.style.overflowY = 'auto'
        }
      } else {
        const capped = Math.min(height, Math.max(above, 120))
        el.style.top = `${Math.max(MARGIN, t.top - GAP - capped)}px`
        if (height > above) {
          el.style.maxHeight = `${Math.max(above, 120)}px`
          el.style.overflowY = 'auto'
        }
      }

      // По горизонтали компоненты считают позицию сами; поправляем, только если вылезли
      const r = el.getBoundingClientRect()
      if (r.right > window.innerWidth - MARGIN) {
        el.style.left = `${Math.max(MARGIN, window.innerWidth - width - MARGIN)}px`
        el.style.right = 'auto'
      } else if (r.left < MARGIN) {
        el.style.left = `${MARGIN}px`
        el.style.right = 'auto'
      }
    }

    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  })
}
