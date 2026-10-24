import { NextResponse, type NextRequest } from 'next/server'
import { isDemo } from '@/lib/demo/mode'

// Ссылка на демо для работодателей — в профилях, резюме, Notion: https://<демо>/api/demo.
// Отдаёт лёгкую страницу 200 с карточкой превью (og:*), а вход делает /api/demo/enter: браузер
// уходит туда скриптом сразу, боты превью (Upwork, LinkedIn) скриптов не выполняют и берут карточку.
// До 24.10.2026 вход был прямо здесь — 307 с кукой сессии ~4 КБ и переход на тяжёлый /dashboard,
// и превью-боты ссылку не открывали: Upwork писал «We can't access the link», LinkedIn сохранял /login.
// На проде маршрута как будто нет.
export const dynamic = 'force-dynamic'

const TITLE = 'TaskHub — live demo'
const DESCRIPTION =
  'Internal company platform: tasks and sprints, CRM analytics, expense approvals, knowledge base. ' +
  'Next.js + Supabase. Read-only demo with sample data, no sign-up needed.'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Превью LinkedIn Featured исполняет скрипты страницы: с автопереходом оно уходило на /login и
// сохраняло его вместо карточки. Ботам по User-Agent автопереход не отдаём, а роботам-браузерам
// (navigator.webdriver) скрипт сам не переходит — им остаётся кнопка.
const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|embedly|slack|whatsapp|telegram|skype|discord|headless|linkedin|upwork|vkshare|okhttp|python|curl|wget/i

export function GET(request: NextRequest) {
  if (!isDemo()) return new NextResponse('Not found', { status: 404 })
  const isBot = BOT_UA.test(request.headers.get('user-agent') ?? '')

  const pageUrl = esc(new URL('/api/demo', request.url).href)
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TaskHub">
<meta property="og:title" content="${esc(TITLE)}">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<meta property="og:url" content="${pageUrl}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(TITLE)}">
<meta name="twitter:description" content="${esc(DESCRIPTION)}">
${isBot ? '' : "<script>if (!navigator.webdriver) location.replace('/api/demo/enter')</script>"}
<style>
:root { --bg: #F4F2FD; --surface: #FFFFFF; --text: #0D0B18; --text2: #6B6489; --accent: #7C5CF6; --border: #E2DFF5; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
main { max-width: 440px; width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 28px; }
h1 { margin: 0 0 8px; font-size: 22px; }
p { margin: 0 0 20px; color: var(--text2); font-size: 14px; line-height: 1.5; }
a { display: block; text-align: center; padding: 11px 16px; border-radius: 10px; background: var(--accent); color: var(--surface);
  text-decoration: none; font-size: 14px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<main>
<h1>${esc(TITLE)}</h1>
<p>${esc(DESCRIPTION)}</p>
<a href="/api/demo/enter" rel="nofollow">Open the demo</a>
</main>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  })
}
