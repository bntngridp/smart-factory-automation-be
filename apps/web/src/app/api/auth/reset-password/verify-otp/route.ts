import { NextRequest, NextResponse } from 'next/server'
import { verifyResetPasswordOTP } from '@/services/authService'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:6061',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, token } = body

    if (!identifier || !token) {
      return NextResponse.json(
        { error: 'Email kerja / username dan kode OTP / Recovery Code harus diisi' },
        { status: 400, headers: corsHeaders }
      )
    }

    const result = await verifyResetPasswordOTP(identifier, token)
    return NextResponse.json(result, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verifikasi OTP gagal'
    return NextResponse.json({ error: message }, { status: 400, headers: corsHeaders })
  }
}
