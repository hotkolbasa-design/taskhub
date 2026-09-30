'use client'

import { useEffect, useState } from 'react'

type Move = {
  id: string
  deal_id: number
  kind: 'enroll' | 'expel'
  happened_at: string
  students: number
  student_names: string[]
  deal_title: string | null
}

type Bucket = { key: string; label: string; enrolled: number; expelled: number; total: number; title: string }

type Stats = {
  baselineTotal: number
  baselineDate: string
  current: number
  enrolled: number
  expelled: number
  net: number
  days: { date: string; enrolled: number; expelled: number; total: number }[]
  weeks: { label: string; from: string; to: string; enrolled: number; expelled: number; total: number }[]
  moves: Move[]
}

const DEAL_URL = 'https://globalonlineschool.bitrix24.kz/crm/deal/details'

export default function StudentsView({ monthKey }: { monthKey: string }) {
  const [data, setData] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState<'days' | 'weeks'>('days')

  useEffect(() => {
    let alive = true
    fetch(`/api/crm?action=students&month=${monthKey}`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        if (d.error) setError(d.error)
        else { setError(null); setData(d) }
        setLoading(false)
      })
      .catch(e => { if (alive) { setError(String(e)); setLoading(false) } })
    return () => { alive = false }
  }, [monthKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-sm" style={{ color: 'var(--text2)' }}>
        <span className="w-4 h-4 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--accent)' }} />
        Считаем учеников…
      </div>
    )
  }

  if (error || !data) {
    return <div className="py-10 text-sm" style={{ color: 'var(--red)' }}>Не удалось получить данные: {error}</div>
  }

  // По дням смотрят на форму кривой, по неделям — на сами числа,
  // поэтому недели показываем таблицей, а не графиком
  const buckets = data.days.map(d => ({
    key: d.date,
    label: d.date.slice(8),
    enrolled: d.enrolled,
    expelled: d.expelled,
    total: d.total,
    title: `${formatDate(d.date)}: ${d.total} учеников (+${d.enrolled} / −${d.expelled})`,
  }))

  const weeks = data.weeks ?? []

  const maxBar = Math.max(1, ...buckets.map(d => Math.max(d.enrolled, d.expelled)))
  const totals = buckets.map(d => d.total)
  const minTotal = Math.min(...totals, data.current)
  const maxTotal = Math.max(...totals, data.current)
  // Минимальный размах, иначе прирост в одного ученика рисуется скачком во весь график
  const span = Math.max(12, maxTotal - minTotal)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Tile label="Учеников сейчас" value={data.current} hint={`отметка ${data.baselineTotal} на ${formatDate(data.baselineDate)}`} big />
        <Tile label="Пришло за месяц" value={data.enrolled} color={data.enrolled ? '#2DD4A0' : undefined} prefix={data.enrolled ? '+' : ''} />
        <Tile label="Отчислено за месяц" value={data.expelled} color={data.expelled ? '#F75C6E' : undefined} prefix={data.expelled ? '−' : ''} />
        <Tile label="Чистый прирост" value={Math.abs(data.net)} color={data.net >= 0 ? '#2DD4A0' : '#F75C6E'} prefix={data.net >= 0 ? '+' : '−'} />
      </div>

      {(scale === 'days' ? buckets.length > 0 : weeks.length > 0) && (
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                {scale === 'days' ? 'Численность по дням' : 'Движение по неделям'}
              </span>
              <div className="flex items-center gap-1">
                {(['days', 'weeks'] as const).map(v => (
                  <button key={v} type="button" onClick={() => setScale(v)}
                    className="px-2.5 py-1 rounded-lg text-xs"
                    style={{
                      background: scale === v ? 'rgba(124,92,246,0.15)' : 'transparent',
                      color: scale === v ? '#7C5CF6' : 'var(--text2)',
                      border: '1px solid var(--border)', cursor: 'pointer',
                    }}>
                    {v === 'days' ? 'Дни' : 'Недели'}
                  </button>
                ))}
              </div>
            </div>
            {scale === 'days' && (
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text2)' }}>
                <Legend color="#2DD4A0" text="пришли" />
                <Legend color="#F75C6E" text="ушли" />
              </div>
            )}
          </div>

          {scale === 'days' ? (
            <div className="flex items-end gap-1" style={{ height: 150 }}>
              {buckets.map(d => {
                const h = 8 + ((d.total - minTotal) / span) * 100
                return (
                  <div key={d.key} className="flex-1 flex flex-col items-center justify-end gap-1" title={d.title}>
                    <div className="w-full flex items-end justify-center gap-0.5" style={{ height: 34 }}>
                      {d.enrolled > 0 && (
                        <div style={{ width: 4, height: (d.enrolled / maxBar) * 30, background: '#2DD4A0', borderRadius: 2 }} />
                      )}
                      {d.expelled > 0 && (
                        <div style={{ width: 4, height: (d.expelled / maxBar) * 30, background: '#F75C6E', borderRadius: 2 }} />
                      )}
                    </div>
                    <div className="w-full rounded-t" style={{ height: h, background: 'rgba(124,92,246,0.35)', borderTop: '2px solid #7C5CF6' }} />
                    <span className="text-[9px] whitespace-nowrap" style={{ color: 'var(--text2)' }}>{d.label}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <Th>Неделя</Th>
                  <Th right>Пришло</Th>
                  <Th right>Отчислено</Th>
                  <Th right>Изменение</Th>
                  <Th right>Учеников на конец недели</Th>
                </tr>
              </thead>
              <tbody>
                {weeks.map(w => {
                  const net = w.enrolled - w.expelled
                  return (
                    <tr key={w.from} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text)' }}>{w.label}</td>
                      <td className="px-4 py-2.5 text-right" style={{ color: w.enrolled ? '#2DD4A0' : 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                        {w.enrolled ? `+${w.enrolled}` : '0'}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: w.expelled ? '#F75C6E' : 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                        {w.expelled ? `−${w.expelled}` : '0'}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ color: net > 0 ? '#2DD4A0' : net < 0 ? '#F75C6E' : 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                        {net > 0 ? `+${net}` : net < 0 ? `−${Math.abs(net)}` : '0'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                        {w.total}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Движение за месяц</span>
        </div>
        {data.moves.length === 0 ? (
          <div className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text2)' }}>
            В этом месяце движений не было
          </div>
        ) : (
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <Th>Дата</Th><Th>Событие</Th><Th>Ученики</Th><Th right>Сколько</Th><Th>Сделка</Th>
              </tr>
            </thead>
            <tbody>
              {data.moves.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text2)' }}>{formatDate(m.happened_at.slice(0, 10))}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="text-xs px-2 py-1 rounded-md" style={{
                      color: m.kind === 'enroll' ? '#2DD4A0' : '#F75C6E',
                      background: m.kind === 'enroll' ? 'rgba(45,212,160,0.15)' : 'rgba(247,92,110,0.15)',
                    }}>
                      {m.kind === 'enroll' ? 'Зачисление' : 'Отчисление'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text)' }}>
                    {m.student_names.length > 0 ? m.student_names.join(', ') : <span style={{ color: 'var(--text2)' }}>ФИО не заполнено</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                    {m.kind === 'enroll' ? '+' : '−'}{m.students}
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={`${DEAL_URL}/${m.deal_id}/`} target="_blank" rel="noreferrer"
                      className="text-xs" style={{ color: 'var(--accent)' }}>
                      {m.deal_title || `Сделка ${m.deal_id}`}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--text2)' }}>
        Счёт ведётся от отметки <b>{data.baselineTotal}</b> учеников на {formatDate(data.baselineDate)}.
        Плюс — когда сделка попадает в стадию «Зарегистрировать на платформу», минус — когда в «Запросили отчисление».
        В одной сделке может быть до четырёх учеников, считается каждый заполненный «ФИО ученика».
      </p>
    </div>
  )
}

function Tile({ label, value, hint, color, prefix, big }: {
  label: string
  value: number
  hint?: string
  color?: string
  prefix?: string
  big?: boolean
}) {
  return (
    <div className="rounded-xl px-4 py-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-xs mb-1.5" style={{ color: 'var(--text2)' }}>{label}</div>
      <div style={{ color: color ?? 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: big ? 30 : 24, fontWeight: 600, lineHeight: 1.1 }}>
        {prefix}{value}
      </div>
      {hint && <div className="text-xs mt-1.5" style={{ color: 'var(--text2)' }}>{hint}</div>}
    </div>
  )
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
      {text}
    </span>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-medium ${right ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text2)' }}>
      {children}
    </th>
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
