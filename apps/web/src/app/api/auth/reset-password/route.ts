import { NextRequest, NextResponse } from 'next/server'
import { resetPasswordWithTOTP } from '@/services/authService'

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
    const { identifier, token, newPassword } = body

    if (!identifier || !token || !newPassword) {
      return NextResponse.json(
        { error: 'Email / Username, Kode Microsoft Authenticator / Recovery Code, dan Password Baru harus diisi' },
        { status: 400, headers: corsHeaders }
      )
    }

    const result = await resetPasswordWithTOTP({
      identifier,
      token,
      newPassword,
    })

    return NextResponse.json(result, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mereset kata sandi'
    return NextResponse.json({ error: message }, { status: 400, headers: corsHeaders })
  }
}
