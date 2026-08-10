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
    const raw = row[0]
    let dateKey = ''

    if (typeof raw === 'number' && raw >= 1) {
      // Google Sheets date serial (most common from Bitrix24)
      dateKey = serialToDateKey(raw)
    } else if (typeof raw === 'string' && raw.trim()) {
      // Text date: try "DD.MM.YYYY" and "YYYY-MM-DD"
      const s = raw.trim()
      const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
      if (dotMatch) {
        dateKey = `${dotMatch[3]}-${dotMatch[2].padStart(2, '0')}-${dotMatch[1].padStart(2, '0')}`
      } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        dateKey = s.slice(0, 10)
      }
    }

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
