// Excluded sources stored in МаркетингРасходы sheet, cells K1:L1
// K1 = "excludedSources", L1 = JSON array string
import { sheetValues, updateRange } from './sheets'

const SHEET = 'МаркетингРасходы'

export async function getExcludedSources(): Promise<string[]> {
  try {
    const values = await sheetValues(SHEET, 'K1:L1')
    if (values[0]?.[0] === 'excludedSources' && values[0]?.[1]) {
      return JSON.parse(String(values[0][1]))
    }
  } catch {}
  return []
}

export async function saveExcludedSources(excluded: string[]): Promise<void> {
  await updateRange(SHEET, 'K1:L1', [['excludedSources', JSON.stringify(excluded)]])
}
