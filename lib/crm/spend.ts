import { sheetValues, updateCell, appendRow } from './sheets'
import { serialToDateKey } from './utils'
import type { SpendMap, RateMap } from './types'

const SHEET = 'МаркетингРасходы'

function parseDateKey(raw: string | number | boolean): string {
  if (typeof raw === 'number' && raw >= 1) return serialToDateKey(raw)
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return ''
}

export async function readSpendMap(): Promise<SpendMap> {
  let values: (string | number | boolean)[][] = []
  try { values = await sheetValues(SHEET, 'A2:F') } catch { return {} }
  const map: SpendMap = {}
  for (const row of values) {
    const dateKey = parseDateKey(row[0])
    const source = String(row[1] ?? '').trim()
    if (!dateKey || !source) continue
    const key = `${dateKey}|${source}`
    const prev = map[key] ?? { spent: 0, impressions: 0, clicks: 0, fbLeads: 0 }
    // Merge rows with same key: keep last non-zero per field (handles duplicate rows from old broken saves)
    map[key] = {
      spent: (Number(row[2]) || 0) || prev.spent,
      impressions: (Number(row[3]) || 0) || prev.impressions,
      clicks: (Number(row[4]) || 0) || prev.clicks,
      fbLeads: (Number(row[5]) || 0) || prev.fbLeads,
    }
  }
  return map
}

export async function readRateMap(): Promise<RateMap> {
  let values: (string | number | boolean)[][] = []
  try { values = await sheetValues(SHEET, 'H2:I') } catch { return {} }
  const map: RateMap = {}
  for (const row of values) {
    const serial = row[0]
    if (typeof serial !== 'number' || serial < 1) continue
    const dateKey = serialToDateKey(serial)
    const rate = Number(row[1]) || 0
    if (dateKey && rate) map[dateKey] = rate
  }
  return map
}

const FIELD_COL: Record<string, number> = { spent: 3, impressions: 4, clicks: 5, fbLeads: 6 }
const COL_LETTER = ['', 'A', 'B', 'C', 'D', 'E', 'F']

export async function saveSpendValue(dateIso: string, source: string, field: string, value: number): Promise<void> {
  const col = FIELD_COL[field]
  if (!col) throw new Error(`Unknown field: ${field}`)

  let rows: (string | number | boolean)[][] = []
  try { rows = await sheetValues(SHEET, 'A2:B') } catch {}

  for (let i = 0; i < rows.length; i++) {
    const rowDate = parseDateKey(rows[i][0])
    const rowSource = String(rows[i][1] ?? '').trim()
    if (rowDate === dateIso && rowSource === source) {
      await updateCell(SHEET, `${COL_LETTER[col]}${i + 2}`, value)
      return
    }
  }

  // New row — write date as ISO string (USER_ENTERED may or may not convert to date serial)
  const rowData: (string | number | null)[] = [dateIso, source, 0, 0, 0, 0]
  rowData[col - 1] = value
  await appendRow(SHEET, rowData)
}
