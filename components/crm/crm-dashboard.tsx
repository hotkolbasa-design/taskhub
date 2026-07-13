'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthOption = { key: string; label: string }
type ValuesSet = { dayValues: number[]; weekValues: number[]; total: number }
type Milestone = { name: string; dayValues: number[]; weekValues: number[]; total: number }
type Spend = {
  spent: ValuesSet; impressions: ValuesSet; clicks: ValuesSet
  ctr: ValuesSet; costPerClick: ValuesSet; fbLeads: ValuesSet
  costPerLeadAnalytics: ValuesSet; budgetKzt: ValuesSet
  costPerLeadCrm: ValuesSet; costPerClient: ValuesSet
  costPerClientKzt: ValuesSet; romi: ValuesSet
}
type SourceData = { source: string; milestones: Milestone[]; revenue?: ValuesSet; spend?: Spend }
type Pipeline = { name: string; stages: Milestone[] }
type DashData = {
  monthKey: string; days: string[]; daysIso: string[]; weeks: string[]
  frozen: boolean; excludedSources: string[]
  pipelines: Pipeline[]
  marketing: {
    summary: { totalLeads: number; totalSales: number; totalRevenue: number }
    sources: SourceData[]; overall: SourceData
  }
}

// ─── CSS classes injected once on mount ──────────────────────────────────────

