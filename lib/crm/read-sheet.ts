import { sheetValues } from './sheets'
import { serialToDateKey, stripPipeline } from './utils'
import type { SheetRow } from './types'

// Columns: A=Date, B=Link, C=Title, D=Stage, E=Pipeline, ..., H=Amount, ..., L=Source, ..., N=Tags
export async function readSheetRows(sheetName: string): Promise<SheetRow[]> {
  let values: (string | number | boolean)[][] = []
  try {
    values = await sheetValues(sheetName, 'A2:N')
  } catch {
    return []
  }

  const rows: SheetRow[] = []
  for (const row of values) {
    const serial = row[0]
    if (typeof serial !== 'number' || serial < 1) continue
    const dateKey = serialToDateKey(serial)
    if (!dateKey) continue
    rows.push({
      dateKey,
      title: String(row[2] ?? ''),
      stage: String(row[3] ?? ''),
      // Strip "(воронка)" suffix from pipeline name for consistent comparison
      pipeline: stripPipeline(String(row[4] ?? '')),
      amount: Number(row[7]) || 0,
      source: String(row[11] ?? '').trim(),
      tags: String(row[13] ?? ''),
    })
  }
  return rows
}
