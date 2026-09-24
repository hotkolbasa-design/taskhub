import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const errorCode = searchParams.get('error_code') ?? searchParams.get('error')

  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (errorCode) {
    return NextResponse.redirect(new URL('/forgot-password?error=expired', origin))
  }

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    return NextResponse.redirect(new URL(error ? '/forgot-password?error=link' : next, origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return NextResponse.redirect(new URL(error ? '/forgot-password?error=link' : next, origin))
  }

  // Ни кода, ни токена — Supabase мог отдать сессию в хэше, а его видит только браузер
  return NextResponse.redirect(new URL(next, origin))
}
