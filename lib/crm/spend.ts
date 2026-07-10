import { sheetValues, updateCell, appendRow } from './sheets'
import { serialToDateKey } from './utils'
import type { SpendMap, RateMap } from './types'

const SHEET = 'МаркетингРасходы'

export async function readSpendMap(): Promise<SpendMap> {
  let values: (string | number | boolean)[][] = []
  try { values = await sheetValues(SHEET, 'A2:F') } catch { return {} }
  const map: SpendMap = {}
  for (const row of values) {
    const serial = row[0]
    if (typeof serial !== 'number' || serial < 1) continue
    const dateKey = serialToDateKey(serial)
    const source = String(row[1] ?? '').trim()
    if (!dateKey || !source) continue
    map[`${dateKey}|${source}`] = {
      spent: Number(row[2]) || 0,
      impressions: Number(row[3]) || 0,
      clicks: Number(row[4]) || 0,
      fbLeads: Number(row[5]) || 0,
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
    const serial = rows[i][0]
    if (typeof serial !== 'number') continue
    const rowDate = serialToDateKey(serial)
    const rowSource = String(rows[i][1] ?? '').trim()
    if (rowDate === dateIso && rowSource === source) {
      await updateCell(SHEET, `${COL_LETTER[col]}${i + 2}`, value)
      return
    }
  }

  // New row — write date as ISO string so Sheets can parse it
  const rowData: (string | number | null)[] = [dateIso, source, 0, 0, 0, 0]
  rowData[col - 1] = value
  await appendRow(SHEET, rowData)
}
