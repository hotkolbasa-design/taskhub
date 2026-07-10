import { sheetValues, updateRange, appendRow, deleteSheetRow } from './sheets'

const SHEET = 'Snapshots'

async function findRow(monthKey: string): Promise<number> {
  let values: (string | number | boolean)[][] = []
  try { values = await sheetValues(SHEET, 'A2:A') } catch { return -1 }
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === monthKey) return i + 2
  }
  return -1
}

export async function readSnapshot(monthKey: string): Promise<Record<string, unknown> | null> {
  let values: (string | number | boolean)[][] = []
  try { values = await sheetValues(SHEET, 'A2:D') } catch { return null }
  for (const row of values) {
    if (String(row[0]) === monthKey) {
      try { return JSON.parse(String(row[3])) } catch { return null }
    }
  }
  return null
}

export async function writeSnapshot(monthKey: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data)
  const now = new Date().toISOString()
  const row = await findRow(monthKey)
  if (row > 0) {
    await updateRange(SHEET, `B${row}:D${row}`, [[now, 'system', json]])
  } else {
    await appendRow(SHEET, [monthKey, now, 'system', json])
  }
}

export async function deleteSnapshot(monthKey: string): Promise<void> {
  const row = await findRow(monthKey)
  if (row > 0) await deleteSheetRow(SHEET, row)
}
