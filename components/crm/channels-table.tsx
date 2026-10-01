'use client'

import { useState, useMemo } from 'react'
import type { SourceData, GroupSourceData } from '@/lib/crm/types'

type Row = {
  name: string
  grouped: boolean
  leads: number
  app: number
  held: number
  pre: number
  paid: number
  toApp: number      // лид → назначено, %
  toHeld: number     // назначено → проведено, %
  toPaid: number     // сквозная лид → оплата, %
  spent: number      // $
  cpl: number        // $
  cac: number        // $
  revenue: number    // ₸
  romi: number       // %
  share: number      // доля в оплатах, %
}

type SortKey = 'leads' | 'paid' | 'toPaid' | 'cac' | 'romi' | 'spent' | 'revenue'

const NF = new Intl.NumberFormat('ru-RU')
const n = (v: number) => NF.format(Math.round(v))
const pct = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',') + ' %'
const usd = (v: number) => '$' + (v >= 100 ? n(v) : String(Math.round(v * 100) / 100).replace('.', ','))

// Источник иногда приходит вместе с текстом звонка — в таблице нужна только первая строка
function shortName(s: string): string {
  const first = s.split('\n')[0].trim()
  return first.length > 44 ? first.slice(0, 42) + '…' : first
}

function toRow(s: SourceData | GroupSourceData, grouped: boolean, totalPaid: number): Row {
  const ms = s.milestones
  const leads = ms[0]?.total ?? 0
  const app = ms[1]?.total ?? 0
  const held = ms[2]?.total ?? 0
  const pre = ms[3]?.total ?? 0
  const paid = ms[ms.length - 1]?.total ?? 0
  const spent = s.spend?.spent.total ?? 0
  const revenue = s.revenue?.total ?? 0
  return {
    name: shortName(s.source),
    grouped,
    leads, app, held, pre, paid,
    toApp: leads > 0 ? app / leads * 100 : 0,
    toHeld: app > 0 ? held / app * 100 : 0,
    toPaid: leads > 0 ? paid / leads * 100 : 0,
    spent,
    cpl: leads > 0 && spent > 0 ? spent / leads : 0,
    cac: paid > 0 && spent > 0 ? spent / paid : 0,
    revenue,
    romi: s.spend?.romi.total ?? 0,
    share: totalPaid > 0 ? paid / totalPaid * 100 : 0,
  }
}

const COLUMNS: { key: SortKey | null; label: string; hint?: string }[] = [
  { key: 'leads', label: 'Заявки' },
  { key: null, label: '→ назнач.', hint: 'доля заявок, дошедших до назначенного собеседования' },
  { key: null, label: '→ провед.', hint: 'доля назначенных, которые состоялись' },
  { key: 'paid', label: 'Оплаты' },
  { key: 'toPaid', label: 'Заявка→оплата', hint: 'сквозная конверсия канала' },
  { key: 'spent', label: 'Расход' },
  { key: null, label: 'CPL' },
  { key: 'cac', label: 'Цена клиента' },
  { key: 'revenue', label: 'Выручка' },
  { key: 'romi', label: 'ROMI' },
]

