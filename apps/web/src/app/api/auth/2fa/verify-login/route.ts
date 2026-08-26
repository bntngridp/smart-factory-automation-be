import { NextRequest, NextResponse } from 'next/server'
import { verifyLogin2FA } from '@/services/twoFactorService'
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
    const { tempToken, code } = body

    if (!tempToken || !code) {
      return NextResponse.json(
        { error: 'Token sesi dan kode 2FA / recovery code harus diisi' },
        { status: 400, headers: corsHeaders }
      )
    }

    const result = await verifyLogin2FA(tempToken, code)

    const cookieStore = await cookies()
    cookieStore.set('session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    })

    return NextResponse.json(
      {
        success: true,
        token: result.token,
        user: result.user,
        message: 'Autentikasi 2FA berhasil.',
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verifikasi 2FA gagal'
    return NextResponse.json(
      { error: message },
      { status: 401, headers: corsHeaders }
    )
  }
}
