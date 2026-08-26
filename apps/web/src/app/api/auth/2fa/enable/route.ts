import { NextRequest, NextResponse } from 'next/server'
import { getSession, verifyToken } from '@/lib/auth'
import { enable2FA } from '@/services/twoFactorService'

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
    let session = await getSession()
    if (!session) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        session = await verifyToken(authHeader.substring(7))
      }
    }

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
    }

    const body = await request.json()
    const { secret, code, recoveryCodes } = body

    if (!secret || !code) {
      return NextResponse.json(
        { error: 'Kunci rahasia dan kode 6-digit wajib diisi' },
        { status: 400, headers: corsHeaders }
      )
    }

    const result = await enable2FA(
      session.UserID,
      secret,
      code,
      Array.isArray(recoveryCodes) ? recoveryCodes : []
    )

    return NextResponse.json(result, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengaktifkan 2FA'
    return NextResponse.json(
      { error: message },
      { status: 400, headers: corsHeaders }
    )
  }
}
