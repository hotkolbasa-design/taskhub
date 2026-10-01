'use client'

import { useState, useMemo } from 'react'
import type { DashData, SourceData, GroupSourceData } from '@/lib/crm/types'

/** Раздел «Каналы»: сводка эффективности источников за выбранный месяц. */
export function ChannelsView({ data, excluded }: { data: DashData; excluded: Set<string> }) {
  const groups = data.marketing.groups ?? []
  const groupedNames = new Set(groups.flatMap(g => g.sources))
  const visible = data.marketing.sources.filter(s => !excluded.has(s.source) && !groupedNames.has(s.source))

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text2)', opacity: 0.6 }}>
          Эффективность каналов
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>
      <ChannelsTable sources={visible} groups={groups} overall={data.marketing.overall} />
    </div>
  )
}

type Row = {
  name: string
  grouped: boolean
  parts: number      // сколько источников внутри группы
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

type Totals = { leads: number; paid: number; spent: number; revenue: number; toPaid: number; cpl: number; cac: number }
type SortKey = 'leads' | 'paid' | 'toPaid' | 'cac' | 'romi' | 'spent' | 'revenue'

const NF = new Intl.NumberFormat('ru-RU')
const n = (v: number) => NF.format(Math.round(v))
const pct = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',') + ' %'
const usd = (v: number) => '$' + (v >= 100 ? n(v) : String(Math.round(v * 100) / 100).replace('.', ','))

function plural(v: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.round(v)) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

const leadsWord = (v: number) => `${n(v)} ${plural(v, 'заявка', 'заявки', 'заявок')}`
const paidWord = (v: number) => `${n(v)} ${plural(v, 'оплата', 'оплаты', 'оплат')}`

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
    parts: 'sources' in s ? s.sources.length : 0,
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

/**
 * Подытог блока. CPL и цена клиента считаются только по каналам с расходом:
 * если делить бюджет на весь поток вместе с органикой и звонками, заявка
 * выходит по 80 центов, и цифра перестаёт что-либо значить.
 */
