import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeAndFetchProfile,
  handleMicrosoftSSOLogin,
  getMicrosoftConfig,
} from '@/services/microsoftAuthService'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const config = getMicrosoftConfig()
  const frontendUrl = config.frontendUrl

  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const code = searchParams.get('code')

  if (error) {
    const errorMsg = errorDescription || error || 'Autentikasi Microsoft dibatalkan atau gagal'
    return NextResponse.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent('Kode otorisasi dari Microsoft tidak ditemukan.')}`
    )
  }

  try {
    const profile = await exchangeCodeAndFetchProfile(code)
    const { token, user } = await handleMicrosoftSSOLogin(profile)

    // Set secure HTTP session cookie
    const cookieStore = await cookies()
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    })

    // Redirect to frontend dashboard with token & SSO payload
    const redirectParams = new URLSearchParams({
      token,
      sso: 'microsoft',
      username: user.Username,
      role: user.Role,
    })

    return NextResponse.redirect(`${frontendUrl}?${redirectParams.toString()}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memproses Single Sign-On Microsoft'
    return NextResponse.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(message)}`
    )
  }
}
