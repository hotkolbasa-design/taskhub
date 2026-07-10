import { NextRequest, NextResponse } from 'next/server'

const SCRIPT_URL = process.env.APPS_SCRIPT_CRM_URL

export async function GET(req: NextRequest) {
  if (!SCRIPT_URL) return NextResponse.json({ error: 'APPS_SCRIPT_CRM_URL not configured' }, { status: 503 })
  const url = new URL(SCRIPT_URL)
  const { searchParams } = new URL(req.url)
  url.searchParams.set('format', 'json')
  searchParams.forEach((v, k) => url.searchParams.set(k, v))
  try {
    const res = await fetch(url.toString(), { cache: 'no-store', redirect: 'follow' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!SCRIPT_URL) return NextResponse.json({ error: 'APPS_SCRIPT_CRM_URL not configured' }, { status: 503 })
  const body = await req.json()
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
