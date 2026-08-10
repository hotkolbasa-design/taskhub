import { sheetValues, updateRange, appendRow, deleteSheetRow } from './sheets'

const SHEET = 'Snapshots'
const CHUNK = 45000 // stay well under 50 000 char cell limit

async function findRow(monthKey: string): Promise<number> {
  let values: (string | number | boolean)[][] = []
  try { values = await sheetValues(SHEET, 'A2:A') } catch { return -1 }
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === monthKey) return i + 2
  }
  return -1
}

export async function readSnapshot(monthKey: string): Promise<Record<string, unknown> | null> {
  // Read up to column Z (25 columns) to cover any chunk count
  let values: (string | number | boolean)[][] = []
  try { values = await sheetValues(SHEET, 'A2:Z') } catch { return null }
  for (const row of values) {
    if (String(row[0]) !== monthKey) continue
    // Columns D (index 3) onward are JSON chunks
    const chunks = (row.slice(3) as (string | number | boolean)[])
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
  // Row layout: [monthKey, now, 'system', chunk0, chunk1, ...]
  const rowValues = [monthKey, now, 'system', ...chunks]

  const row = await findRow(monthKey)
  if (row > 0) {
    // Column letter for last cell: A=0, so index = rowValues.length-1
    const endCol = String.fromCharCode(65 + rowValues.length - 1)
    await updateRange(SHEET, `A${row}:${endCol}${row}`, [rowValues as (string | number | null)[]])
  } else {
    await appendRow(SHEET, rowValues as (string | number | null)[])
  }
}

export async function deleteSnapshot(monthKey: string): Promise<void> {
  const row = await findRow(monthKey)
  if (row > 0) await deleteSheetRow(SHEET, row)
}
