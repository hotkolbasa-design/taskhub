// Подсказчик хантера по личной ссылке ?h=<код> (лист «Хантеры» таблицы базы) — для тех, у кого нет
// аккаунта TaskHub. Основной вход — /podskazchik под аккаунтом (app/podskazchik/route.ts).
// Лежит в /api, потому что proxy.ts не требует входа для /api.
import { getBaza, message, respond, respondPost } from '@/lib/podskazchik/handler'

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  const code = (p.get('h') ?? '').trim()
  if (!/^[A-Za-z0-9]{6,32}$/.test(code)) return message('Откройте подсказчик через TaskHub: раздел «Подсказчик».', 400)

  const baza = await getBaza(p.get('fresh') === '1')
  if (baza instanceof Response) return baza
  const hunter = baza.hunters.find(h => h.code === code)
  if (!hunter) return message('Ссылка не действует. Откройте подсказчик через TaskHub: раздел «Подсказчик».', 403)
  return respond(p, baza, hunter)
}

export async function POST(req: Request) {
  const code = (new URL(req.url).searchParams.get('h') ?? '').trim()
  const baza = await getBaza(false)
  if (baza instanceof Response) return baza
  const hunter = baza.hunters.find(h => h.code === code)
  if (!hunter) return new Response('{"ok":false,"error":"Ссылка не действует."}', { status: 403 })
  return respondPost(req, hunter)
}
