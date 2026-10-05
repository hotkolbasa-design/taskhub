import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { computeDashboardData, getCachedDashboard, getAvailableMonths, crmCacheTag } from '@/lib/crm/compute'
import { readSnapshot, writeSnapshot, deleteSnapshot } from '@/lib/crm/snapshots'
import { saveSpendValue, saveRateValue } from '@/lib/crm/spend'
import { getExcludedSources, saveExcludedSources, saveMergedGroups, saveMonthPlan } from '@/lib/crm/settings'
import { normalizePlan } from '@/lib/crm/plan'
import { readSheetRows } from '@/lib/crm/read-sheet'
import { getMonthDays, isTestTitle } from '@/lib/crm/utils'
import { getStudentStats, syncStudentMoves } from '@/lib/crm/students'
import { unstable_cache } from 'next/cache'

// Синхронизация движений учеников ходит в Битрикс и пишет в базу. Раньше она
// запускалась на каждое открытие вкладки — кэш делает её общей на десять минут
const syncStudentsThrottled = unstable_cache(
  async () => {
    await syncStudentMoves()
    return new Date().toISOString()
  },
  ['crm-students-sync'],
  { revalidate: 600, tags: ['crm-students'] },
)

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
      // fresh=1 — кнопка «Обновить»: считаем мимо кэша и обновляем его для остальных
      const fresh = searchParams.get('fresh') === '1'
      if (fresh) revalidateTag(crmCacheTag(month), 'max')

      const data = snapshot
        ? { ...snapshot, frozen: true }
        : { ...(await getCachedDashboard(month)), frozen: false }

      const excludedSources = await getExcludedSources()
      return NextResponse.json({ ...data, excludedSources })
    }

    if (action === 'students') {
      const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
      // Свежие движения подтягиваем при открытии вкладки: ночного прогона мало,
      // если ученика зачислили час назад и это уже хотят видеть.
      // Но не на каждое открытие — не чаще раза в десять минут на всех
      if (searchParams.get('sync') !== '0') {
        await syncStudentsThrottled().catch(e => console.error('[students] синхронизация:', e.message))
      }
      return NextResponse.json(await getStudentStats(month))
    }

    if (action === 'debug') {
      const month = searchParams.get('month')
      if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })
      const [yearStr, monthStr] = month.split('-')
      const days = getMonthDays(parseInt(yearStr), parseInt(monthStr) - 1)
      const monthDaySet = new Set(days)
      const [leadsRows, dealsRows] = await Promise.all([readSheetRows('Лиды'), readSheetRows('Сделки')])
      const monthLeads = leadsRows.filter(r => monthDaySet.has(r.dateKey))
      const stageCounts: Record<string, number> = {}
      for (const r of monthLeads) {
        stageCounts[r.stage] = (stageCounts[r.stage] ?? 0) + 1
      }
      const filteredByTest = monthLeads.filter(r => isTestTitle(r.title)).length
      return NextResponse.json({
        month,
        totalLeadsAllTime: leadsRows.length,
        totalDealsAllTime: dealsRows.length,
        monthLeadsTotal: monthLeads.length,
        monthLeadsAfterTestFilter: monthLeads.filter(r => !isTestTitle(r.title)).length,
        filteredByTest,
        stageCounts,
      })
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

    // Любая правка делает кэш месяца устаревшим — сбрасываем, иначе человек
    // сохранит значение и увидит на экране старое
    const dropCache = (monthKey?: string) => {
      if (monthKey) revalidateTag(crmCacheTag(monthKey), 'max')
      else revalidateTag('crm', 'max')
    }

    if (action === 'freeze') {
      const data = await computeDashboardData(body.monthKey)
      await writeSnapshot(body.monthKey, data)
      dropCache(body.monthKey)
      return NextResponse.json({ ok: true })
    }
    if (action === 'unfreeze') {
      await deleteSnapshot(body.monthKey)
      dropCache(body.monthKey)
      return NextResponse.json({ ok: true })
    }
    if (action === 'saveSpend') {
      await saveSpendValue(body.dateIso, body.source, body.field, Number(body.value) || 0)
      dropCache(String(body.dateIso ?? '').slice(0, 7))
      return NextResponse.json({ ok: true })
    }
    if (action === 'saveRate') {
      await saveRateValue(body.dateIso, Number(body.rate) || 0)
      dropCache(String(body.dateIso ?? '').slice(0, 7))
      return NextResponse.json({ ok: true })
    }
    if (action === 'savePlan') {
      await saveMonthPlan(body.monthKey, normalizePlan(body.plan))
      dropCache(body.monthKey)
      return NextResponse.json({ ok: true })
    }
    if (action === 'saveExcluded') {
      await saveExcludedSources(body.excluded ?? [])
      dropCache()
      return NextResponse.json({ ok: true })
    }
    if (action === 'saveGroups') {
      await saveMergedGroups(body.groups ?? [])
      dropCache()
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
