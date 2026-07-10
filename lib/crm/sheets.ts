import { google } from 'googleapis'

function getClient() {
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyRaw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured')
  if (!process.env.GOOGLE_SPREADSHEET_ID) throw new Error('GOOGLE_SPREADSHEET_ID not configured')

  const credentials = JSON.parse(keyRaw)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

const ID = () => process.env.GOOGLE_SPREADSHEET_ID!

export async function sheetValues(name: string, range: string): Promise<(string | number | boolean)[][]> {
  const sheets = getClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ID(),
    range: `'${name}'!${range}`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  })
  return (res.data.values ?? []) as (string | number | boolean)[][]
}

export async function updateCell(name: string, cell: string, value: string | number): Promise<void> {
  const sheets = getClient()
  await sheets.spreadsheets.values.update({
    spreadsheetId: ID(),
    range: `'${name}'!${cell}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  })
}

export async function updateRange(name: string, range: string, values: (string | number | null)[][]): Promise<void> {
  const sheets = getClient()
  await sheets.spreadsheets.values.update({
    spreadsheetId: ID(),
    range: `'${name}'!${range}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  })
}

export async function appendRow(name: string, values: (string | number | null)[]): Promise<void> {
  const sheets = getClient()
  await sheets.spreadsheets.values.append({
    spreadsheetId: ID(),
    range: `'${name}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })
}

export async function deleteSheetRow(name: string, rowIndex: number): Promise<void> {
  const sheets = getClient()
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID() })
  const sheet = meta.data.sheets?.find(s => s.properties?.title === name)
  const sheetId = sheet?.properties?.sheetId
  if (sheetId === undefined || sheetId === null) return
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID(),
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex },
        },
      }],
    },
  })
}
