'use client'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4" style={{ minHeight: 400 }}>
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(247,92,110,0.1)' }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 8v4M11 14.5v.5" stroke="var(--red)" strokeWidth="1.6" strokeLinecap="round"/>
          <path d="M9.27 3.5L2 16a2 2 0 001.73 3h14.54A2 2 0 0020 16L12.73 3.5a2 2 0 00-3.46 0z"
            stroke="var(--red)" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Не удалось загрузить страницу</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>
          {error.message || 'Произошла непредвиденная ошибка'}
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        Попробовать снова
      </button>
    </div>
  )
}