const CRM_STYLES = `
.crm-wrap{overflow-x:auto}
.crm-row{display:flex;min-width:max-content}
.crm-lbl{position:sticky;left:0;z-index:1;background:var(--surface);flex-shrink:0}
.crm-head.crm-lbl{z-index:2}
.crm-cell{padding:9px 8px;font-size:13px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--border);overflow:hidden;white-space:nowrap;flex-shrink:0}
.crm-head{background:var(--surface);color:var(--text2);font-weight:500;font-size:12px;border-bottom:1px solid var(--border)}
.crm-col-label{width:240px;text-align:left;justify-content:flex-start;white-space:normal;border-right:1px solid var(--border);color:var(--text2);font-weight:500}
.crm-col-day{width:90px}
.crm-col-week{width:110px;border-left:2px solid var(--border)}
.crm-col-total{width:110px;border-left:2px solid var(--border);font-weight:600;background:rgba(255,255,255,0.018)}
.crm-head.crm-col-total{background:var(--surface)}
.crm-cv-row{font-size:11px;color:var(--text2);padding:4px 8px;background:rgba(255,255,255,0.01)}
.crm-lbl.crm-cv-row{background:var(--surface)}
.crm-cv-label{font-weight:600;text-transform:uppercase;letter-spacing:0.04em}
.crm-cv-label::before{content:"↳  "}
.crm-chip{display:inline-block;font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(255,255,255,0.06);color:var(--text2)}
.crm-zero{color:var(--text2);font-weight:400}
.crm-value{color:var(--text);font-weight:600}
.crm-spend-head{padding:10px 6px 6px;font-size:11px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:0.03em;border-top:2px solid var(--border);justify-content:flex-start}
.crm-spend-filler{border-top:2px solid var(--border);flex:1 0 auto}
.crm-week-sub{display:block;font-size:9px;color:var(--text2);font-weight:400;margin-top:2px;text-transform:uppercase;letter-spacing:0.02em}
.crm-input{width:100%;font-size:12px;padding:4px;border:1px dashed var(--border);border-radius:6px;background:var(--surface2);text-align:center;color:var(--text);outline:none;-moz-appearance:textfield}
.crm-input:focus{border-color:var(--accent);background:var(--surface)}
.crm-input::-webkit-outer-spin-button,.crm-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cv(next: number, prev: number): number | null {
  return prev ? Math.round((next / prev) * 1000) / 10 : null
}
function cvChip(c: number | null) {
  if (c === null) return null
  return <span className="crm-chip">{c}%</span>
}
function fmtMoney(v: number, unit: string) {
  return (Math.round(v * 10) / 10).toLocaleString('ru-RU') + unit
}
function fmtPct(v: number) {
  return (Math.round(v * 10) / 10) + '%'
}

// ─── MonthDropdown ───────────────────────────────────────────────────────────

function MonthDropdown({ months, value, onChange }: {
  months: MonthOption[]; value: string; onChange: (k: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const cur = months.find(m => m.key === value)

  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [open])

  function toggle() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  return (
    <>
      <button ref={btnRef} onClick={toggle}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', minWidth: 180 }}
      >
        <span className="flex-1 text-left capitalize">{cur?.label ?? '—'}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && createPortal(
        <div ref={menuRef} className="py-1 rounded-xl overflow-y-auto"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: 320, zIndex: 9999, background: 'var(--surface2)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', animation: 'dropdownIn 0.12s ease-out' }}
        >
          {months.map(m => (
            <button key={m.key} onClick={() => { onChange(m.key); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-left capitalize"
              style={{ background: m.key === value ? 'rgba(124,92,246,0.1)' : 'transparent', color: m.key === value ? 'var(--accent)' : 'var(--text)', cursor: 'pointer' }}
              onMouseEnter={e => { if (m.key !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (m.key !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {m.label}
              {m.key === value && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

// ─── SourceModal ─────────────────────────────────────────────────────────────

function SourceModal({ sources, excluded, onChange, onClose }: {
  sources: string[]; excluded: Set<string>
  onChange: (src: string, checked: boolean) => void
  onClose: () => void
}) {
  function setAll(val: boolean) {
    sources.forEach(s => onChange(s, val))
  }
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999, background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl flex flex-col" style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '80vh', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Источники</h3>
          <button onClick={onClose} style={{ color: 'var(--text2)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="flex gap-4 px-5 pt-3 pb-1">
          <button onClick={() => setAll(true)} className="text-xs" style={{ color: 'var(--accent)', cursor: 'pointer' }}>Выбрать все</button>
          <button onClick={() => setAll(false)} className="text-xs" style={{ color: 'var(--text2)', cursor: 'pointer' }}>Снять все</button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 flex flex-col">
          {sources.map(src => (
            <label key={src} className="flex items-center gap-3 py-3 cursor-pointer text-sm" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
              <input type="checkbox" checked={!excluded.has(src)} onChange={e => onChange(src, e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
              {src}
            </label>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Grid row helpers ─────────────────────────────────────────────────────────

function HeadRow({ data }: { data: DashData }) {
  return (
    <div className="crm-row">
      <div className="crm-cell crm-col-label crm-head crm-lbl" />
      {data.days.map(d => <div key={d} className="crm-cell crm-head crm-col-day">{d}</div>)}
      {data.weeks.map(w => (
        <div key={w} className="crm-cell crm-head crm-col-week" style={{ flexDirection: 'column' }}>
          <span>{w}</span>
          <span className="crm-week-sub">неделя</span>
        </div>
      ))}
      <div className="crm-cell crm-head crm-col-total">Итог</div>
    </div>
  )
}

function DataRow({ name, dayValues, weekValues, total, extra }: {
  name: React.ReactNode; dayValues: number[]; weekValues: number[]; total: number; extra?: string
}) {
  const cls = (v: number, add = '') => `crm-cell ${add} ${v === 0 ? 'crm-zero' : 'crm-value'}`
  return (
    <div className="crm-row">
      <div className={`crm-cell crm-col-label crm-lbl ${extra || ''}`}>{name}</div>
      {dayValues.map((v, i) => <div key={i} className={cls(v, `crm-col-day ${extra}`)}>{v}</div>)}
      {weekValues.map((v, i) => <div key={i} className={cls(v, `crm-col-week ${extra}`)}>{v}</div>)}
      <div className={`crm-cell crm-col-total ${total === 0 ? 'crm-zero' : ''} ${extra || ''}`}>{total}</div>
    </div>
  )
}

function CvRow({ a, b }: { a: Milestone; b: Milestone }) {
  return (
    <div className="crm-row">
      <div className="crm-cell crm-col-label crm-cv-row crm-cv-label crm-lbl">CV</div>
      {a.dayValues.map((v, i) => (
        <div key={i} className="crm-cell crm-cv-row crm-col-day">{cvChip(cv(b.dayValues[i], v))}</div>
      ))}
      {a.weekValues.map((v, i) => (
        <div key={i} className="crm-cell crm-cv-row crm-col-week">{cvChip(cv(b.weekValues[i], v))}</div>
      ))}
      <div className="crm-cell crm-cv-row crm-col-total">{cvChip(cv(b.total, a.total))}</div>
    </div>
  )
}

function MoneyRow({ label, v }: { label: string; v: ValuesSet }) {
  return (
    <div className="crm-row">
      <div className="crm-cell crm-col-label crm-lbl">{label}</div>
      {v.dayValues.map((x, i) => (
        <div key={i} className={`crm-cell crm-col-day ${x === 0 ? 'crm-zero' : 'crm-value'}`}>
          {x ? x.toLocaleString('ru-RU') : 0}
        </div>
      ))}
      {v.weekValues.map((x, i) => (
        <div key={i} className={`crm-cell crm-col-week ${x === 0 ? 'crm-zero' : 'crm-value'}`}>
          {x ? x.toLocaleString('ru-RU') : 0}
        </div>
      ))}
      <div className="crm-cell crm-col-total">{v.total.toLocaleString('ru-RU')} ₸</div>
    </div>
  )
}

function ComputedRow({ label, v, fmt }: { label: string; v: ValuesSet; fmt: (n: number) => string }) {
  return (
    <div className="crm-row">
      <div className="crm-cell crm-col-label crm-cv-row crm-lbl">{label}</div>
      {v.dayValues.map((x, i) => <div key={i} className="crm-cell crm-cv-row crm-col-day">{fmt(x)}</div>)}
      {v.weekValues.map((x, i) => <div key={i} className="crm-cell crm-cv-row crm-col-week">{fmt(x)}</div>)}
      <div className="crm-cell crm-cv-row crm-col-total">{fmt(v.total)}</div>
    </div>
  )
}

// ─── SpendInput ───────────────────────────────────────────────────────────────

function SpendInput({ initialValue, onSave }: { initialValue: number; onSave: (v: number) => void }) {
  const [val, setVal] = useState(String(initialValue || ''))
  return (
    <input type="number" value={val} placeholder="0"
      onChange={e => setVal(e.target.value)}
      onBlur={() => onSave(Number(val) || 0)}
      className="crm-input"
      style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' } as React.CSSProperties}
    />
  )
}

// ─── SpendSection ─────────────────────────────────────────────────────────────

function SpendSection({ src, spend, daysIso, editable, onSave }: {
  src: string; spend: Spend; daysIso: string[]; editable: boolean
  onSave: (dateIso: string, source: string, field: string, value: number) => void
}) {
  function editRow(label: string, field: string, v: ValuesSet) {
    if (!editable) {
      return <DataRow name={label} dayValues={v.dayValues} weekValues={v.weekValues} total={v.total} />
    }
    return (
      <div className="crm-row">
        <div className="crm-cell crm-col-label crm-lbl">{label}</div>
        {v.dayValues.map((x, i) => (
          <div key={i} className="crm-cell crm-col-day" style={{ padding: '4px 6px' }}>
            <SpendInput initialValue={x} onSave={val => onSave(daysIso[i], src, field, val)} />
          </div>
        ))}
        {v.weekValues.map((x, i) => (
          <div key={i} className={`crm-cell crm-col-week ${x === 0 ? 'crm-zero' : 'crm-value'}`}>{x}</div>
        ))}
        <div className={`crm-cell crm-col-total ${v.total === 0 ? 'crm-zero' : ''}`}>{v.total}</div>
      </div>
    )
  }

  return (
    <>
      <div className="crm-row">
        <div className="crm-cell crm-col-label crm-spend-head crm-lbl">Маркетинговые расходы</div>
        <div className="crm-spend-filler" />
      </div>
      {editRow('Потрачено, $', 'spent', spend.spent)}
      {editRow('Показы', 'impressions', spend.impressions)}
      {editRow('Клики', 'clicks', spend.clicks)}
      <ComputedRow label="CTR, %" v={spend.ctr} fmt={fmtPct} />
      <ComputedRow label="Стоимость клика, $" v={spend.costPerClick} fmt={v => fmtMoney(v, '$')} />
      {editRow('Лиды (Facebook)', 'fbLeads', spend.fbLeads)}
      <ComputedRow label="Стоимость лида (аналитика), $" v={spend.costPerLeadAnalytics} fmt={v => fmtMoney(v, '$')} />
      <ComputedRow label="Бюджет на продвижение, тнг" v={spend.budgetKzt} fmt={v => fmtMoney(v, ' ₸')} />
      <ComputedRow label="Цена лида, $" v={spend.costPerLeadCrm} fmt={v => fmtMoney(v, '$')} />
      <ComputedRow label="Цена клиента, $" v={spend.costPerClient} fmt={v => fmtMoney(v, '$')} />
      <ComputedRow label="Цена клиента, тнг" v={spend.costPerClientKzt} fmt={v => fmtMoney(v, ' ₸')} />
      <ComputedRow label="ROMI, %" v={spend.romi} fmt={fmtPct} />
    </>
  )
}

// ─── Card shell ───────────────────────────────────────────────────────────────

function Card({ header, data, children }: {
  header: React.ReactNode; data: DashData; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl mb-5" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="px-5 py-3.5 text-sm font-semibold" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        {header}
      </div>
      <div className="crm-wrap" data-crm-scroll="1">
        <HeadRow data={data} />
        {children}
      </div>
    </div>
  )
}

// ─── PipelineCard ─────────────────────────────────────────────────────────────

const PIPELINE_COLORS = ['var(--accent)', 'var(--green)', 'var(--yellow)', 'var(--red)']

function PipelineCard({ p, data, idx }: { p: Pipeline; data: DashData; idx: number }) {
  const color = PIPELINE_COLORS[idx % PIPELINE_COLORS.length]
  return (
    <Card data={data} header={
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span style={{ color: 'var(--text)' }}>{p.name}</span>
      </span>
    }>
      {p.stages.map(s => (
        <DataRow key={s.name} name={s.name} dayValues={s.dayValues} weekValues={s.weekValues} total={s.total} />
      ))}
    </Card>
  )
}

// ─── SourceCard ───────────────────────────────────────────────────────────────

function SourceCard({ src, data, editable, onSave, overall }: {
  src: SourceData; data: DashData; editable: boolean; overall?: boolean
  onSave: (dateIso: string, source: string, field: string, value: number) => void
}) {
  return (
    <Card data={data} header={
      <span style={{ color: overall ? 'var(--text)' : 'var(--text2)' }}>
        {overall && <span style={{ marginRight: 8, color: 'var(--accent)' }}>★</span>}
        {src.source}
      </span>
    }>
      {src.milestones.map((m, i) => (
        <>
          <DataRow key={m.name} name={m.name} dayValues={m.dayValues} weekValues={m.weekValues} total={m.total} />
          {i < src.milestones.length - 1 && (
            <CvRow key={`cv-${i}`} a={m} b={src.milestones[i + 1]} />
          )}
        </>
      ))}
      {src.revenue && (
        <MoneyRow label="Сумма продаж" v={src.revenue} />
      )}
      {src.spend && (
        <SpendSection src={src.source} spend={src.spend} daysIso={data.daysIso} editable={editable} onSave={onSave} />
      )}
    </Card>
  )
}

// ─── VoronkiView ─────────────────────────────────────────────────────────────

function VoronkiView({ data }: { data: DashData }) {
  return (
    <div>
      {data.pipelines.map((p, i) => (
        <PipelineCard key={p.name} p={p} data={data} idx={i} />
      ))}
    </div>
  )
}

// ─── MarketingView ────────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <span className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text2)' }}>{label}</span>
      <span className="text-2xl font-bold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  )
}

function MarketingView({ data, onSave }: {
  data: DashData
  onSave: (dateIso: string, source: string, field: string, value: number) => void
}) {
  const [excluded, setExcluded] = useState<Set<string>>(new Set(data.excludedSources ?? []))
  const [modalOpen, setModalOpen] = useState(false)
  const allSources = data.marketing.sources.map(s => s.source)

  function toggle(src: string, checked: boolean) {
    const next = new Set(excluded)
    if (checked) next.delete(src); else next.add(src)
    setExcluded(next)
    fetch('/api/crm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveExcluded', excluded: Array.from(next) }) })
  }

  const { summary } = data.marketing
  const visible = data.marketing.sources.filter(s => !excluded.has(s.source))
  const archived = data.marketing.sources.filter(s => excluded.has(s.source))

  return (
    <div>
      {/* Summary metrics */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <MetricCard label="Всего лидов" value={summary.totalLeads} />
        <MetricCard label="Продаж" value={summary.totalSales} />
        <MetricCard label="Выручка" value={summary.totalRevenue.toLocaleString('ru-RU') + ' ₸'} />
        <MetricCard label="Конверсия в продажу" value={(summary.totalLeads ? Math.round(summary.totalSales / summary.totalLeads * 1000) / 10 : 0) + '%'} />
      </div>

      {/* Overall card */}
      <SourceCard src={data.marketing.overall} data={data} editable={false} onSave={onSave} overall />

      {/* Source filter button */}
      <div className="mb-5">
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M7 4v3l2 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Источники ({allSources.filter(s => !excluded.has(s)).length} из {allSources.length})
        </button>
      </div>

      {/* Visible source cards */}
      {visible.length === 0 && (
        <p className="text-sm py-4 px-1" style={{ color: 'var(--text2)' }}>Ни один источник не выбран.</p>
      )}
      {visible.map(src => (
        <SourceCard key={src.source} src={src} data={data} editable onSave={onSave} />
      ))}

      {/* Archive */}
      {archived.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-6" style={{ opacity: 0.5 }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text2)' }}>Архив ({archived.length})</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>
          {archived.map(src => (
            <div key={src.source} style={{ opacity: 0.55 }}>
              <SourceCard src={src} data={data} editable={false} onSave={onSave} />
            </div>
          ))}
        </>
      )}

      {modalOpen && (
        <SourceModal sources={allSources} excluded={excluded} onChange={toggle} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}

// ─── Main CrmDashboard ────────────────────────────────────────────────────────

export default function CrmDashboard() {
  const [months, setMonths] = useState<MonthOption[]>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'voronki' | 'marketing'>('voronki')
  const [freezing, setFreezing] = useState(false)

  // Inject CSS once
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = CRM_STYLES
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  // Sync horizontal scroll across all crm-wrap containers (passive — never blocks scroll)
  useEffect(() => {
    const onScroll = (e: Event) => {
      const src = e.target as HTMLElement
      if ((src as HTMLElement).dataset?.crmScroll !== '1') return
      const sl = src.scrollLeft
      document.querySelectorAll<HTMLElement>('[data-crm-scroll="1"]').forEach(el => {
        if (el !== src && el.scrollLeft !== sl) el.scrollLeft = sl
      })
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [])

  // Load months on mount
  useEffect(() => {
    fetch('/api/crm?action=months')
      .then(r => r.json())
      .then((ms: MonthOption[] | { error: string }) => {
        if ('error' in ms) { setError(ms.error); setLoading(false); return }
        setMonths(ms)
        if (ms.length) setSelectedMonth(ms[0].key)
      })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [])

  // Load data when month changes
  useEffect(() => {
    if (!selectedMonth) return
    setLoading(true)
    fetch(`/api/crm?action=data&month=${selectedMonth}`)
      .then(r => r.json())
      .then((d: DashData) => {
        if ((d as any)?.error) { setError((d as any).error); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [selectedMonth])

  const handleFreeze = useCallback(async () => {
    if (!data) return
    const isFrozen = data.frozen
    const msg = isFrozen
      ? 'Разморозить месяц? Данные снова начнут пересчитываться живьём.'
      : 'Зафиксировать текущие цифры? После этого они не будут меняться при поступлении новых данных.'
    if (!confirm(msg)) return
    setFreezing(true)
    await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: isFrozen ? 'unfreeze' : 'freeze', monthKey: selectedMonth }),
    })
    setFreezing(false)
    // reload
    setLoading(true)
    const d = await fetch(`/api/crm?action=data&month=${selectedMonth}`).then(r => r.json())
    setData(d)
    setLoading(false)
  }, [data, selectedMonth])

  const handleSaveSpend = useCallback(async (dateIso: string, source: string, field: string, value: number) => {
    await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveSpend', dateIso, source, field, value }),
    })
    // reload data after spend save
    const d = await fetch(`/api/crm?action=data&month=${selectedMonth}`).then(r => r.json())
    setData(d)
  }, [selectedMonth])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--text2)' }}>
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2"/>
          <path d="M20 12v10M20 28h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <p className="text-sm" style={{ color: 'var(--text2)' }}>{error}</p>
        <p className="text-xs max-w-sm text-center" style={{ color: 'var(--text2)', opacity: 0.7 }}>
          Убедитесь, что переменные GOOGLE_SERVICE_ACCOUNT_KEY и GOOGLE_SPREADSHEET_ID добавлены в настройки Vercel.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: 'var(--accent)', flexShrink: 0 }}>
          <path d="M2 13l4-5 3 3.5 4-6.5 3 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="1.5" y="1.5" width="15" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text)' }}>CRM Дашборд</h1>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          {months.length > 0 && (
            <MonthDropdown months={months} value={selectedMonth} onChange={setSelectedMonth} />
          )}
          {data && (
            <>
              <button
                onClick={handleFreeze}
                disabled={freezing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                style={{ background: data.frozen ? 'var(--surface2)' : 'var(--accent)', color: data.frozen ? 'var(--text2)' : '#fff', border: `1px solid ${data.frozen ? 'var(--border)' : 'var(--accent)'}`, cursor: 'pointer' }}
              >
                {freezing && <span className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" />}
                {data.frozen ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M9 5V4a3 3 0 1 0-6 0v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <rect x="2" y="5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                    Разморозить
                  </>
                ) : 'Зафиксировать'}
              </button>
              {data.frozen && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: 'rgba(247,192,79,0.12)', color: 'var(--yellow)', border: '1px solid rgba(247,192,79,0.2)' }}>
                  Зафиксировано
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {(['voronki', 'marketing'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text2)',
              border: tab === t ? '1px solid var(--accent)' : '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            {t === 'voronki' ? 'Воронки' : 'Маркетинг'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
            <span className="text-sm" style={{ color: 'var(--text2)' }}>Загрузка данных…</span>
          </div>
        ) : data ? (
          <>
            {tab === 'voronki' && <VoronkiView data={data} />}
            {tab === 'marketing' && <MarketingView data={data} onSave={handleSaveSpend} />}
          </>
        ) : null}
      </div>

    </div>
  )
}
