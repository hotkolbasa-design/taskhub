// Расшифровка звонка отдела продаж — открывается по ссылке «открыть» из таблицы «Интеграция B24 звонки».
// Страницу собирает Apps Script (просмотрщик «Расшифровки звонков — просмотр»), подпись k проверяет он же.
// Ходим к нему с сервера, а не из браузера: в браузере с несколькими аккаунтами Google сам дописывает
// /u/N/ к адресу script.google.com и показывает «Не удалось открыть файл».

const VIEWER =
  'https://script.google.com/macros/s/AKfycbxraJKGlRUmVSU_D7GVfycgZMUUUWVHo6aS3dR3alsV9c8B5SWTAxXteUl75KZzHLCy/exec'

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

function message(text: string, status: number) {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Расшифровка звонка</title><p style="font-family:sans-serif;padding:24px">${safe}</p>`,
    { status, headers: HEADERS },
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') ?? ''
  const k = searchParams.get('k') ?? ''
  if (!/^\d{1,12}$/.test(id) || !/^[0-9a-f]{20}$/.test(k)) {
    return message('Откройте расшифровку по ссылке «открыть» из таблицы.', 400)
  }

  try {
    const res = await fetch(`${VIEWER}?fmt=json&id=${id}&k=${k}`, { cache: 'no-store', redirect: 'follow' })
    const data = (await res.json()) as { ok: boolean; html?: string; error?: string }
    if (!data.ok || !data.html) return message(data.error || 'Расшифровка недоступна.', 404)
    const html = data.html.replace(
      '<meta charset="utf-8">',
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    )
    return new Response(html, { status: 200, headers: HEADERS })
  } catch {
    return message('Расшифровка временно недоступна, обновите страницу через минуту.', 502)
  }
}
