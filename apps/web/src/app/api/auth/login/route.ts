import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/services/authService'
import { signToken } from '@/lib/auth'
import { signTemp2FAToken } from '@/services/twoFactorService'
import { cookies } from 'next/headers'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:6061',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Accept either username or email field
    let inputUser = body.username || body.email || ''
    if (inputUser.includes('@')) {
      inputUser = inputUser.split('@')[0]
    }

    const user = await loginUser(inputUser, body.password)

    // If Two-Factor Authentication is enabled, trigger 2FA challenge
    if (user.TwoFactorEnabled) {
      const tempToken = await signTemp2FAToken(user)
      return NextResponse.json(
        {
          requires2FA: true,
          tempToken,
          user: {
            UserID: user.UserID,
            Username: user.Username,
            Role: user.Role,
          },
          message: 'Autentikasi Dua Faktor diperlukan. Masukkan kode 6-digit dari aplikasi authenticator Anda.',
        },
        { headers: corsHeaders }
      )
    }

    const token = await signToken(user)
    const cookieStore = await cookies()
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    })

    return NextResponse.json(
      { success: true, token, user },
      { headers: corsHeaders }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json(
      { error: message },
      { status: 401, headers: corsHeaders }
    )
  }
}
