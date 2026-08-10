import { sheetValues, updateRange, appendRow, deleteSheetRow } from './sheets'

const SHEET = 'Snapshots'
const CHUNK = 45000          // stay well under 50 000-char cell limit
const MAX_COLS = 26          // A–Z

async function findRow(monthKey: string): Promise<number> {
  let values: (string | number | boolean)[][] = []
  // Read from row 1 (no assumed header row in Snapshots sheet)
  try { values = await sheetValues(SHEET, 'A1:A') } catch { return -1 }
  for (let i = 0; i < values.length; i++) {
    if (String(values[i]?.[0] ?? '') === monthKey) return i + 1  // 1-indexed
  }
  return -1
}

export async function readSnapshot(monthKey: string): Promise<Record<string, unknown> | null> {
  let values: (string | number | boolean)[][] = []
  // Read from row 1 so we don't miss data written to the first row
  try { values = await sheetValues(SHEET, 'A1:Z') } catch { return null }
  for (const row of values) {
    if (String(row[0] ?? '') !== monthKey) continue
    // Columns D (index 3) onward hold JSON chunks
    const chunks = row
      .slice(3)
      .filter((c): c is string => typeof c === 'string' && c.length > 0)
    const json = chunks.join('')
    if (!json) return null
    try { return JSON.parse(json) } catch { return null }
  }
  return null
}

export async function writeSnapshot(monthKey: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data)
  const chunks: string[] = []
  for (let i = 0; i < json.length; i += CHUNK) {
    chunks.push(json.slice(i, i + CHUNK))
  }

  const now = new Date().toISOString()
  // [monthKey, now, 'system', chunk0, chunk1, ...]
  // Pad with nulls up to MAX_COLS so previous stale chunks are overwritten
  const dataValues: (string | null)[] = [monthKey, now, 'system', ...chunks]
  while (dataValues.length < MAX_COLS) dataValues.push(null)
  const rowValues = dataValues.slice(0, MAX_COLS)  // cap at Z

  const row = await findRow(monthKey)
  if (row > 0) {
    await updateRange(SHEET, `A${row}:Z${row}`, [rowValues as (string | number | null)[]])
  } else {
    await appendRow(SHEET, rowValues as (string | number | null)[], 'RAW')
  }
}

export async function deleteSnapshot(monthKey: string): Promise<void> {
  const row = await findRow(monthKey)
  if (row > 0) await deleteSheetRow(SHEET, row)
}
