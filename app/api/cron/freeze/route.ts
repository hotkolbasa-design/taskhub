import { NextRequest, NextResponse } from 'next/server'
import { computeDashboardData } from '@/lib/crm/compute'
import { readSnapshot, writeSnapshot } from '@/lib/crm/snapshots'

export const maxDuration = 60

/**
 * Фиксация прошлого месяца. Запускается 3-го числа — за сутки до того, как скрипт
 * Битрикса уносит строки месяца в архивную таблицу и удаляет их из рабочих листов
 * (4-го числа в 03:00 по Алматы). Без снимка месяц после архивации показал бы нули.
 *
 * Вызов идемпотентный: если снимок уже есть, ничего не перезаписываем — вручную
 * зафиксированный месяц остаётся как есть.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Vercel Cron шлёт заголовок сам — тот же способ, что у auto-fix-sprints.
  // Ручной прогон: ?key=<CRON_SECRET>
  const secret = process.env.CRON_SECRET
  const authorized = req.headers.get('authorization') === `Bearer ${secret}`
    || (Boolean(secret) && searchParams.get('key') === secret)
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const target = searchParams.get('month') ?? previousMonth(now)

  try {
    const existing = await readSnapshot(target)
    if (existing) {
      return NextResponse.json({ month: target, status: 'already-frozen' })
    }

    const data = await computeDashboardData(target)
    const leads = data.marketing.overall.milestones[0]?.total ?? 0

    // Пустой месяц замораживать нечем: строки уже уехали в архив или их не было
    if (leads === 0) {
      return NextResponse.json({ month: target, status: 'no-data', leads: 0 }, { status: 409 })
    }

    await writeSnapshot(target, data)
    return NextResponse.json({
      month: target,
      status: 'frozen',
      leads,
      sales: data.marketing.summary.totalSales,
      revenue: data.marketing.summary.totalRevenue,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[cron/freeze]', message)
    return NextResponse.json({ month: target, status: 'error', message }, { status: 500 })
  }
}

function previousMonth(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