function sumRows(rows: Row[]): Totals {
  const leads = rows.reduce((s, r) => s + r.leads, 0)
  const paid = rows.reduce((s, r) => s + r.paid, 0)
  const spent = rows.reduce((s, r) => s + r.spent, 0)
  const revenue = rows.reduce((s, r) => s + r.revenue, 0)
  const withSpend = rows.filter(r => r.spent > 0)
  const paidLeads = withSpend.reduce((s, r) => s + r.leads, 0)
  const paidSales = withSpend.reduce((s, r) => s + r.paid, 0)
  return {
    leads, paid, spent, revenue,
    toPaid: leads > 0 ? paid / leads * 100 : 0,
    cpl: paidLeads > 0 && spent > 0 ? spent / paidLeads : 0,
    cac: paidSales > 0 && spent > 0 ? spent / paidSales : 0,
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
  sources: SourceData[]
  groups: GroupSourceData[]
  overall: DashData['marketing']['overall']   // у общей карточки имя источника необязательно
}) {
  const [sort, setSort] = useState<SortKey>('paid')
  const [asc, setAsc] = useState(false)

  // Итог берётся из общей карточки месяца, а не из суммы каналов: часть заявок
  // приходит без источника и ни в один канал не попадает
  const totals = useMemo<Totals>(() => {
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

  const { groupRows, sourceRows, rest } = useMemo(() => {
    // Канал с парой заявок и без денег — шум, он только мешает сравнивать
    const worth = (r: Row) => r.leads >= 5 || r.paid > 0 || r.spent > 0
    const order = (list: Row[]) => [...list].sort((a, b) => {
      // нулевая цена клиента значит «не платили», ей не место наверху рейтинга дешёвых
      const d = sort === 'cac'
        ? (a.cac || Infinity) - (b.cac || Infinity)
        : b[sort] - a[sort]
      return asc ? -d : d
    })

    const g = groups.map(x => toRow(x as SourceData, true, totals.paid)).filter(worth)
    const s = sources.map(x => toRow(x, false, totals.paid)).filter(worth)
    const shown = sumRows([...g, ...s])

    return {
      groupRows: order(g),
      sourceRows: order(s),
      // Всё, что не попало в строки: мелкие источники и заявки без источника
      rest: {
        leads: Math.max(0, totals.leads - shown.leads),
        paid: Math.max(0, totals.paid - shown.paid),
        spent: Math.max(0, totals.spent - shown.spent),
        revenue: Math.max(0, totals.revenue - shown.revenue),
      },
    }
  }, [sources, groups, sort, asc, totals])

  if (!groupRows.length && !sourceRows.length) return null

  // Канал сравнивается со средним по месяцу, а не с абстрактной нормой.
  // База — те же цифры, что в итоге месяца, иначе в шапке и в итоге стояли бы разные.
  const avgToPaid = totals.toPaid
  const avgCac = totals.cac

  const sortBy = (key: SortKey) => {
    if (key === sort) setAsc(v => !v)
    else { setSort(key); setAsc(false) }
  }

  return (
    <div>
      <Findings rows={[...groupRows, ...sourceRows]} avgToPaid={avgToPaid} avgCac={avgCac} />

      {groupRows.length > 0 && (
        <ChannelBlock
          title="Группы каналов"
          subtitle="объединённые источники — ими и управляют бюджетом"
          rows={groupRows}
          footerLabel="Итого по группам"
          footer={sumRows(groupRows)}
          sort={sort} asc={asc} onSort={sortBy}
          avgToPaid={avgToPaid} avgCac={avgCac}
        />
      )}

      {sourceRows.length > 0 && (
        <ChannelBlock
          title="Отдельные источники"
          subtitle="всё, что не входит ни в одну группу"
          rows={sourceRows}
          footerLabel="Итого по источникам"
          footer={sumRows(sourceRows)}
          sort={sort} asc={asc} onSort={sortBy}
          avgToPaid={avgToPaid} avgCac={avgCac}
          rest={rest.leads > 0 || rest.paid > 0 ? rest : undefined}
        />
      )}

      <div className="rounded-2xl px-4 py-3 flex flex-wrap items-baseline gap-x-6 gap-y-1"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Всего за месяц</span>
        <Stat label="заявки" value={n(totals.leads)} />
        <Stat label="оплаты" value={n(totals.paid)} />
        <Stat label="сквозная" value={pct(totals.toPaid)} />
        {totals.spent > 0 && <Stat label="расход" value={usd(totals.spent)} />}
        {totals.cpl > 0 && <Stat label="CPL" value={usd(totals.cpl)} />}
        {totals.cac > 0 && <Stat label="клиент" value={usd(totals.cac)} />}
        {totals.revenue > 0 && <Stat label="выручка" value={n(totals.revenue / 1000) + 'к ₸'} />}
        <span className="text-[11px] w-full" style={{ color: 'var(--text2)', opacity: 0.8 }}>
          Здесь CPL и клиент считаются на весь поток заявок — те же цифры, что в разделе «Маркетинг».
        </span>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-sm" style={{ color: 'var(--text2)' }}>
      {label}{' '}
      <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
    </span>
  )
}

function ChannelBlock({ title, subtitle, rows, footer, footerLabel, sort, asc, onSort, avgToPaid, avgCac, rest }: {
  title: string
  subtitle: string
  rows: Row[]
  footer: Totals
  footerLabel: string
  sort: SortKey
  asc: boolean
  onSort: (key: SortKey) => void
  avgToPaid: number
  avgCac: number
  rest?: { leads: number; paid: number; spent: number; revenue: number }
}) {
  const convColor = (v: number) => v === 0 ? 'var(--text2)' : v >= avgToPaid * 1.25 ? 'var(--green)' : v <= avgToPaid * 0.6 ? 'var(--red)' : 'var(--text)'
  const cacColor = (v: number) => v === 0 ? 'var(--text2)' : v <= avgCac * 0.75 ? 'var(--green)' : v >= avgCac * 1.5 ? 'var(--red)' : 'var(--text)'
  const romiColor = (v: number, spent: number) => spent === 0 ? 'var(--text2)' : v >= 400 ? 'var(--green)' : v < 100 ? 'var(--red)' : 'var(--text)'

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text2)' }}>{subtitle}</p>
        </div>
        <span className="text-xs" style={{ color: 'var(--text2)' }}>
          зелёным — лучше средней по месяцу ({pct(avgToPaid)}), красным — заметно хуже
        </span>
      </div>

      <div className="rounded-2xl overflow-x-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 940 }}>
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider sticky left-0"
                style={{ color: 'var(--text2)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', minWidth: 210, zIndex: 1 }}>
                {title === 'Группы каналов' ? 'Группа' : 'Источник'}
              </th>
              {COLUMNS.map(c => (
                <th key={c.label} title={c.hint}
                  onClick={c.key ? () => onSort(c.key!) : undefined}
                  className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider whitespace-nowrap"
                  style={{
                    color: c.key && sort === c.key ? 'var(--accent)' : 'var(--text2)',
                    background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                    cursor: c.key ? 'pointer' : 'default', fontWeight: c.key && sort === c.key ? 700 : 500,
                  }}
                >
                  {c.label}{c.key && sort === c.key ? (asc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name}>
                <td className="px-3 py-2.5 sticky left-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--text)' }}>{r.name}</span>
                    {r.grouped && r.parts > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                        {r.parts} {plural(r.parts, 'источник', 'источника', 'источников')}
                      </span>
                    )}
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

            {rest && (
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
                style={{ background: 'var(--surface2)', color: 'var(--text)', zIndex: 1 }}>{footerLabel}</td>
              <Num v={n(footer.leads)} bold total />
              <Num v="" total />
              <Num v="" total />
              <Num v={n(footer.paid)} bold total />
              <Num v={pct(footer.toPaid)} bold total />
              <Num v={footer.spent ? usd(footer.spent) : '—'} total />
              <Num v={footer.cpl ? usd(footer.cpl) : '—'} total />
              <Num v={footer.cac ? usd(footer.cac) : '—'} total />
              <Num v={footer.revenue ? n(footer.revenue / 1000) + 'к' : '—'} total />
              <Num v="" total />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] mt-1.5" style={{ color: 'var(--text2)' }}>
        В подытоге CPL и цена клиента считаются только по каналам с расходом — бесплатные заявки их не разбавляют.
      </p>
    </div>
  )
}

/**
 * Три вывода, ради которых раздел и открывают: где клиент дешевле всего,
 * где лучше доводят до оплаты и куда деньги уходят зря.
 * Канал меньше 20 заявок в лидеры по конверсии не берём — на пяти заявках
 * «40 %» это случайность, а не канал.
 */
function Findings({ rows, avgToPaid, avgCac }: { rows: Row[]; avgToPaid: number; avgCac: number }) {
  const paidRows = rows.filter(r => r.cac > 0)
  const cheapest = paidRows.length ? paidRows.reduce((a, b) => (b.cac < a.cac ? b : a)) : null

  const solid = rows.filter(r => r.leads >= 20)
  const best = solid.length ? solid.reduce((a, b) => (b.toPaid > a.toPaid ? b : a)) : null

  // Слабое место: платный канал с конверсией заметно ниже средней, иначе —
  // самый большой поток заявок, который не дал ни одной оплаты
  const weakPaid = paidRows.filter(r => r.toPaid < avgToPaid * 0.8).sort((a, b) => b.spent - a.spent)[0]
  const deadFlow = rows.filter(r => r.paid === 0 && r.leads >= 20).sort((a, b) => b.leads - a.leads)[0]
  const weak = weakPaid ?? deadFlow ?? null

  const cards = [
    cheapest && {
      tone: 'var(--green)',
      label: 'Дешевле всего клиент',
      name: cheapest.name,
      value: usd(cheapest.cac),
      note: `${paidWord(cheapest.paid)} при расходе ${usd(cheapest.spent)}` +
        (avgCac > 0 ? ` · в ${String(Math.round(avgCac / cheapest.cac * 10) / 10).replace('.', ',')} раза дешевле средней` : ''),
    },
    best && {
      tone: 'var(--accent)',
      label: 'Лучше всех доводит до оплаты',
      name: best.name,
      value: pct(best.toPaid),
      note: `${leadsWord(best.leads)} → ${paidWord(best.paid)} · средняя по месяцу ${pct(avgToPaid)}`,
    },
    weak && {
      tone: 'var(--red)',
      label: weak.paid === 0 ? 'Поток без единой оплаты' : 'Деньги уходят впустую',
      name: weak.name,
      value: weak.paid === 0 ? leadsWord(weak.leads) : usd(weak.cac),
      note: weak.paid === 0
        ? `конверсия в назначенное собеседование ${pct(weak.toApp)} — проверить, что это за поток`
        : `сквозная ${pct(weak.toPaid)} при средней ${pct(avgToPaid)} · расход ${usd(weak.spent)}`,
    },
  ].filter(Boolean) as { tone: string; label: string; name: string; value: string; note: string }[]

  if (!cards.length) return null

  return (
    <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      {cards.map(c => (
        <div key={c.label} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${c.tone}` }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: c.tone }}>{c.label}</div>
          <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
            <span className="text-xl font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{c.value}</span>
            <span className="text-sm" style={{ color: 'var(--text2)' }}>{c.name}</span>
          </div>
          <div className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text2)' }}>{c.note}</div>
        </div>
      ))}
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
