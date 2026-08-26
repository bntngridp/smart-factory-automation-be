import { NextRequest, NextResponse } from 'next/server'
import { getSession, verifyToken } from '@/lib/auth'
import { initiate2FASetup } from '@/services/twoFactorService'

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

    const setupData = await initiate2FASetup(session.UserID)

    return NextResponse.json(
      {
        success: true,
        secret: setupData.secret,
        otpauthUri: setupData.otpauthUri,
        qrCodeUri: setupData.qrCodeUri,
        recoveryCodes: setupData.recoveryCodes,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyiapkan 2FA'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    )
  }
}
