'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function NavigationLoader() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)

  // Скрываем когда страница загрузилась
  useEffect(() => {
    setLoading(false)
  }, [pathname])

  // Показываем при клике на внутреннюю ссылку
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return
      if (anchor.target === '_blank') return
      if (href === pathname) return
      setLoading(true)
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname])

  if (!loading) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: 'rgba(15,17,23,0.5)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="w-9 h-9 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
      />
    </div>
  )
}