export function ChannelsTable({ sources, groups, overall }: {
  sources: SourceData[]; groups: GroupSourceData[]; overall: SourceData
}) {
  const [sort, setSort] = useState<SortKey>('paid')
  const [asc, setAsc] = useState(false)

  // Итог берётся из общей карточки месяца, а не из суммы каналов: часть заявок
  // приходит без источника и ни в один канал не попадает
  const totals = useMemo(() => {
    const ms = overall.milestones
    const leads = ms[0]?.total ?? 0
    const paid = ms[ms.length - 1]?.total ?? 0
    const spent = overall.spend?.spent.total ?? 0
    const revenue = overall.revenue?.total ?? 0
    return {
      leads, paid, spent, revenue,
      toPaid: leads > 0 ? paid / leads * 100 : 0,
      cpl: leads > 0 && spent > 0 ? spent / leads : 0,
      cac: paid > 0 && spent > 0 ? spent / paid : 0,
    }
  }, [overall])

  const { rows, rest } = useMemo(() => {
    const all = [
      ...groups.map(g => ({ item: g as SourceData, grouped: true })),
      ...sources.map(s => ({ item: s, grouped: false })),
    ]
    const list = all
      .map(({ item, grouped }) => toRow(item, grouped, totals.paid))
      // Канал с парой заявок и без денег — шум, он только мешает сравнивать
      .filter(r => r.leads >= 5 || r.paid > 0 || r.spent > 0)

    const sorted = [...list].sort((a, b) => {
      // нулевая цена клиента значит «не платили», ей не место наверху рейтинга дешёвых
      const d = sort === 'cac'
        ? (a.cac || Infinity) - (b.cac || Infinity)
        : b[sort] - a[sort]
      return asc ? -d : d
    })

    // Всё, что не попало в строки: мелкие источники и заявки без источника
    const shown = list.reduce((acc, r) => ({
      leads: acc.leads + r.leads, paid: acc.paid + r.paid,
      spent: acc.spent + r.spent, revenue: acc.revenue + r.revenue,
    }), { leads: 0, paid: 0, spent: 0, revenue: 0 })

    return {
      rows: sorted,
      rest: {
        leads: Math.max(0, totals.leads - shown.leads),
        paid: Math.max(0, totals.paid - shown.paid),
        spent: Math.max(0, totals.spent - shown.spent),
        revenue: Math.max(0, totals.revenue - shown.revenue),
      },
    }
  }, [sources, groups, sort, asc, totals])

  if (!rows.length) return null

  // Канал сравнивается со средним по месяцу, а не с абстрактной нормой.
  // База — те же цифры, что в строке «Итого», иначе в шапке и в итоге стояли бы разные.
  const avgToPaid = totals.toPaid
  const avgCac = totals.cac

  const convColor = (v: number) => v === 0 ? 'var(--text2)' : v >= avgToPaid * 1.25 ? 'var(--green)' : v <= avgToPaid * 0.6 ? 'var(--red)' : 'var(--text)'
  const cacColor = (v: number) => v === 0 ? 'var(--text2)' : v <= avgCac * 0.75 ? 'var(--green)' : v >= avgCac * 1.5 ? 'var(--red)' : 'var(--text)'
  const romiColor = (v: number, spent: number) => spent === 0 ? 'var(--text2)' : v >= 400 ? 'var(--green)' : v < 100 ? 'var(--red)' : 'var(--text)'

  const th = (label: string, key: SortKey | null, hint?: string) => (
    <th key={label} title={hint}
      onClick={key ? () => { if (key === sort) setAsc(v => !v); else { setSort(key); setAsc(false) } } : undefined}
      className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider whitespace-nowrap"
      style={{
        color: key && sort === key ? 'var(--accent)' : 'var(--text2)',
        background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
        cursor: key ? 'pointer' : 'default', fontWeight: key && sort === key ? 700 : 500,
      }}
    >
      {label}{key && sort === key ? (asc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Эффективность каналов</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>
            Зелёным — лучше средней по месяцу, красным — заметно хуже. Клик по заголовку сортирует.
          </p>
        </div>
        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          средняя сквозная {pct(avgToPaid)}{avgCac > 0 ? ` · средняя цена клиента ${usd(avgCac)}` : ''}
        </span>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 940 }}>
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider sticky left-0"
                style={{ color: 'var(--text2)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', minWidth: 210, zIndex: 1 }}>Канал</th>
              {COLUMNS.map(c => th(c.label, c.key, c.hint))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name}>
                <td className="px-3 py-2.5 sticky left-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--text)' }}>{r.name}</span>
                    {r.grouped && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>группа</span>}
                  </div>
                  {r.share > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="h-1 rounded flex-1" style={{ background: 'var(--border)', maxWidth: 90 }}>
                        <div className="h-full rounded" style={{ width: `${Math.min(100, r.share)}%`, background: 'var(--accent)' }} />
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{pct(r.share)} оплат</span>
                    </div>
                  )}
                </td>
                <Num v={n(r.leads)} />
                <Num v={r.leads ? pct(r.toApp) : '—'} muted />
                <Num v={r.app ? pct(r.toHeld) : '—'} muted />
                <Num v={n(r.paid)} bold />
                <Num v={r.leads ? pct(r.toPaid) : '—'} color={convColor(r.toPaid)} bold />
                <Num v={r.spent ? usd(r.spent) : '—'} muted={!r.spent} />
                <Num v={r.cpl ? usd(r.cpl) : '—'} muted={!r.cpl} />
                <Num v={r.cac ? usd(r.cac) : '—'} color={cacColor(r.cac)} muted={!r.cac} />
                <Num v={r.revenue ? n(r.revenue / 1000) + 'к' : '—'} muted={!r.revenue} />
                <Num v={r.spent ? pct(r.romi) : '—'} color={romiColor(r.romi, r.spent)} muted={!r.spent} />
              </tr>
            ))}
            {(rest.leads > 0 || rest.paid > 0) && (
              <tr>
                <td className="px-3 py-2.5 sticky left-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
                  <span className="text-sm" style={{ color: 'var(--text2)' }}>Без источника и мелкие</span>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text2)', opacity: 0.8 }}>заявки без метки и каналы меньше 5 заявок</div>
                </td>
                <Num v={n(rest.leads)} muted />
                <Num v="—" muted />
                <Num v="—" muted />
                <Num v={n(rest.paid)} muted />
                <Num v={rest.leads ? pct(rest.paid / rest.leads * 100) : '—'} muted />
                <Num v={rest.spent ? usd(rest.spent) : '—'} muted />
                <Num v="—" muted />
                <Num v="—" muted />
                <Num v={rest.revenue ? n(rest.revenue / 1000) + 'к' : '—'} muted />
                <Num v="—" muted />
              </tr>
            )}
            <tr>
              <td className="px-3 py-2.5 sticky left-0 text-sm font-semibold"
                style={{ background: 'var(--surface2)', color: 'var(--text)', zIndex: 1 }}>Итого</td>
              <Num v={n(totals.leads)} bold total />
              <Num v="" total />
              <Num v="" total />
              <Num v={n(totals.paid)} bold total />
              <Num v={pct(totals.toPaid)} bold total />
              <Num v={totals.spent ? usd(totals.spent) : '—'} total />
              <Num v={totals.cpl ? usd(totals.cpl) : '—'} total />
              <Num v={totals.cac ? usd(totals.cac) : '—'} total />
              <Num v={totals.revenue ? n(totals.revenue / 1000) + 'к' : '—'} total />
              <Num v="" total />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Num({ v, color, bold, muted, total }: { v: string; color?: string; bold?: boolean; muted?: boolean; total?: boolean }) {
  return (
    <td className="px-3 py-2.5 text-right"
      style={{
        borderBottom: total ? 'none' : '1px solid var(--border)',
        background: total ? 'var(--surface2)' : 'transparent',
        fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums',
        fontSize: 13, fontWeight: bold ? 600 : 400,
        color: color ?? (muted ? 'var(--text2)' : 'var(--text)'),
        whiteSpace: 'nowrap',  // «201,4 %» не должно разрываться между строк
      }}
    >{v}</td>
  )
}
