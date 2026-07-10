import { NextRequest, NextResponse } from 'next/server'
import { computeDashboardData, getAvailableMonths } from '@/lib/crm/compute'
import { readSnapshot, writeSnapshot, deleteSnapshot } from '@/lib/crm/snapshots'
import { saveSpendValue } from '@/lib/crm/spend'
import { getExcludedSources, saveExcludedSources } from '@/lib/crm/settings'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  try {
    if (action === 'months') {
      return NextResponse.json(getAvailableMonths())
    }

    if (action === 'data') {
      const month = searchParams.get('month')
      if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

      const snapshot = await readSnapshot(month)
      const data = snapshot
        ? { ...snapshot, frozen: true }
        : { ...(await computeDashboardData(month)), frozen: false }

      const excludedSources = await getExcludedSources()
      return NextResponse.json({ ...data, excludedSources })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'freeze') {
      const data = await computeDashboardData(body.monthKey)
      await writeSnapshot(body.monthKey, data)
      return NextResponse.json({ ok: true })
    }
    if (action === 'unfreeze') {
      await deleteSnapshot(body.monthKey)
      return NextResponse.json({ ok: true })
    }
    if (action === 'saveSpend') {
      await saveSpendValue(body.dateIso, body.source, body.field, Number(body.value) || 0)
      return NextResponse.json({ ok: true })
    }
    if (action === 'saveExcluded') {
      await saveExcludedSources(body.excluded ?? [])
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
